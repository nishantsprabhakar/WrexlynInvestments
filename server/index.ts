/**
 * Wrexlyn for Investments — built on Wrexlyn's backend.
 * Plain http.createServer (no Express), matching Wrexlyn's own web/server.ts
 * convention — manual if-chain routing, static file serving, download/
 * artifact-preview endpoints ported verbatim from that pattern.
 */
import * as http from "http";
import * as fs from "fs";
import * as path from "path";
import { URL } from "url";

import { resolveInRoot, buildArtifactPreview, loadApiKey, saveApiKey, clearApiKey, maskApiKey, API_KEY_PROVIDERS, type ApiKeyProvider } from "wrexlyn";
import { workspaceRootDir } from "./lib/workspace";
import { runScreeningFlow } from "./flows/screening";
import { runEvaluationFlow } from "./flows/evaluation";
import { runDocumentationFlow } from "./flows/documentation";
import { listDeals, createDeal, updateDeal, deleteDeal, getDeal, STAGES, STATUSES } from "./pipeline/store";
import { getSettings, saveSettings } from "./lib/settings";
import { findProjectRoot } from "./lib/projectRoot";
import { listAuditEntries } from "./domain/audit/auditLog";
import { syncDomainDeal } from "./domain/sync";
import {
  icDecisions,
  capTables,
  companies as domainCompanies,
  deals as domainDeals,
  portfolioInvestments,
  portfolioKPIs,
  followOnDecisions,
  exitScenarios,
  realisedProceeds,
} from "./domain/repositories";
import { capTableSumCheck, capTableDilution } from "./domain/finance/calculations";
import { findOrCreateFundForStrategy, upsertPortfolioInvestment, buildExitScenarioInput, buildRealisedProceedsInput } from "./domain/portfolioActions";

const PORT = Number(process.env.PORT) || 4500;
const PUBLIC_DIR = path.join(findProjectRoot(__dirname), "public");
const MAX_BODY_BYTES = 60 * 1024 * 1024; // generous cap for base64-encoded decks/models/data-room PDFs

const MODEL_CATALOG: Record<string, string[]> = {
  kilo: ["kilo-auto/free"],
  groq: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "openai/gpt-oss-120b"],
  gemini: ["gemini-2.0-flash", "gemini-1.5-pro"],
  openrouter: ["openai/gpt-4o-mini", "anthropic/claude-3.5-sonnet", "meta-llama/llama-3.1-70b-instruct:free"],
  cerebras: ["llama-3.3-70b", "llama3.1-8b"],
  mistral: ["mistral-large-latest", "mistral-small-latest"],
  custom: [],
};

function sendJson(res: http.ServerResponse, status: number, data: unknown): void {
  const body = JSON.stringify(data);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(body) });
  res.end(body);
}

function readJsonBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("Request body too large."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf-8")));
      } catch {
        reject(new Error("Invalid JSON body."));
      }
    });
    req.on("error", reject);
  });
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

function serveStatic(pathname: string, res: http.ServerResponse): void {
  const rel = pathname === "/" ? "/index.html" : pathname;
  const safePath = path.normalize(rel).replace(/^([.]{2}[/\\])+/, "");
  const filePath = path.join(PUBLIC_DIR, safePath);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(400);
    res.end("Bad path");
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream", "Cache-Control": "no-cache" });
    res.end(data);
  });
}

