/**
 * Wrexlyn for Investments — built on Wrexlyn's backend.
 * Copyright (c) 2026 Nishant Prabhakar. All rights reserved.
 * Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for details.
 * Flow 3: Documentation Review — any company-related document (legal,
 * financial, compliance, litigation), reviewed for risk. If a .docx was
 * uploaded, the flow attempts a REAL tracked-change redline (Wrexlyn's
 * actual redline_docx tool — the same OOXML mechanism used for contracts
 * in the coding-agent product) on each flagged clause with quoted text.
 */
import * as path from "path";
import { runStructuredJson } from "../lib/aiFlow";
import { ingestUploadedFile, type UploadedFile } from "../lib/ingest";
import { dealWorkspaceRoot } from "../lib/workspace";
import { upsertDealByCompanyName, type Deal, type DocumentationRecord } from "../pipeline/store";
import { redlineDocxTool } from "wrexlyn";
import { recordAuditEntry } from "../domain/audit/auditLog";
import { syncDomainDeal } from "../domain/sync";
import { risksAndMitigants, investmentArtifacts, sources } from "../domain/repositories";
import { buildRiskAndMitigantInputs, buildInvestmentArtifactInput } from "./documentation.persist";
import { buildSourceInput } from "../domain/sourceActions";
import { DocumentationLlmOutputSchema } from "./schemas";
import { CLASSIFICATION_RULES } from "./promptFragments";

const DOCUMENTATION_SYSTEM = `You are a senior diligence counsel/analyst reviewing ONE company-related document — this could be a legal contract, term sheet, financial statement, compliance certificate, litigation record, or any other corporate document. Read it closely and flag anything a diligence team needs to know.

Return ONLY valid JSON in exactly this shape:
{
  "documentType": "specific document type, e.g. 'Share Purchase Agreement', 'Statutory Auditor Report FY24'",
  "keyFindings": ["material facts/terms found in the document"],
  "riskFlags": [
    {
      "flag": "short label for the risk",
      "severity": "high|medium|low",
      "rationale": "why this matters for the investment decision",
      "recommendedAction": "specific next step (renegotiate clause, request additional disclosure, escalate to legal, etc.)",
      "quotedText": "the EXACT verbatim text from the document this flag refers to, or empty string if not tied to a specific quotable passage",
      "suggestedReplacementText": "proposed replacement language if quotedText is set and a redline makes sense, else empty string",
      "classification": "sourced_fact"
    }
  ],
  "complianceGaps": ["missing certifications, filings, or disclosures expected for a document of this type"],
  "missingItems": ["standard protections/sections a sophisticated counterparty would expect but that are absent"]
}

Rules:
- quotedText must be copied character-for-character from the source text when set — this is used to attempt an automated redline, so approximate quotes are worse than leaving it empty.
- Be specific and skeptical — do not pad with generic boilerplate risk language.
- Every riskFlags entry must carry a "classification". ${CLASSIFICATION_RULES}
Return ONLY the JSON object, no markdown fences, no commentary.`;

export interface DocumentationInput {
  companyName?: string;
  files: UploadedFile[];
}

export async function runDocumentationFlow(input: DocumentationInput) {
  if (!input.files?.length) throw new Error("At least one document is required.");

  const dealName = (input.companyName || "").trim() || "Unfiled Documentation Review";
  const deal = upsertDealByCompanyName(dealName, {});
  const root = dealWorkspaceRoot(deal.id);
  const { companyId, dealId: domainDealId } = syncDomainDeal(deal);

  const results: any[] = [];
  const docRecords: DocumentationRecord[] = [];

  for (const file of input.files) {
    const ingested = await ingestUploadedFile(root, file);
    if (!ingested.ok || !ingested.text.trim()) {
      results.push({ fileName: file.name, error: "Could not extract text from this file." });
      continue;
    }

    const userContent = `DOCUMENT: ${file.name}\n\nEXTRACTED TEXT:\n${ingested.text.slice(0, 20000)}`;
    const raw = await runStructuredJson(DOCUMENTATION_SYSTEM, userContent);
    const review = DocumentationLlmOutputSchema.parse(raw);

    let redlinedDocPath: string | undefined;
    const ext = path.extname(file.name).toLowerCase();
    if (ext === ".docx") {
      const outputPath = ingested.storedRelPath.replace(/\.docx$/i, "_redlined.docx");
      let firstRedlineDone = false;
      for (const flag of review.riskFlags || []) {
        if (!flag.quotedText || typeof flag.quotedText !== "string" || !flag.quotedText.trim()) continue;
        const source = firstRedlineDone ? outputPath : ingested.storedRelPath;
        const res = await redlineDocxTool.run(
          {
            path: source,
            old_string: flag.quotedText,
            new_string: flag.suggestedReplacementText || "",
            output_path: outputPath,
          },
          { root }
        );
        if (res.ok) firstRedlineDone = true;
      }
      if (firstRedlineDone) redlinedDocPath = `${deal.id}/${outputPath}`;
    }

    results.push({ fileName: file.name, review, redlinedDocPath });
    const overallRiskGrade = review.riskFlags?.some((f: any) => f.severity === "high")
      ? "High Risk"
      : review.riskFlags?.length
        ? "Medium Risk"
        : "Low Risk";
    docRecords.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      fileName: file.name,
      overallRiskGrade,
      ranAt: Date.now(),
      redlinedDocPath,
    });

    recordAuditEntry({
      dealId: deal.id,
      companyName: dealName,
      flow: "documentation",
      inputSummary: `document: ${file.name}`,
      outputSummary: { documentType: review.documentType, riskFlagCount: review.riskFlags?.length ?? 0, overallRiskGrade },
      validationOk: true,
    });

    const sourceId = sources.create(buildSourceInput(domainDealId, companyId, ingested)).id;
    for (const risk of buildRiskAndMitigantInputs(review, domainDealId, sourceId)) risksAndMitigants.create(risk);
    if (redlinedDocPath) investmentArtifacts.create(buildInvestmentArtifactInput(domainDealId, redlinedDocPath));
  }

  const existingDocs = deal.documentation || [];
  const updated = upsertDealByCompanyName(dealName, {
    documentation: [...existingDocs, ...docRecords],
  } as Partial<Deal>);

  return { deal: updated, results };
}