function handleDownload(url: URL, res: http.ServerResponse): void {
  const relPath = url.searchParams.get("path");
  if (!relPath) return sendJson(res, 400, { error: "missing path" });
  let filePath: string;
  try {
    filePath = resolveInRoot(workspaceRootDir(), relPath);
  } catch (err: any) {
    return sendJson(res, 400, { error: err.message });
  }
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return sendJson(res, 404, { error: "file not found" });
  const filename = path.basename(filePath);
  res.writeHead(200, {
    "Content-Type": "application/octet-stream",
    "Content-Disposition": `attachment; filename="${filename.replace(/"/g, "")}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
  });
  fs.createReadStream(filePath).pipe(res);
}

function handleArtifactPreview(url: URL, res: http.ServerResponse): void {
  const relPath = url.searchParams.get("path");
  if (!relPath) return sendJson(res, 400, { error: "missing path" });
  let filePath: string;
  try {
    filePath = resolveInRoot(workspaceRootDir(), relPath);
  } catch (err: any) {
    return sendJson(res, 400, { error: err.message });
  }
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return sendJson(res, 404, { error: "file not found" });
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const buf = fs.readFileSync(filePath);
  buildArtifactPreview(buf, ext)
    .then((preview) => sendJson(res, 200, { path: relPath, preview: preview ?? { kind: "unsupported", reason: `no preview available for .${ext}` } }))
    .catch((err: any) => sendJson(res, 200, { path: relPath, preview: { kind: "unsupported", reason: err.message ?? String(err) } }));
}

async function handleApi(req: http.IncomingMessage, res: http.ServerResponse, url: URL): Promise<boolean> {
  const { pathname } = url;
  const method = req.method || "GET";

  try {
    if (pathname === "/api/screening" && method === "POST") {
      const body = await readJsonBody(req);
      const result = await runScreeningFlow(body);
      sendJson(res, 200, result);
      return true;
    }

    if (pathname === "/api/evaluation" && method === "POST") {
      const body = await readJsonBody(req);
      const result = await runEvaluationFlow(body);
      sendJson(res, 200, result);
      return true;
    }

    if (pathname === "/api/documentation" && method === "POST") {
      const body = await readJsonBody(req);
      const result = await runDocumentationFlow(body);
      sendJson(res, 200, result);
      return true;
    }

    if (pathname === "/api/pipeline/meta" && method === "GET") {
      sendJson(res, 200, { stages: STAGES, statuses: STATUSES });
      return true;
    }

    if (pathname === "/api/pipeline/deals" && method === "GET") {
      sendJson(res, 200, { deals: listDeals() });
      return true;
    }

    if (pathname === "/api/pipeline/deals" && method === "POST") {
      const body = await readJsonBody(req);
      if (!body.companyName) {
        sendJson(res, 400, { error: "companyName is required" });
        return true;
      }
      sendJson(res, 200, { deal: createDeal(body) });
      return true;
    }

    if (pathname === "/api/pipeline/deals" && (method === "PATCH" || method === "PUT")) {
      const id = url.searchParams.get("id");
      if (!id) {
        sendJson(res, 400, { error: "missing id" });
        return true;
      }
      const body = await readJsonBody(req);
      const deal = updateDeal(id, body);
      if (!deal) {
        sendJson(res, 404, { error: "deal not found" });
        return true;
      }
      sendJson(res, 200, { deal });
      return true;
    }

    if (pathname === "/api/pipeline/deals" && method === "DELETE") {
      const id = url.searchParams.get("id");
      if (!id) {
        sendJson(res, 400, { error: "missing id" });
        return true;
      }
      deleteDeal(id);
      sendJson(res, 200, { ok: true });
      return true;
    }

    if (pathname === "/api/audit" && method === "GET") {
      const dealId = url.searchParams.get("dealId") || undefined;
      sendJson(res, 200, { entries: listAuditEntries({ dealId }) });
      return true;
    }

    if (pathname === "/api/ic-decisions" && method === "GET") {
      const legacyDealId = url.searchParams.get("dealId");
      if (!legacyDealId) {
        sendJson(res, 400, { error: "missing dealId" });
        return true;
      }
      const legacyDeal = getDeal(legacyDealId);
      if (!legacyDeal) {
        sendJson(res, 404, { error: "deal not found" });
        return true;
      }
      const { dealId: domainDealId } = syncDomainDeal(legacyDeal);
      sendJson(res, 200, { decisions: icDecisions.list().filter((d) => d.dealId === domainDealId) });
      return true;
    }

    if (pathname === "/api/ic-decisions" && method === "POST") {
      const body = await readJsonBody(req);
      const legacyDeal = getDeal(String(body.dealId || ""));
      if (!legacyDeal) {
        sendJson(res, 404, { error: "deal not found" });
        return true;
      }
      const decidedBy = Array.isArray(body.decidedBy) ? body.decidedBy.map(String).map((s: string) => s.trim()).filter(Boolean) : [];
      if (!decidedBy.length) {
        sendJson(res, 400, { error: "decidedBy must list at least one human decision-maker — an IC decision can never be attributed to AI" });
        return true;
      }
      const { dealId: domainDealId } = syncDomainDeal(legacyDeal);
      const decision = icDecisions.create({
        dealId: domainDealId,
        decision: body.decision,
        decidedBy,
        decidedAt: Date.now(),
        rationale: body.rationale || undefined,
      });
      sendJson(res, 200, { decision });
      return true;
    }

    if (pathname === "/api/cap-tables" && method === "GET") {
      const legacyDealId = url.searchParams.get("dealId");
      if (!legacyDealId) {
        sendJson(res, 400, { error: "missing dealId" });
        return true;
      }
      const legacyDeal = getDeal(legacyDealId);
      if (!legacyDeal) {
        sendJson(res, 404, { error: "deal not found" });
        return true;
      }
      const { dealId: domainDealId } = syncDomainDeal(legacyDeal);
      sendJson(res, 200, { capTables: capTables.list().filter((c) => c.dealId === domainDealId) });
      return true;
    }

    if (pathname === "/api/cap-tables" && method === "POST") {
      const body = await readJsonBody(req);
      const legacyDeal = getDeal(String(body.dealId || ""));
      if (!legacyDeal) {
        sendJson(res, 404, { error: "deal not found" });
        return true;
      }
      const rows = Array.isArray(body.rows) ? body.rows : [];
      const sumCheck = capTableSumCheck(rows);
      if (!sumCheck.valid) {
        sendJson(res, 400, { error: `cap table rows must sum to 100% ownership (got ${sumCheck.totalPct.toFixed(2)}%)` });
        return true;
      }
      const { companyId, dealId: domainDealId } = syncDomainDeal(legacyDeal);
      const capTable = capTables.create({
        companyId,
        dealId: domainDealId,
        asOfDate: body.asOfDate || new Date().toISOString().slice(0, 10),
        rows,
      });
      sendJson(res, 200, { capTable });
      return true;
    }

    if (pathname === "/api/cap-tables/dilution" && method === "POST") {
      const body = await readJsonBody(req);
      const result = capTableDilution({
        existingRows: Array.isArray(body.existingRows) ? body.existingRows : [],
        preMoneyM: Number(body.preMoneyM) || 0,
        newInvestmentM: Number(body.newInvestmentM) || 0,
      });
      sendJson(res, 200, result);
      return true;
    }

    if (pathname === "/api/portfolio/investments" && method === "GET") {
      const investments = portfolioInvestments.list().map((inv) => ({
        ...inv,
        companyName: domainCompanies.get(inv.companyId)?.legalName,
        strategy: domainDeals.get(inv.dealId)?.strategy,
      }));
      sendJson(res, 200, { investments });
      return true;
    }

    if (pathname === "/api/portfolio/investments" && method === "POST") {
      const body = await readJsonBody(req);
      const legacyDeal = getDeal(String(body.dealId || ""));
      if (!legacyDeal) {
        sendJson(res, 404, { error: "deal not found" });
        return true;
      }
      const { companyId, dealId: domainDealId } = syncDomainDeal(legacyDeal);
      const domainDeal = domainDeals.get(domainDealId)!;
      const fundId = findOrCreateFundForStrategy(domainDeal.strategy);
      const investment = upsertPortfolioInvestment({
        dealId: domainDealId,
        companyId,
        fundId,
        investedM: Number(body.investedM) || 0,
        ownershipPct: Number(body.ownershipPct) || 0,
        investedAt: body.investedAt ? new Date(body.investedAt).getTime() : Date.now(),
      });
      updateDeal(legacyDeal.id, { status: "Invested" });
      sendJson(res, 200, { investment });
      return true;
    }

    if (pathname === "/api/portfolio/detail" && method === "GET") {
      const id = url.searchParams.get("portfolioInvestmentId");
      if (!id) {
        sendJson(res, 400, { error: "missing portfolioInvestmentId" });
        return true;
      }
      const investment = portfolioInvestments.get(id);
      if (!investment) {
        sendJson(res, 404, { error: "portfolio investment not found" });
        return true;
      }
      sendJson(res, 200, {
        investment,
        kpis: portfolioKPIs.list().filter((k) => k.portfolioInvestmentId === id),
        followOnDecisions: followOnDecisions.list().filter((f) => f.portfolioInvestmentId === id),
        exitScenarios: exitScenarios.list().filter((e) => e.portfolioInvestmentId === id),
        realisedProceeds: realisedProceeds.list().filter((r) => r.portfolioInvestmentId === id),
      });
      return true;
    }

    if (pathname === "/api/portfolio/kpis" && method === "POST") {
      const body = await readJsonBody(req);
      if (!portfolioInvestments.get(String(body.portfolioInvestmentId || ""))) {
        sendJson(res, 404, { error: "portfolio investment not found" });
        return true;
      }
      const kpi = portfolioKPIs.create({
        portfolioInvestmentId: body.portfolioInvestmentId,
        period: body.period,
        kpi: body.kpi,
        value: Number(body.value),
        targetValue: body.targetValue != null ? Number(body.targetValue) : undefined,
      });
      sendJson(res, 200, { kpi });
      return true;
    }

    if (pathname === "/api/portfolio/follow-on-decisions" && method === "POST") {
      const body = await readJsonBody(req);
      if (!portfolioInvestments.get(String(body.portfolioInvestmentId || ""))) {
        sendJson(res, 404, { error: "portfolio investment not found" });
        return true;
      }
      const decidedBy = Array.isArray(body.decidedBy) ? body.decidedBy.map(String).map((s: string) => s.trim()).filter(Boolean) : [];
      if (!decidedBy.length) {
        sendJson(res, 400, { error: "decidedBy must list at least one human decision-maker — a follow-on commitment can never be attributed to AI" });
        return true;
      }
      const decision = followOnDecisions.create({
        portfolioInvestmentId: body.portfolioInvestmentId,
        roundName: body.roundName || undefined,
        decision: body.decision,
        decidedBy,
        decidedAt: Date.now(),
        amountM: body.amountM != null ? Number(body.amountM) : undefined,
        rationale: body.rationale || undefined,
      });
      sendJson(res, 200, { decision });
      return true;
    }

    if (pathname === "/api/portfolio/exit-scenarios" && method === "POST") {
      const body = await readJsonBody(req);
      const investment = portfolioInvestments.get(String(body.portfolioInvestmentId || ""));
      if (!investment) {
        sendJson(res, 404, { error: "portfolio investment not found" });
        return true;
      }
      const scenario = exitScenarios.create(
        buildExitScenarioInput(investment.investedM, {
          portfolioInvestmentId: body.portfolioInvestmentId,
          scenario: body.scenario,
          exitRoute: body.exitRoute,
          exitYear: body.exitYear != null ? Number(body.exitYear) : undefined,
          expectedProceedsM: body.expectedProceedsM != null ? Number(body.expectedProceedsM) : undefined,
        })
      );
      sendJson(res, 200, { scenario });
      return true;
    }

    if (pathname === "/api/portfolio/realised-proceeds" && method === "POST") {
      const body = await readJsonBody(req);
      const investment = portfolioInvestments.get(String(body.portfolioInvestmentId || ""));
      if (!investment) {
        sendJson(res, 404, { error: "portfolio investment not found" });
        return true;
      }
      const proceeds = realisedProceeds.create(
        buildRealisedProceedsInput(investment, {
          exitDate: body.exitDate,
          exitRoute: body.exitRoute,
          grossProceedsM: Number(body.grossProceedsM) || 0,
          netProceedsM: body.netProceedsM != null ? Number(body.netProceedsM) : undefined,
        })
      );
      portfolioInvestments.update(investment.id, { status: "exited" });
      sendJson(res, 200, { proceeds });
      return true;
    }

    if (pathname === "/api/download" && method === "GET") {
      handleDownload(url, res);
      return true;
    }

    if (pathname === "/api/artifact-preview" && method === "GET") {
      handleArtifactPreview(url, res);
      return true;
    }

    if (pathname === "/api/settings" && method === "GET") {
      sendJson(res, 200, getSettings());
      return true;
    }

    if (pathname === "/api/settings" && method === "POST") {
      const body = await readJsonBody(req);
      sendJson(res, 200, saveSettings(body));
      return true;
    }

    if (pathname === "/api/models" && method === "GET") {
      sendJson(res, 200, { models: MODEL_CATALOG });
      return true;
    }

    if (pathname === "/api/api-keys" && method === "GET") {
      const entries = await Promise.all(
        API_KEY_PROVIDERS.map(async (provider) => {
          const key = await loadApiKey(provider);
          return { provider, hasKey: !!key, masked: key ? maskApiKey(key) : null };
        })
      );
      sendJson(res, 200, { keys: entries });
      return true;
    }

    if (pathname === "/api/api-keys" && method === "POST") {
      const body = await readJsonBody(req);
      const provider = body.provider as ApiKeyProvider;
      if (!provider || !API_KEY_PROVIDERS.includes(provider)) {
        sendJson(res, 400, { error: "invalid provider" });
        return true;
      }
      await saveApiKey(provider, String(body.apiKey || ""));
      sendJson(res, 200, { ok: true });
      return true;
    }

    if (pathname === "/api/api-keys" && method === "DELETE") {
      const provider = url.searchParams.get("provider") as ApiKeyProvider | null;
      if (!provider || !API_KEY_PROVIDERS.includes(provider)) {
        sendJson(res, 400, { error: "invalid provider" });
        return true;
      }
      await clearApiKey(provider);
      sendJson(res, 200, { ok: true });
      return true;
    }
  } catch (err: any) {
    sendJson(res, 500, { error: err.message ?? String(err) });
    return true;
  }

  return false;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);

  if (url.pathname.startsWith("/api/")) {
    handleApi(req, res, url).then((handled) => {
      if (!handled) sendJson(res, 404, { error: "not found" });
    });
    return;
  }

  if (url.pathname === "/favicon.ico") {
    res.writeHead(204);
    res.end();
    return;
  }

  serveStatic(url.pathname, res);
});

server.listen(PORT, () => {
  console.log(`Wrexlyn for Investments listening on http://localhost:${PORT}`);
});
