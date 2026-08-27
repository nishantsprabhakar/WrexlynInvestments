/*
 * Wrexlyn for Investments — built on Wrexlyn's backend.
 * Vanilla JS SPA, no framework — matching Wrexlyn's own public/app.js
 * convention. Four tabs (Screening/Evaluation/Documentation/Pipeline) drive
 * four server-side flows over a small JSON REST API.
 */

/* ---------- generic helpers ---------- */
function escHtml(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function loadingHtml(msg) {
  return `<div class="loading-box"><div class="spin"></div>${escHtml(msg)}</div>`;
}
function errorHtml(msg) {
  return `<div class="error-box"><div class="icon">⚠</div><div>${escHtml(msg)}</div></div>`;
}
async function apiFetch(url, opts) {
  const res = await fetch(url, opts);
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      msg = j.error || msg;
    } catch (_) {}
    throw new Error(msg);
  }
  return res.json();
}
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ---------- tab switching ---------- */
function switchView(view) {
  document.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
  document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === "view-" + view));
  if (view === "pipeline") loadPipeline();
  if (view === "ic-decisions") loadICDecisionsTab();
  if (view === "captable-vc") loadCapTableTab();
  if (view === "portfolio") loadPortfolioTab();
  if (view === "diligence") loadDiligenceTab();
}
document.querySelectorAll(".tab-btn").forEach((btn) => btn.addEventListener("click", () => switchView(btn.dataset.view)));

/* ---------- upload zones ---------- */
const uploadedFiles = {};
function wireUploadZone(zoneId, inputId, labelId, key, onChange) {
  const zone = document.getElementById(zoneId);
  const input = document.getElementById(inputId);
  const label = document.getElementById(labelId);
  function accept(file) {
    if (!file) return;
    uploadedFiles[key] = file;
    zone.classList.add("has-file");
    label.textContent = "✓ " + file.name;
    if (onChange) onChange();
  }
  input.addEventListener("change", (e) => accept(e.target.files[0]));
  zone.addEventListener("dragover", (e) => {
    e.preventDefault();
    zone.classList.add("drag");
  });
  zone.addEventListener("dragleave", () => zone.classList.remove("drag"));
  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    zone.classList.remove("drag");
    const f = e.dataTransfer.files[0];
    if (f) accept(f);
  });
}

wireUploadZone("scr-deck-zone", "scr-deck-input", "scr-deck-file", "scr-deck");
wireUploadZone("ev-deck-zone", "ev-deck-input", "ev-deck-file", "ev-deck", updateEvalButton);
wireUploadZone("ev-model-zone", "ev-model-input", "ev-model-file", "ev-model", updateEvalButton);
function updateEvalButton() {
  document.getElementById("ev-run-btn").disabled = !(uploadedFiles["ev-deck"] && uploadedFiles["ev-model"]);
}

let docFiles = [];
(function wireDocZone() {
  const zone = document.getElementById("doc-files-zone");
  const input = document.getElementById("doc-files-input");
  const list = document.getElementById("doc-files-list");
  function update() {
    list.innerHTML = docFiles.map((f) => "✓ " + escHtml(f.name)).join("<br/>");
    document.getElementById("doc-run-btn").disabled = docFiles.length === 0;
    zone.classList.toggle("has-file", docFiles.length > 0);
  }
  input.addEventListener("change", (e) => {
    docFiles = Array.from(e.target.files);
    update();
  });
  zone.addEventListener("dragover", (e) => {
    e.preventDefault();
    zone.classList.add("drag");
  });
  zone.addEventListener("dragleave", () => zone.classList.remove("drag"));
  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    zone.classList.remove("drag");
    docFiles = Array.from(e.dataTransfer.files);
    update();
  });
})();

/* ---------- Flow 1: Screening ---------- */
document.getElementById("scr-run-btn").addEventListener("click", runScreening);
async function runScreening() {
  const company = document.getElementById("scr-company").value.trim();
  if (!company) {
    document.getElementById("scr-company").focus();
    return;
  }
  const btn = document.getElementById("scr-run-btn");
  btn.disabled = true;
  btn.textContent = "Screening…";
  const resEl = document.getElementById("screening-result");
  resEl.innerHTML = loadingHtml(`Screening ${company}…`);
  try {
    const body = { companyName: company };
    const deck = uploadedFiles["scr-deck"];
    if (deck) body.deckFile = { name: deck.name, base64: await fileToBase64(deck) };
    const result = await apiFetch("/api/screening", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    renderScreeningResult(result.report);
  } catch (e) {
    resEl.innerHTML = errorHtml(e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Run Screening";
  }
}
function renderScreeningResult(r) {
  const dims = (r.dimensions || [])
    .map((d) => {
      const pct = Math.max(0, Math.min(100, ((d.score || 0) / 10) * 100));
      return `<div class="dim-row">
        <div class="dim-score">${(d.score ?? 0).toFixed(1)}</div>
        <div class="dim-body">
          <div class="dim-name">${escHtml(d.name)}</div>
          <div class="dim-bar-track"><div class="dim-bar-fill" style="width:${pct}%"></div></div>
          <div class="dim-rationale">${escHtml(d.rationale || "")}</div>
        </div>
      </div>`;
    })
    .join("");
  const classificationLabel = (c) => (c || "").replace(/_/g, " ");
  const claimLi = (c) =>
    `<li>${escHtml(c.text ?? c)}${c.classification ? ` <span class="badge badge-neutral">${escHtml(classificationLabel(c.classification))}</span>` : ""}</li>`;
  const facts = (r.keyFacts || []).map(claimLi).join("") || "<li>None</li>";
  const flags = (r.redFlags || []).map(claimLi).join("") || "<li>None flagged</li>";

  document.getElementById("screening-result").innerHTML = `
    <div class="panel">
      <div class="grade-hero">
        <div class="grade-ring">${escHtml(r.grade || "—")}</div>
        <div class="grade-meta">
          <div class="gm-title">${escHtml(r.companyName || "")}${r.sector ? " · " + escHtml(r.sector) : ""}</div>
          <div class="gm-sub">OVERALL RATING ${r.overallRating ?? "—"}/100 · ${escHtml(r.recommendation || "")}</div>
        </div>
      </div>
      ${dims}
    </div>
    <div class="two-col">
      <div class="panel"><div class="panel-title">Key Facts</div><ul style="font-size:12.5px;color:var(--text-dim);line-height:1.8;margin:0;padding-left:18px">${facts}</ul></div>
      <div class="panel"><div class="panel-title">Red Flags</div><ul style="font-size:12.5px;color:var(--danger);line-height:1.8;margin:0;padding-left:18px">${flags}</ul></div>
    </div>
  `;
}

/* ---------- Flow 2: Evaluation ---------- */
document.getElementById("ev-run-btn").addEventListener("click", runEvaluation);
async function runEvaluation() {
  const company = document.getElementById("ev-company").value.trim();
  const deck = uploadedFiles["ev-deck"];
  const model = uploadedFiles["ev-model"];
  if (!company || !deck || !model) return;
  const btn = document.getElementById("ev-run-btn");
  btn.disabled = true;
  btn.textContent = "Building IC Note…";
  const resEl = document.getElementById("evaluation-result");
  resEl.innerHTML = loadingHtml(`Building IC note for ${company}…`);
  try {
    const body = {
      companyName: company,
      deckFile: { name: deck.name, base64: await fileToBase64(deck) },
      modelFile: { name: model.name, base64: await fileToBase64(model) },
    };
    const result = await apiFetch("/api/evaluation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    renderEvaluationResult(result);
  } catch (e) {
    resEl.innerHTML = errorHtml(e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Generate IC Note";
  }
}
function renderEvaluationResult({ note, deal }) {
  const fa = note.financialAnalysis || {};
  const val = note.valuation || {};
  const risks =
    (note.risksAndMitigants || [])
      .map(
        (r) =>
          `<tr><td>${escHtml(r.risk)}</td><td><span class="badge badge-${(r.severity || "medium").toLowerCase()}">${escHtml(r.severity || "")}</span></td><td>${escHtml(r.mitigant)}</td><td>${r.classification ? `<span class="badge badge-neutral">${escHtml(r.classification.replace(/_/g, " "))}</span>` : ""}</td></tr>`
      )
      .join("") || `<tr><td colspan="4">None identified</td></tr>`;
  const dlDocx = deal?.evaluation?.icNoteDocPath
    ? `<a class="btn btn-primary btn-sm" href="/api/download?path=${encodeURIComponent(deal.evaluation.icNoteDocPath)}">⬇ IC Note (.docx)</a>`
    : "";
  const dlXlsx = deal?.evaluation?.modelXlsxPath
    ? `<a class="btn btn-sm" href="/api/download?path=${encodeURIComponent(deal.evaluation.modelXlsxPath)}">⬇ Financial Model (.xlsx)</a>`
    : "";

  document.getElementById("evaluation-result").innerHTML = `
    <div class="panel">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:10px">
        <h2 style="margin:0">${escHtml(note.companyName || "")} — IC Note</h2>
        <div style="display:flex;gap:8px;flex-wrap:wrap">${dlDocx}${dlXlsx}</div>
      </div>
      <div class="panel-title">Executive Summary</div>
      <p class="sub">${escHtml(note.executiveSummary || "")}</p>
      <div class="panel-title">Investment Thesis</div>
      <p class="sub">${escHtml(note.investmentThesis || "")}</p>
      <div class="panel-title">Business Overview</div>
      <p class="sub">${escHtml(note.businessOverview || "")}</p>

      <div class="ticker">
        <div class="ticker-cell"><div class="ticker-label">Revenue (Cr)</div><div class="ticker-value">${fa.revenueCr ?? "—"}</div></div>
        <div class="ticker-cell"><div class="ticker-label">EBITDA (Cr)</div><div class="ticker-value">${fa.ebitdaCr ?? "—"}</div></div>
        <div class="ticker-cell"><div class="ticker-label">EBITDA Margin</div><div class="ticker-value">${fa.ebitdaMarginPct != null ? fa.ebitdaMarginPct + "%" : "—"}</div></div>
        <div class="ticker-cell"><div class="ticker-label">PAT (Cr)</div><div class="ticker-value">${fa.patCr ?? "—"}</div></div>
        <div class="ticker-cell"><div class="ticker-label">Ask (Cr)</div><div class="ticker-value">${val.askCr ?? "—"}</div></div>
      </div>
      <p class="sub">${escHtml(fa.commentary || "")}</p>

      <div class="panel-title">Valuation</div>
      <p class="sub">Implied multiple: ${escHtml(val.impliedMultiple || "—")}. ${escHtml(val.commentary || "")}</p>

      <div class="panel-title">Risks &amp; Mitigants</div>
      <table class="grid"><thead><tr><th>Risk</th><th>Severity</th><th>Mitigant</th><th>Classification</th></tr></thead><tbody>${risks}</tbody></table>

      <div class="panel-title" style="margin-top:18px">Recommendation</div>
      <p class="sub"><strong style="color:var(--accent)">${escHtml(note.recommendation || "")}</strong> ${escHtml(note.proposedTerms || "")}</p>
    </div>
  `;
}

/* ---------- Flow 3: Documentation ---------- */
document.getElementById("doc-run-btn").addEventListener("click", runDocumentation);
async function runDocumentation() {
  if (!docFiles.length) return;
  const btn = document.getElementById("doc-run-btn");
  btn.disabled = true;
  btn.textContent = "Reviewing…";
  const resEl = document.getElementById("documentation-result");
  resEl.innerHTML = loadingHtml("Extracting and reviewing documents…");
  try {
    const company = document.getElementById("doc-company").value.trim();
    const files = await Promise.all(docFiles.map(async (f) => ({ name: f.name, base64: await fileToBase64(f) })));
    const result = await apiFetch("/api/documentation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyName: company || undefined, files }),
    });
    renderDocumentationResult(result);
  } catch (e) {
    resEl.innerHTML = errorHtml(e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Review Documents";
  }
}
function renderDocumentationResult({ results }) {
  const html = results
    .map((r) => {
      if (r.error) {
        return `<div class="panel"><div class="panel-title">${escHtml(r.fileName)}</div><p class="sub" style="color:var(--danger)">${escHtml(r.error)}</p></div>`;
      }
      const rev = r.review || {};
      const clauses =
        (rev.riskFlags || [])
          .map((f) => {
            const lvl = (f.severity || "medium").toLowerCase();
            return `<div class="clause-card ${lvl}">
              <div class="clause-head"><div class="clause-name">${escHtml(f.flag)}</div><span class="badge badge-${lvl}">${escHtml(lvl)}</span>${f.classification ? `<span class="badge badge-neutral">${escHtml(f.classification.replace(/_/g, " "))}</span>` : ""}</div>
              <div class="clause-body">${escHtml(f.rationale || "")}</div>
              ${f.quotedText ? `<div class="clause-quote">${escHtml(f.quotedText)}</div>` : ""}
              ${f.recommendedAction ? `<div class="clause-action">→ ${escHtml(f.recommendedAction)}</div>` : ""}
            </div>`;
          })
          .join("") || '<div class="pipe-empty">No specific risks flagged.</div>';
      const findings = (rev.keyFindings || []).map((k) => `<li>${escHtml(k)}</li>`).join("") || "<li>None</li>";
      const gaps = (rev.complianceGaps || []).map((k) => `<li>${escHtml(k)}</li>`).join("");
      const missing = (rev.missingItems || []).map((k) => `<li>${escHtml(k)}</li>`).join("");
      const dl = r.redlinedDocPath
        ? `<a class="btn btn-primary btn-sm" href="/api/download?path=${encodeURIComponent(r.redlinedDocPath)}">⬇ Redlined Copy</a>`
        : "";
      return `<div class="panel">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
          <div><div class="panel-title" style="margin-bottom:2px">${escHtml(r.fileName)}</div><div class="sub" style="margin-bottom:0">${escHtml(rev.documentType || "")}</div></div>
          ${dl}
        </div>
        <div class="section-label">Key Findings</div>
        <ul style="font-size:12.5px;color:var(--text-dim);line-height:1.8;margin:0 0 4px;padding-left:18px">${findings}</ul>
        <div class="section-label">Risk Flags</div>
        ${clauses}
        ${gaps ? `<div class="section-label">Compliance Gaps</div><ul style="font-size:12.5px;color:var(--warn);line-height:1.8;margin:0;padding-left:18px">${gaps}</ul>` : ""}
        ${missing ? `<div class="section-label">Missing Protections</div><ul style="font-size:12.5px;color:var(--text-dim);line-height:1.8;margin:0;padding-left:18px">${missing}</ul>` : ""}
      </div>`;
    })
    .join("");
  document.getElementById("documentation-result").innerHTML = html;
}

/* ---------- Flow 4: Pipeline ---------- */
let pipelineData = { deals: [], stages: [], statuses: [] };

async function loadPipeline() {
  document.getElementById("pipeline-content").innerHTML = loadingHtml("Loading pipeline…");
  try {
    const [dealsRes, metaRes] = await Promise.all([apiFetch("/api/pipeline/deals"), apiFetch("/api/pipeline/meta")]);
    pipelineData.deals = dealsRes.deals;
    pipelineData.stages = metaRes.stages;
    pipelineData.statuses = metaRes.statuses;
    renderPipeline();
  } catch (e) {
    document.getElementById("pipeline-content").innerHTML = errorHtml(e.message);
  }
}

function barsHtml(counts) {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (!entries.length) return "";
  const max = Math.max(1, ...entries.map((e) => e[1]));
  return entries
    .map(([label, count]) => `<div class="chart-row"><span>${escHtml(label)}</span><div class="chart-track"><span style="width:${(count / max) * 100}%"></span></div><b style="font-family:var(--mono)">${count}</b></div>`)
    .join("");
}

function renderPipeline() {
  const deals = pipelineData.deals;
  const stages = pipelineData.stages;

  const active = deals.filter((d) => d.status === "Active").length;
  const invested = deals.filter((d) => d.status === "Invested").length;
  const rejected = deals.filter((d) => d.status === "Rejected").length;
  const onhold = deals.filter((d) => d.status === "On Hold").length;
  const margins = deals.filter((d) => d.financials?.ebitdaMarginPct != null).map((d) => d.financials.ebitdaMarginPct);
  const avgMargin = margins.length ? (margins.reduce((a, b) => a + b, 0) / margins.length).toFixed(1) : "—";

  const stageCounts = stages.map((s) => ({ stage: s, count: deals.filter((d) => d.stage === s).length }));
  const maxStage = Math.max(1, ...stageCounts.map((s) => s.count));

  const sectorCounts = {};
  deals.forEach((d) => {
    if (d.sector) sectorCounts[d.sector] = (sectorCounts[d.sector] || 0) + 1;
  });
  const reasonCounts = {};
  deals.forEach((d) => {
    if (d.rejectionReason) reasonCounts[d.rejectionReason] = (reasonCounts[d.rejectionReason] || 0) + 1;
  });

  document.getElementById("pipeline-content").innerHTML = `
    <div class="pipe-toolbar">
      <h2 style="margin:0">Deal Pipeline</h2>
      <button class="btn btn-primary" id="pipe-new-deal-btn">+ New Deal</button>
    </div>
    <div class="ticker">
      <div class="ticker-cell"><div class="ticker-label">Total Deals</div><div class="ticker-value">${deals.length}</div></div>
      <div class="ticker-cell"><div class="ticker-label">Active</div><div class="ticker-value neutral">${active}</div></div>
      <div class="ticker-cell"><div class="ticker-label">Invested</div><div class="ticker-value up">${invested}</div></div>
      <div class="ticker-cell"><div class="ticker-label">Rejected</div><div class="ticker-value down">${rejected}</div></div>
      <div class="ticker-cell"><div class="ticker-label">On Hold</div><div class="ticker-value">${onhold}</div></div>
      <div class="ticker-cell"><div class="ticker-label">Avg EBITDA Margin</div><div class="ticker-value">${avgMargin}${avgMargin !== "—" ? "%" : ""}</div></div>
    </div>

    <div class="panel">
      <div class="panel-title">Funnel Stage Distribution</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px">
        ${stageCounts
          .map(
            (s, i) => `
          <div style="border:1px solid var(--border-soft);padding:12px;background:var(--bg-elevated)">
            <div style="font-size:9px;color:var(--accent);font-family:var(--mono)">${String(i + 1).padStart(2, "0")}</div>
            <div style="font-size:11px;font-weight:700;margin:6px 0;min-height:28px">${escHtml(s.stage.replace(/^\d+\.\s*/, ""))}</div>
            <div style="font-family:var(--mono);font-size:20px;font-weight:800">${s.count}</div>
            <div class="chart-track" style="margin-top:8px"><span style="width:${Math.max(4, (s.count / maxStage) * 100)}%"></span></div>
          </div>`
          )
          .join("")}
      </div>
    </div>

    <div class="two-col">
      <div class="panel"><div class="panel-title">Sector Exposure</div>${barsHtml(sectorCounts) || '<div class="pipe-empty">No sector data yet.</div>'}</div>
      <div class="panel"><div class="panel-title">Rejection Signals</div>${barsHtml(reasonCounts) || '<div class="pipe-empty">No rejections recorded yet.</div>'}</div>
    </div>

    <div class="panel">
      <div class="panel-title">Deal Console</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">
        <input type="text" id="pipe-search" placeholder="Search company, sector, notes…" style="flex:1;min-width:220px;background:var(--bg-elevated);border:1px solid var(--border-soft);color:var(--text);padding:9px 12px;font-size:12.5px"/>
        <select id="pipe-filter-stage" style="background:var(--bg-elevated);border:1px solid var(--border-soft);color:var(--text);padding:9px 12px;font-size:12.5px"><option value="">All stages</option>${stages.map((s) => `<option value="${escHtml(s)}">${escHtml(s)}</option>`).join("")}</select>
        <select id="pipe-filter-status" style="background:var(--bg-elevated);border:1px solid var(--border-soft);color:var(--text);padding:9px 12px;font-size:12.5px"><option value="">All statuses</option>${pipelineData.statuses.map((s) => `<option value="${escHtml(s)}">${escHtml(s)}</option>`).join("")}</select>
      </div>
      <div style="overflow-x:auto"><table class="grid" id="pipe-table"><thead><tr><th>Company</th><th>Sector</th><th>Strategy</th><th class="num">Revenue (Cr)</th><th class="num">EBITDA (Cr)</th><th class="num">Margin</th><th>Stage</th><th>Status</th></tr></thead><tbody id="pipe-table-body"></tbody></table></div>
    </div>
  `;
  renderPipelineTable();
  document.getElementById("pipe-search").addEventListener("input", renderPipelineTable);
  document.getElementById("pipe-filter-stage").addEventListener("change", renderPipelineTable);
  document.getElementById("pipe-filter-status").addEventListener("change", renderPipelineTable);
  document.getElementById("pipe-new-deal-btn").addEventListener("click", openNewDealModal);
}

function renderPipelineTable() {
  const term = (document.getElementById("pipe-search").value || "").toLowerCase();
  const stageFilter = document.getElementById("pipe-filter-stage").value;
  const statusFilter = document.getElementById("pipe-filter-status").value;
  const rows = pipelineData.deals.filter((d) => {
    if (stageFilter && d.stage !== stageFilter) return false;
    if (statusFilter && d.status !== statusFilter) return false;
    if (term) {
      const hay = [d.companyName, d.sector, d.notes].filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(term)) return false;
    }
    return true;
  });
  document.getElementById("pipe-table-body").innerHTML =
    rows
      .map((d) => {
        const statusClass = d.status === "Invested" ? "up" : d.status === "Rejected" ? "down" : d.status === "On Hold" ? "" : "neutral";
        return `<tr class="pipe-row" data-id="${d.id}" style="cursor:pointer">
        <td class="co-name">${escHtml(d.companyName)}</td>
        <td>${escHtml(d.sector || "—")}</td>
        <td>${d.strategy ? `<span class="badge badge-neutral">${escHtml(d.strategy.replace(/_/g, " "))}</span>` : "—"}</td>
        <td class="num">${d.financials?.revenueCr ?? "—"}</td>
        <td class="num">${d.financials?.ebitdaCr ?? "—"}</td>
        <td class="num">${d.financials?.ebitdaMarginPct != null ? d.financials.ebitdaMarginPct + "%" : "—"}</td>
        <td><span class="badge badge-neutral">${escHtml((d.stage || "").replace(/^\d+\.\s*/, ""))}</span></td>
        <td class="${statusClass}" style="font-family:var(--mono)">● ${escHtml(d.status)}</td>
      </tr>`;
      })
      .join("") || '<tr><td colspan="8" class="pipe-empty">No deals match.</td></tr>';
  document.querySelectorAll(".pipe-row").forEach((row) => row.addEventListener("click", () => openDealModal(row.dataset.id)));
}

/* ---------- New deal modal ---------- */
function openNewDealModal() {
  document.getElementById("nd-name").value = "";
  document.getElementById("nd-sector").value = "";
  document.getElementById("nd-size").value = "";
  document.getElementById("nd-strategy").value = "growth_equity";
  document.getElementById("new-deal-overlay").classList.add("show");
}
document.getElementById("new-deal-close").addEventListener("click", () => document.getElementById("new-deal-overlay").classList.remove("show"));
document.getElementById("nd-create").addEventListener("click", async () => {
  const companyName = document.getElementById("nd-name").value.trim();
  if (!companyName) return;
  const sector = document.getElementById("nd-sector").value.trim();
  const dealSize = document.getElementById("nd-size").value.trim();
  const strategy = document.getElementById("nd-strategy").value;
  const { deal } = await apiFetch("/api/pipeline/deals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyName, sector, dealSize, strategy }) });
  document.getElementById("new-deal-overlay").classList.remove("show");
  await loadPipeline();
  openDealModal(deal.id);
});

/* ---------- Deal workspace modal ---------- */
let activeDealId = null;
function openDealModal(id) {
  const deal = pipelineData.deals.find((d) => d.id === id);
  if (!deal) return;
  activeDealId = id;
  document.getElementById("deal-modal-title").textContent = deal.companyName;
  document.getElementById("dm-name").value = deal.companyName || "";
  document.getElementById("dm-sector").value = deal.sector || "";
  document.getElementById("dm-size").value = deal.dealSize || "";
  document.getElementById("dm-notes").value = deal.notes || "";
  document.getElementById("dm-stage").innerHTML = pipelineData.stages.map((s) => `<option value="${escHtml(s)}" ${s === deal.stage ? "selected" : ""}>${escHtml(s)}</option>`).join("");
  document.getElementById("dm-status").innerHTML = pipelineData.statuses.map((s) => `<option value="${escHtml(s)}" ${s === deal.status ? "selected" : ""}>${escHtml(s)}</option>`).join("");
  document.getElementById("dm-strategy").value = deal.strategy || "growth_equity";

  const artifacts = [];
  if (deal.screening) {
    artifacts.push(`<div class="artifact-row"><span>Screening — grade ${escHtml(deal.screening.grade)} (${deal.screening.overallRating}/100)</span></div>`);
  }
  if (deal.evaluation) {
    const links = [];
    if (deal.evaluation.icNoteDocPath) links.push(`<a href="/api/download?path=${encodeURIComponent(deal.evaluation.icNoteDocPath)}">IC Note</a>`);
    if (deal.evaluation.modelXlsxPath) links.push(`<a href="/api/download?path=${encodeURIComponent(deal.evaluation.modelXlsxPath)}">Model</a>`);
    artifacts.push(`<div class="artifact-row"><span>Evaluation — ${escHtml(deal.evaluation.recommendation || "")}</span><span>${links.join(" · ")}</span></div>`);
  }
  (deal.documentation || []).forEach((doc) => {
    const link = doc.redlinedDocPath ? `<a href="/api/download?path=${encodeURIComponent(doc.redlinedDocPath)}">Redlined copy</a>` : "";
    artifacts.push(`<div class="artifact-row"><span>${escHtml(doc.fileName)} — ${escHtml(doc.overallRiskGrade || "")}</span><span>${link}</span></div>`);
  });
  document.getElementById("dm-artifacts").innerHTML = artifacts.join("") || '<div class="pipe-empty">No analysis yet.</div>';

  document.getElementById("deal-overlay").classList.add("show");
}
document.getElementById("deal-modal-close").addEventListener("click", () => document.getElementById("deal-overlay").classList.remove("show"));

document.getElementById("dm-save").addEventListener("click", async () => {
  if (!activeDealId) return;
  const patch = {
    companyName: document.getElementById("dm-name").value.trim(),
    sector: document.getElementById("dm-sector").value.trim(),
    dealSize: document.getElementById("dm-size").value.trim(),
    stage: document.getElementById("dm-stage").value,
    status: document.getElementById("dm-status").value,
    strategy: document.getElementById("dm-strategy").value,
    notes: document.getElementById("dm-notes").value,
  };
  await apiFetch(`/api/pipeline/deals?id=${encodeURIComponent(activeDealId)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
  document.getElementById("deal-overlay").classList.remove("show");
  await loadPipeline();
});

document.getElementById("dm-delete").addEventListener("click", async () => {
  if (!activeDealId) return;
  if (!confirm("Delete this deal and all its saved analysis? This cannot be undone.")) return;
  await apiFetch(`/api/pipeline/deals?id=${encodeURIComponent(activeDealId)}`, { method: "DELETE" });
  document.getElementById("deal-overlay").classList.remove("show");
  await loadPipeline();
});

document.querySelectorAll("#dm-actions .action-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const action = btn.dataset.action;
    const deal = pipelineData.deals.find((d) => d.id === activeDealId);
    document.getElementById("deal-overlay").classList.remove("show");
    if (!deal) return;
    if (action === "screening") {
      switchView("screening");
      document.getElementById("scr-company").value = deal.companyName;
    }
    if (action === "evaluation") {
      switchView("evaluation");
      document.getElementById("ev-company").value = deal.companyName;
    }
    if (action === "documentation") {
      switchView("documentation");
      document.getElementById("doc-company").value = deal.companyName;
    }
  });
});

/* ---------- Shared: deal picker ---------- */
async function loadDealPicker(selectId) {
  const { deals } = await apiFetch("/api/pipeline/deals");
  const sel = document.getElementById(selectId);
  const previous = sel.value;
  sel.innerHTML = deals.map((d) => `<option value="${d.id}">${escHtml(d.companyName)}</option>`).join("") || `<option value="">No deals yet</option>`;
  if (deals.some((d) => d.id === previous)) sel.value = previous;
  return deals;
}

/* ---------- IC Decisions ---------- */
async function loadICDecisionsTab() {
  await loadDealPicker("ic-deal");
  await refreshICMemoranda();
  await refreshICDecisionsList();
  await refreshMilestones();
}
document.getElementById("ic-deal").addEventListener("change", async () => {
  await refreshICMemoranda();
  await refreshICDecisionsList();
  await refreshMilestones();
});

async function refreshICMemoranda() {
  const dealId = document.getElementById("ic-deal").value;
  const select = document.getElementById("ic-memo-select");
  if (!dealId) {
    select.innerHTML = '<option value="">None</option>';
    document.getElementById("ic-memo-detail").innerHTML = "";
    return;
  }
  try {
    const { memoranda } = await apiFetch(`/api/ic-memoranda?dealId=${encodeURIComponent(dealId)}`);
    select.innerHTML =
      '<option value="">None</option>' +
      memoranda
        .slice()
        .sort((a, b) => b.memoVersion - a.memoVersion)
        .map((m) => `<option value="${m.id}">v${m.memoVersion} — ${escHtml(m.status)}</option>`)
        .join("");
    renderMemoDetail(memoranda.find((m) => m.id === select.value));
  } catch (e) {
    document.getElementById("ic-memo-detail").innerHTML = errorHtml(e.message);
  }
}
document.getElementById("ic-memo-select").addEventListener("change", async () => {
  const dealId = document.getElementById("ic-deal").value;
  if (!dealId) return;
  const { memoranda } = await apiFetch(`/api/ic-memoranda?dealId=${encodeURIComponent(dealId)}`);
  renderMemoDetail(memoranda.find((m) => m.id === document.getElementById("ic-memo-select").value));
});
function renderMemoDetail(memo) {
  const el = document.getElementById("ic-memo-detail");
  if (!memo) {
    el.innerHTML = "";
    return;
  }
  const sections = Object.entries(memo.sections || {})
    .map(([key, text]) => `<div class="section-label">${escHtml(key.replace(/([A-Z])/g, " $1"))}</div><p class="sub">${escHtml(text)}</p>`)
    .join("");
  el.innerHTML = sections || '<p class="sub">No sections recorded.</p>';
}

document.getElementById("ic-decision").addEventListener("change", () => {
  document.getElementById("ic-conditions-field").style.display = document.getElementById("ic-decision").value === "approve_with_conditions" ? "" : "none";
});
document.getElementById("ic-add-condition-btn").addEventListener("click", () => {
  const row = document.createElement("div");
  row.style.cssText = "display:flex;gap:8px;margin-bottom:8px";
  row.innerHTML = `<input type="text" class="ic-condition-input" placeholder="Condition to satisfy…" style="flex:1;background:var(--bg-elevated);border:1px solid var(--border-soft);color:var(--text);padding:7px 10px;font-size:12.5px"/><button class="btn btn-danger btn-sm ic-remove-condition" type="button">✕</button>`;
  document.getElementById("ic-conditions-rows").appendChild(row);
  row.querySelector(".ic-remove-condition").addEventListener("click", () => row.remove());
});

async function refreshICDecisionsList() {
  const dealId = document.getElementById("ic-deal").value;
  if (!dealId) {
    document.getElementById("ic-decisions-result").innerHTML = "";
    return;
  }
  try {
    const { decisions } = await apiFetch(`/api/ic-decisions?dealId=${encodeURIComponent(dealId)}`);
    renderICDecisionsList(decisions);
  } catch (e) {
    document.getElementById("ic-decisions-result").innerHTML = errorHtml(e.message);
  }
}
function renderICDecisionsList(decisions) {
  const rows =
    decisions
      .slice()
      .sort((a, b) => b.decidedAt - a.decidedAt)
      .map((d) => {
        const conditions =
          (d.conditions || [])
            .map(
              (c) =>
                `<div class="artifact-row"><span><span class="badge badge-${c.status === "open" ? "neutral" : "success"}">${escHtml(c.status)}</span> ${escHtml(c.condition)}</span>${
                  c.status === "open"
                    ? `<span><button class="btn btn-sm ic-resolve-condition" type="button" data-condition-id="${c.id}" data-resolve="satisfied">Satisfied</button> <button class="btn btn-sm ic-resolve-condition" type="button" data-condition-id="${c.id}" data-resolve="waived">Waived</button></span>`
                    : ""
                }</div>`
            )
            .join("") || "";
        return `<div class="artifact-row">
        <span><span class="badge badge-neutral">${escHtml(d.decision.replace(/_/g, " "))}</span> decided by ${escHtml((d.decidedBy || []).join(", "))}</span>
        <span>${escHtml(new Date(d.decidedAt).toLocaleDateString())}</span>
      </div>
      ${d.rationale ? `<div class="sub" style="margin:2px 0 10px">${escHtml(d.rationale)}</div>` : ""}
      ${conditions}`;
      })
      .join("") || '<div class="pipe-empty">No decisions recorded yet.</div>';
  document.getElementById("ic-decisions-result").innerHTML = `<div class="panel"><div class="panel-title">Decision History</div>${rows}</div>`;

  document.querySelectorAll(".ic-resolve-condition").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await apiFetch(`/api/approval-conditions?id=${encodeURIComponent(btn.dataset.conditionId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: btn.dataset.resolve }),
        });
        await refreshICDecisionsList();
      } catch (e) {
        document.getElementById("ic-decisions-result").innerHTML += errorHtml(e.message);
      }
    });
  });
}
document.getElementById("ic-record-btn").addEventListener("click", async () => {
  const dealId = document.getElementById("ic-deal").value;
  if (!dealId) return;
  const decision = document.getElementById("ic-decision").value;
  const decidedBy = document
    .getElementById("ic-decided-by")
    .value.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const rationale = document.getElementById("ic-rationale").value.trim();
  const icMemorandumId = document.getElementById("ic-memo-select").value || undefined;
  const conditions = Array.from(document.querySelectorAll(".ic-condition-input"))
    .map((i) => i.value.trim())
    .filter(Boolean);
  const btn = document.getElementById("ic-record-btn");
  btn.disabled = true;
  try {
    await apiFetch("/api/ic-decisions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dealId, decision, decidedBy, rationale, icMemorandumId, conditions }),
    });
    document.getElementById("ic-decided-by").value = "";
    document.getElementById("ic-rationale").value = "";
    document.getElementById("ic-conditions-rows").innerHTML = "";
    await refreshICMemoranda();
    await refreshICDecisionsList();
  } catch (e) {
    document.getElementById("ic-decisions-result").innerHTML = errorHtml(e.message);
  } finally {
    btn.disabled = false;
  }
});

/* ---------- Transaction Milestones ---------- */
async function refreshMilestones() {
  const dealId = document.getElementById("ic-deal").value;
  if (!dealId) {
    document.getElementById("ms-list").innerHTML = "";
    return;
  }
  try {
    const { milestones } = await apiFetch(`/api/milestones?dealId=${encodeURIComponent(dealId)}`);
    renderMilestones(milestones);
  } catch (e) {
    document.getElementById("ms-list").innerHTML = errorHtml(e.message);
  }
}
function renderMilestones(milestones) {
  const html =
    milestones
      .map((m) => {
        const statusClass = m.status === "complete" ? "success" : m.status === "at_risk" ? "high" : "neutral";
        const actions =
          m.status !== "complete"
            ? `<button class="btn btn-sm ms-set-status" type="button" data-id="${m.id}" data-status="complete">Mark Complete</button> <button class="btn btn-sm ms-set-status" type="button" data-id="${m.id}" data-status="at_risk">Mark At Risk</button>`
            : "";
        return `<div class="artifact-row">
          <span><span class="badge badge-${statusClass}">${escHtml(m.status.replace(/_/g, " "))}</span> ${escHtml(m.milestone.replace(/_/g, " "))}${m.targetDate ? " · target " + escHtml(m.targetDate) : ""}${m.actualDate ? " · actual " + escHtml(m.actualDate) : ""}</span>
          <span>${actions}</span>
        </div>`;
      })
      .join("") || '<div class="pipe-empty">No milestones tracked yet.</div>';
  document.getElementById("ms-list").innerHTML = html;
  document.querySelectorAll(".ms-set-status").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await apiFetch(`/api/milestones?id=${encodeURIComponent(btn.dataset.id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: btn.dataset.status }),
        });
        await refreshMilestones();
      } catch (e) {
        document.getElementById("ms-list").innerHTML += errorHtml(e.message);
      }
    });
  });
}
document.getElementById("ms-add-btn").addEventListener("click", async () => {
  const dealId = document.getElementById("ic-deal").value;
  if (!dealId) return;
  const milestone = document.getElementById("ms-type").value;
  const targetDate = document.getElementById("ms-target-date").value || undefined;
  try {
    await apiFetch("/api/milestones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dealId, milestone, targetDate }),
    });
    await refreshMilestones();
  } catch (e) {
    document.getElementById("ms-list").innerHTML = errorHtml(e.message);
  }
});

/* ---------- Cap Table / VC ---------- */
const CAP_TABLE_HOLDER_TYPES = ["founder", "employee_pool", "investor", "sponsor", "management_rollover", "other"];
let capTableRows = [];

async function loadCapTableTab() {
  await loadDealPicker("ct-deal");
  document.getElementById("ct-asof").value = new Date().toISOString().slice(0, 10);
  capTableRows = [{ holder: "Founders", holderType: "founder", ownershipPct: 100 }];
  renderCapTableRows();
  await refreshSavedCapTables();
}
document.getElementById("ct-deal").addEventListener("change", refreshSavedCapTables);

function renderCapTableRows() {
  document.getElementById("ct-rows").innerHTML = capTableRows
    .map(
      (r, i) => `<div style="display:flex;gap:8px;align-items:end;margin-bottom:8px" data-row-idx="${i}">
      <div class="field" style="flex:2;margin:0"><label>Holder</label><input type="text" class="ct-holder" value="${escHtml(r.holder)}"/></div>
      <div class="field" style="flex:2;margin:0"><label>Type</label>
        <select class="ct-holderType">${CAP_TABLE_HOLDER_TYPES.map((t) => `<option value="${t}" ${t === r.holderType ? "selected" : ""}>${t.replace(/_/g, " ")}</option>`).join("")}</select>
      </div>
      <div class="field" style="flex:1;margin:0"><label>Ownership %</label><input type="number" step="0.01" class="ct-pct" value="${r.ownershipPct}"/></div>
      <button class="btn btn-danger btn-sm ct-remove-row" type="button" style="margin-bottom:2px">✕</button>
    </div>`
    )
    .join("");
  document.querySelectorAll("#ct-rows .ct-holder, #ct-rows .ct-holderType, #ct-rows .ct-pct").forEach((el) => el.addEventListener("input", onCapTableRowEdited));
  document.querySelectorAll("#ct-rows .ct-remove-row").forEach((btn) =>
    btn.addEventListener("click", (e) => {
      const idx = Number(e.target.closest("[data-row-idx]").dataset.rowIdx);
      capTableRows.splice(idx, 1);
      renderCapTableRows();
    })
  );
  updateCapTableSumHint();
}
function onCapTableRowEdited(e) {
  const idx = Number(e.target.closest("[data-row-idx]").dataset.rowIdx);
  const rowEl = document.querySelector(`#ct-rows [data-row-idx="${idx}"]`);
  capTableRows[idx] = {
    holder: rowEl.querySelector(".ct-holder").value,
    holderType: rowEl.querySelector(".ct-holderType").value,
    ownershipPct: parseFloat(rowEl.querySelector(".ct-pct").value) || 0,
  };
  updateCapTableSumHint();
}
function updateCapTableSumHint() {
  const total = capTableRows.reduce((s, r) => s + (Number(r.ownershipPct) || 0), 0);
  const hint = document.getElementById("ct-sum-hint");
  hint.textContent = `Total: ${total.toFixed(2)}%`;
  hint.style.color = Math.abs(total - 100) <= 0.25 ? "var(--success)" : "var(--danger)";
}
document.getElementById("ct-add-row").addEventListener("click", () => {
  capTableRows.push({ holder: "", holderType: "investor", ownershipPct: 0 });
  renderCapTableRows();
});

async function refreshSavedCapTables() {
  const dealId = document.getElementById("ct-deal").value;
  if (!dealId) {
    document.getElementById("captable-result").innerHTML = "";
    return;
  }
  try {
    const { capTables } = await apiFetch(`/api/cap-tables?dealId=${encodeURIComponent(dealId)}`);
    renderSavedCapTables(capTables);
  } catch (e) {
    document.getElementById("captable-result").innerHTML = errorHtml(e.message);
  }
}
function renderSavedCapTables(tables) {
  if (!tables.length) {
    document.getElementById("captable-result").innerHTML = '<div class="panel"><div class="panel-title">Saved Cap Tables</div><div class="pipe-empty">None saved yet.</div></div>';
    return;
  }
  const html = tables
    .slice()
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map(
      (t) => `<div class="panel">
      <div class="panel-title">As of ${escHtml(t.asOfDate)}</div>
      <table class="grid"><thead><tr><th>Holder</th><th>Type</th><th class="num">Ownership %</th></tr></thead><tbody>
        ${t.rows.map((r) => `<tr><td>${escHtml(r.holder)}</td><td>${escHtml((r.holderType || "").replace(/_/g, " "))}</td><td class="num">${r.ownershipPct}</td></tr>`).join("")}
      </tbody></table>
    </div>`
    )
    .join("");
  document.getElementById("captable-result").innerHTML = html;
}
document.getElementById("ct-save-btn").addEventListener("click", async () => {
  const dealId = document.getElementById("ct-deal").value;
  if (!dealId) return;
  const asOfDate = document.getElementById("ct-asof").value;
  const btn = document.getElementById("ct-save-btn");
  btn.disabled = true;
  try {
    await apiFetch("/api/cap-tables", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dealId, asOfDate, rows: capTableRows }),
    });
    await refreshSavedCapTables();
  } catch (e) {
    document.getElementById("captable-result").innerHTML = errorHtml(e.message);
  } finally {
    btn.disabled = false;
  }
});

document.getElementById("dil-run-btn").addEventListener("click", async () => {
  const preMoneyM = parseFloat(document.getElementById("dil-premoney").value) || 0;
  const newInvestmentM = parseFloat(document.getElementById("dil-investment").value) || 0;
  try {
    const result = await apiFetch("/api/cap-tables/dilution", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ existingRows: capTableRows, preMoneyM, newInvestmentM }),
    });
    document.getElementById("dilution-result").innerHTML = `
      <div class="ticker">
        <div class="ticker-cell"><div class="ticker-label">Post-Money ($M)</div><div class="ticker-value">${result.postMoneyM.toFixed(2)}</div></div>
        <div class="ticker-cell"><div class="ticker-label">New Investor %</div><div class="ticker-value">${result.newInvestorPct.toFixed(2)}%</div></div>
      </div>
      <table class="grid"><thead><tr><th>Holder</th><th class="num">Diluted Ownership %</th></tr></thead><tbody>
        ${result.updatedRows.map((r) => `<tr><td>${escHtml(r.holder)}</td><td class="num">${r.ownershipPct.toFixed(2)}</td></tr>`).join("")}
        <tr><td><strong>New Investor</strong></td><td class="num">${result.newInvestorPct.toFixed(2)}</td></tr>
      </tbody></table>
    `;
  } catch (e) {
    document.getElementById("dilution-result").innerHTML = errorHtml(e.message);
  }
});

/* ---------- Portfolio ---------- */
const EXIT_ROUTES = ["strategic_sale", "sponsor_to_sponsor", "ipo", "secondary", "write_off", "other"];
let activePortfolioInvestmentId = null;

async function loadPortfolioTab() {
  await loadDealPicker("pf-deal");
  document.getElementById("pf-invested-at").value = new Date().toISOString().slice(0, 10);
  await refreshPortfolioTable();
}

async function refreshPortfolioTable() {
  try {
    const { investments } = await apiFetch("/api/portfolio/investments");
    renderPortfolioTable(investments);
  } catch (e) {
    document.getElementById("pf-table-body").innerHTML = `<tr><td colspan="5">${errorHtml(e.message)}</td></tr>`;
  }
}
function renderPortfolioTable(investments) {
  document.getElementById("pf-table-body").innerHTML =
    investments
      .map(
        (inv) => `<tr class="pipe-row" data-id="${inv.id}" style="cursor:pointer">
        <td class="co-name">${escHtml(inv.companyName || "—")}</td>
        <td>${inv.strategy ? `<span class="badge badge-neutral">${escHtml(inv.strategy.replace(/_/g, " "))}</span>` : "—"}</td>
        <td class="num">${inv.investedM}</td>
        <td class="num">${inv.ownershipPct}</td>
        <td>${escHtml(inv.status)}</td>
      </tr>`
      )
      .join("") || '<tr><td colspan="5" class="pipe-empty">No portfolio investments yet.</td></tr>';
  document.querySelectorAll("#pf-table-body .pipe-row").forEach((row) => row.addEventListener("click", () => loadPortfolioDetail(row.dataset.id)));
}

document.getElementById("pf-add-btn").addEventListener("click", async () => {
  const dealId = document.getElementById("pf-deal").value;
  if (!dealId) return;
  const investedAt = document.getElementById("pf-invested-at").value;
  const investedM = parseFloat(document.getElementById("pf-invested-m").value) || 0;
  const ownershipPct = parseFloat(document.getElementById("pf-ownership-pct").value) || 0;
  const btn = document.getElementById("pf-add-btn");
  btn.disabled = true;
  try {
    const { investment } = await apiFetch("/api/portfolio/investments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dealId, investedM, ownershipPct, investedAt }),
    });
    await refreshPortfolioTable();
    await loadPortfolioDetail(investment.id);
  } catch (e) {
    document.getElementById("pf-detail").innerHTML = errorHtml(e.message);
  } finally {
    btn.disabled = false;
  }
});

async function loadPortfolioDetail(id) {
  activePortfolioInvestmentId = id;
  try {
    const detail = await apiFetch(`/api/portfolio/detail?portfolioInvestmentId=${encodeURIComponent(id)}`);
    renderPortfolioDetail(detail);
  } catch (e) {
    document.getElementById("pf-detail").innerHTML = errorHtml(e.message);
  }
}

function renderPortfolioDetail({ investment, kpis, followOnDecisions, exitScenarios, realisedProceeds }) {
  const kpiRows =
    kpis.map((k) => `<tr><td>${escHtml(k.period)}</td><td>${escHtml(k.kpi)}</td><td class="num">${k.value}</td><td class="num">${k.targetValue ?? "—"}</td></tr>`).join("") ||
    '<tr><td colspan="4" class="pipe-empty">No KPIs recorded yet.</td></tr>';

  const followOnRows =
    followOnDecisions
      .map(
        (f) =>
          `<div class="artifact-row"><span><span class="badge badge-neutral">${escHtml(f.decision.replace(/_/g, " "))}</span> decided by ${escHtml((f.decidedBy || []).join(", "))}${f.amountM != null ? ` · $${f.amountM}M` : ""}</span><span>${escHtml(new Date(f.decidedAt).toLocaleDateString())}</span></div>`
      )
      .join("") || '<div class="pipe-empty">No follow-on decisions yet.</div>';

  const exitRows =
    exitScenarios
      .map(
        (s) =>
          `<tr><td>${escHtml(s.scenario)}</td><td>${escHtml(s.exitRoute.replace(/_/g, " "))}</td><td class="num">${s.exitYear ?? "—"}</td><td class="num">${s.expectedProceedsM ?? "—"}</td><td class="num">${s.expectedIrr != null ? s.expectedIrr.toFixed(1) + "%" : "—"}</td><td class="num">${s.expectedMoic != null ? s.expectedMoic.toFixed(2) + "x" : "—"}</td></tr>`
      )
      .join("") || '<tr><td colspan="6" class="pipe-empty">No exit scenarios modeled yet.</td></tr>';

  const proceedsRows =
    realisedProceeds
      .map(
        (r) =>
          `<tr><td>${escHtml(r.exitDate)}</td><td>${escHtml(r.exitRoute.replace(/_/g, " "))}</td><td class="num">${r.grossProceedsM}</td><td class="num">${r.realizedIrr.toFixed(1)}%</td><td class="num">${r.realizedMoic.toFixed(2)}x</td></tr>`
      )
      .join("") || '<tr><td colspan="5" class="pipe-empty">Not yet exited.</td></tr>';

  const exitRouteOptions = EXIT_ROUTES.map((r) => `<option value="${r}">${r.replace(/_/g, " ")}</option>`).join("");

  document.getElementById("pf-detail").innerHTML = `
    <div class="panel">
      <div class="panel-title">${escHtml(investment.status)} · Invested $${investment.investedM}M for ${investment.ownershipPct}%</div>

      <div class="section-label">KPIs</div>
      <table class="grid"><thead><tr><th>Period</th><th>KPI</th><th class="num">Value</th><th class="num">Target</th></tr></thead><tbody>${kpiRows}</tbody></table>
      <div class="two-col" style="margin-top:8px">
        <div class="field" style="margin:0"><label>Period</label><input type="text" id="pf-kpi-period" placeholder="e.g. 2026-Q2"/></div>
        <div class="field" style="margin:0"><label>KPI name</label><input type="text" id="pf-kpi-name" placeholder="e.g. ARR"/></div>
      </div>
      <div class="two-col" style="margin:8px 0">
        <div class="field" style="margin:0"><label>Value</label><input type="number" id="pf-kpi-value" step="0.01"/></div>
        <div class="field" style="margin:0"><label>Target (optional)</label><input type="number" id="pf-kpi-target" step="0.01"/></div>
      </div>
      <button class="btn btn-sm" id="pf-kpi-add" type="button">+ Add KPI</button>

      <div class="section-label" style="margin-top:18px">Follow-On Decisions</div>
      ${followOnRows}
      <div class="two-col" style="margin-top:8px">
        <div class="field" style="margin:0"><label>Decision</label>
          <select id="pf-fo-decision">
            <option value="participate_pro_rata">Participate Pro Rata</option>
            <option value="participate_super_pro_rata">Participate Super Pro Rata</option>
            <option value="increase">Increase</option>
            <option value="pass">Pass</option>
          </select>
        </div>
        <div class="field" style="margin:0"><label>Decided by (comma-separated)</label><input type="text" id="pf-fo-decided-by" placeholder="e.g. Priya Shah"/></div>
      </div>
      <div class="two-col" style="margin:8px 0">
        <div class="field" style="margin:0"><label>Amount ($M, optional)</label><input type="number" id="pf-fo-amount" step="0.1"/></div>
        <div class="field" style="margin:0"><label>Rationale (optional)</label><input type="text" id="pf-fo-rationale"/></div>
      </div>
      <button class="btn btn-sm" id="pf-fo-add" type="button">+ Record Follow-On Decision</button>

      <div class="section-label" style="margin-top:18px">Exit Scenarios <span class="hint">(IRR/MOIC computed by the platform, not entered)</span></div>
      <table class="grid"><thead><tr><th>Scenario</th><th>Route</th><th class="num">Exit Yr</th><th class="num">Proceeds ($M)</th><th class="num">IRR</th><th class="num">MOIC</th></tr></thead><tbody>${exitRows}</tbody></table>
      <div class="two-col" style="margin-top:8px">
        <div class="field" style="margin:0"><label>Scenario</label>
          <select id="pf-es-scenario"><option value="bear">Bear</option><option value="base" selected>Base</option><option value="bull">Bull</option></select>
        </div>
        <div class="field" style="margin:0"><label>Exit route</label><select id="pf-es-route">${exitRouteOptions}</select></div>
      </div>
      <div class="two-col" style="margin:8px 0">
        <div class="field" style="margin:0"><label>Exit year</label><input type="number" id="pf-es-year" step="1"/></div>
        <div class="field" style="margin:0"><label>Expected proceeds ($M)</label><input type="number" id="pf-es-proceeds" step="0.1"/></div>
      </div>
      <button class="btn btn-sm" id="pf-es-add" type="button">+ Add Exit Scenario</button>

      <div class="section-label" style="margin-top:18px">Realised Proceeds <span class="hint">(closes the loop — IRR/MOIC computed from real dates)</span></div>
      <table class="grid"><thead><tr><th>Exit Date</th><th>Route</th><th class="num">Gross ($M)</th><th class="num">IRR</th><th class="num">MOIC</th></tr></thead><tbody>${proceedsRows}</tbody></table>
      <div class="two-col" style="margin-top:8px">
        <div class="field" style="margin:0"><label>Exit date</label><input type="date" id="pf-rp-date"/></div>
        <div class="field" style="margin:0"><label>Exit route</label><select id="pf-rp-route">${exitRouteOptions}</select></div>
      </div>
      <div class="two-col" style="margin:8px 0">
        <div class="field" style="margin:0"><label>Gross proceeds ($M)</label><input type="number" id="pf-rp-gross" step="0.1"/></div>
        <div class="field" style="margin:0"><label>Net proceeds ($M, optional)</label><input type="number" id="pf-rp-net" step="0.1"/></div>
      </div>
      <button class="btn btn-primary btn-sm" id="pf-rp-add" type="button">Record Realised Exit</button>
    </div>
  `;

  document.getElementById("pf-kpi-add").addEventListener("click", async () => {
    try {
      await apiFetch("/api/portfolio/kpis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          portfolioInvestmentId: activePortfolioInvestmentId,
          period: document.getElementById("pf-kpi-period").value,
          kpi: document.getElementById("pf-kpi-name").value,
          value: parseFloat(document.getElementById("pf-kpi-value").value) || 0,
          targetValue: document.getElementById("pf-kpi-target").value ? parseFloat(document.getElementById("pf-kpi-target").value) : undefined,
        }),
      });
      await loadPortfolioDetail(activePortfolioInvestmentId);
    } catch (e) {
      document.getElementById("pf-detail").innerHTML += errorHtml(e.message);
    }
  });

  document.getElementById("pf-fo-add").addEventListener("click", async () => {
    const decidedBy = document
      .getElementById("pf-fo-decided-by")
      .value.split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    try {
      await apiFetch("/api/portfolio/follow-on-decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          portfolioInvestmentId: activePortfolioInvestmentId,
          decision: document.getElementById("pf-fo-decision").value,
          decidedBy,
          amountM: document.getElementById("pf-fo-amount").value ? parseFloat(document.getElementById("pf-fo-amount").value) : undefined,
          rationale: document.getElementById("pf-fo-rationale").value || undefined,
        }),
      });
      await loadPortfolioDetail(activePortfolioInvestmentId);
    } catch (e) {
      document.getElementById("pf-detail").innerHTML += errorHtml(e.message);
    }
  });

  document.getElementById("pf-es-add").addEventListener("click", async () => {
    try {
      await apiFetch("/api/portfolio/exit-scenarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          portfolioInvestmentId: activePortfolioInvestmentId,
          scenario: document.getElementById("pf-es-scenario").value,
          exitRoute: document.getElementById("pf-es-route").value,
          exitYear: document.getElementById("pf-es-year").value ? parseInt(document.getElementById("pf-es-year").value, 10) : undefined,
          expectedProceedsM: document.getElementById("pf-es-proceeds").value ? parseFloat(document.getElementById("pf-es-proceeds").value) : undefined,
        }),
      });
      await loadPortfolioDetail(activePortfolioInvestmentId);
    } catch (e) {
      document.getElementById("pf-detail").innerHTML += errorHtml(e.message);
    }
  });

  document.getElementById("pf-rp-add").addEventListener("click", async () => {
    try {
      await apiFetch("/api/portfolio/realised-proceeds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          portfolioInvestmentId: activePortfolioInvestmentId,
          exitDate: document.getElementById("pf-rp-date").value,
          exitRoute: document.getElementById("pf-rp-route").value,
          grossProceedsM: parseFloat(document.getElementById("pf-rp-gross").value) || 0,
          netProceedsM: document.getElementById("pf-rp-net").value ? parseFloat(document.getElementById("pf-rp-net").value) : undefined,
        }),
      });
      await loadPortfolioDetail(activePortfolioInvestmentId);
      await refreshPortfolioTable();
    } catch (e) {
      document.getElementById("pf-detail").innerHTML += errorHtml(e.message);
    }
  });
}

/* ---------- Diligence ---------- */
async function loadDiligenceTab() {
  await loadDealPicker("dl-deal");
  await refreshDiligence();
}
document.getElementById("dl-deal").addEventListener("change", refreshDiligence);

async function refreshDiligence() {
  const dealId = document.getElementById("dl-deal").value;
  if (!dealId) {
    document.getElementById("dl-workstreams").innerHTML = "";
    return;
  }
  try {
    const { workstreams } = await apiFetch(`/api/diligence?dealId=${encodeURIComponent(dealId)}`);
    renderDiligenceWorkstreams(workstreams);
  } catch (e) {
    document.getElementById("dl-workstreams").innerHTML = errorHtml(e.message);
  }
}

document.getElementById("dl-add-ws-btn").addEventListener("click", async () => {
  const dealId = document.getElementById("dl-deal").value;
  const name = document.getElementById("dl-ws-name").value.trim();
  if (!dealId || !name) return;
  const owner = document.getElementById("dl-ws-owner").value.trim();
  const btn = document.getElementById("dl-add-ws-btn");
  btn.disabled = true;
  try {
    await apiFetch("/api/diligence/workstreams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dealId, name, owner: owner || undefined }),
    });
    document.getElementById("dl-ws-name").value = "";
    document.getElementById("dl-ws-owner").value = "";
    await refreshDiligence();
  } catch (e) {
    document.getElementById("dl-workstreams").innerHTML = errorHtml(e.message);
  } finally {
    btn.disabled = false;
  }
});

function renderDiligenceWorkstreams(workstreams) {
  const html = workstreams
    .map((w) => {
      const requestRows =
        (w.requests || [])
          .map((r) => {
            if (r.status === "answered") {
              return `<div class="artifact-row"><span><span class="badge badge-success">answered</span> ${escHtml(r.question)}</span></div><div class="sub" style="margin:2px 0 10px">${escHtml(r.response || "")}</div>`;
            }
            return `<div class="artifact-row" data-request-id="${r.id}">
              <span><span class="badge badge-neutral">${escHtml(r.status)}</span> ${escHtml(r.question)}</span>
            </div>
            <div style="display:flex;gap:8px;margin:4px 0 10px">
              <input type="text" class="dl-answer-input" placeholder="Response…" style="flex:1;background:var(--bg-elevated);border:1px solid var(--border-soft);color:var(--text);padding:7px 10px;font-size:12.5px"/>
              <button class="btn btn-sm dl-answer-btn" type="button" data-request-id="${r.id}">Answer</button>
            </div>`;
          })
          .join("") || '<div class="pipe-empty">No requests yet.</div>';

      return `<div class="panel" data-workstream-id="${w.id}">
        <div class="panel-title">${escHtml(w.name)}${w.owner ? " · " + escHtml(w.owner) : ""} <span class="badge badge-neutral">${escHtml(w.status.replace(/_/g, " "))}</span></div>
        ${requestRows}
        <div style="display:flex;gap:8px;margin-top:8px">
          <input type="text" class="dl-new-question" placeholder="New request/question…" style="flex:1;background:var(--bg-elevated);border:1px solid var(--border-soft);color:var(--text);padding:7px 10px;font-size:12.5px"/>
          <button class="btn btn-sm dl-add-request-btn" type="button" data-workstream-id="${w.id}">+ Add Request</button>
        </div>
      </div>`;
    })
    .join("");
  document.getElementById("dl-workstreams").innerHTML = html || '<div class="panel"><div class="pipe-empty">No workstreams yet.</div></div>';

  document.querySelectorAll(".dl-add-request-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const workstreamId = btn.dataset.workstreamId;
      const input = btn.closest(".panel").querySelector(".dl-new-question");
      const question = input.value.trim();
      if (!question) return;
      btn.disabled = true;
      try {
        await apiFetch("/api/diligence/requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workstreamId, question }),
        });
        await refreshDiligence();
      } catch (e) {
        document.getElementById("dl-workstreams").innerHTML += errorHtml(e.message);
      } finally {
        btn.disabled = false;
      }
    });
  });

  document.querySelectorAll(".dl-answer-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const requestId = btn.dataset.requestId;
      const input = btn.parentElement.querySelector(".dl-answer-input");
      const response = input.value.trim();
      if (!response) return;
      btn.disabled = true;
      try {
        await apiFetch(`/api/diligence/requests?id=${encodeURIComponent(requestId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ response }),
        });
        await refreshDiligence();
      } catch (e) {
        document.getElementById("dl-workstreams").innerHTML += errorHtml(e.message);
      } finally {
        btn.disabled = false;
      }
    });
  });
}

/* ---------- Settings modal ---------- */
document.getElementById("settings-btn").addEventListener("click", openSettings);
document.getElementById("settings-close").addEventListener("click", () => document.getElementById("settings-overlay").classList.remove("show"));

async function openSettings() {
  const [settings, keysRes] = await Promise.all([apiFetch("/api/settings"), apiFetch("/api/api-keys")]);
  document.getElementById("set-provider").value = settings.provider;
  document.getElementById("set-model").value = settings.model;
  document.getElementById("set-baseurl").value = settings.baseUrl || "";
  updateSettingsProviderUI(settings.provider, keysRes.keys);
  document.getElementById("settings-overlay").classList.add("show");
}
function updateSettingsProviderUI(provider, keys) {
  document.getElementById("set-baseurl-field").style.display = provider === "custom" ? "" : "none";
  document.getElementById("set-key-field").style.display = provider === "kilo" ? "none" : "";
  const entry = (keys || []).find((k) => k.provider === provider);
  document.getElementById("set-key-hint").textContent = entry?.hasKey ? `Saved key ending in ${entry.masked}` : "No key saved — required for this provider.";
}
document.getElementById("set-provider").addEventListener("change", async (e) => {
  const keysRes = await apiFetch("/api/api-keys");
  updateSettingsProviderUI(e.target.value, keysRes.keys);
});
document.getElementById("set-save").addEventListener("click", async () => {
  const provider = document.getElementById("set-provider").value;
  const model = document.getElementById("set-model").value.trim();
  const baseUrl = document.getElementById("set-baseurl").value.trim();
  await apiFetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider, model, baseUrl }) });
  const apiKey = document.getElementById("set-apikey").value;
  if (apiKey) {
    await apiFetch("/api/api-keys", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider, apiKey }) });
    document.getElementById("set-apikey").value = "";
  }
  document.getElementById("settings-overlay").classList.remove("show");
});
document.getElementById("set-clear-key").addEventListener("click", async () => {
  const provider = document.getElementById("set-provider").value;
  await apiFetch(`/api/api-keys?provider=${encodeURIComponent(provider)}`, { method: "DELETE" });
  const keysRes = await apiFetch("/api/api-keys");
  updateSettingsProviderUI(provider, keysRes.keys);
});

/* ---------- Theme picker ---------- */
const THEME_STORAGE_KEY = "wrexlyn-investments-theme";
const THEMES = [
  { id: "bloomberg", name: "Bloomberg", sub: "Amber terminal — this app's default", swatch: "#ff9f0a" },
  { id: "default", name: "Default", sub: "Wrexlyn's own cyan", swatch: "#22d3ee" },
  { id: "tech", name: "Tech", sub: "Terminal green", swatch: "#39ff88" },
  { id: "aurora", name: "Aurora", sub: "Purple / teal", swatch: "#a78bfa" },
  { id: "sunset", name: "Sunset", sub: "Orange / pink", swatch: "#fb923c" },
  { id: "midnight", name: "Midnight", sub: "Deep blue", swatch: "#5b8def" },
  { id: "daylight", name: "Daylight", sub: "Light theme", swatch: "#2563eb" },
  { id: "paper", name: "Paper", sub: "Stark white, ink accent", swatch: "#111827" },
  { id: "tactical", name: "Tactical", sub: "HUD cockpit, zero-radius", swatch: "#00f0ff" },
];

function applyTheme(id) {
  document.documentElement.setAttribute("data-theme", id);
  localStorage.setItem(THEME_STORAGE_KEY, id);
  renderThemeList();
}
function renderThemeList() {
  const current = localStorage.getItem(THEME_STORAGE_KEY) || "bloomberg";
  document.getElementById("theme-list").innerHTML = THEMES.map(
    (t) => `<div class="theme-item ${t.id === current ? "active" : ""}" data-theme-id="${t.id}">
      <span class="theme-swatch" style="background:${t.swatch}"></span>
      <span><span class="theme-item-name">${escHtml(t.name)}</span><br/><span class="theme-item-sub">${escHtml(t.sub)}</span></span>
      <span class="theme-item-check">✓</span>
    </div>`
  ).join("");
  document.querySelectorAll(".theme-item").forEach((el) => el.addEventListener("click", () => applyTheme(el.dataset.themeId)));
}
document.getElementById("theme-btn").addEventListener("click", () => {
  renderThemeList();
  document.getElementById("theme-overlay").classList.add("show");
});
document.getElementById("theme-close").addEventListener("click", () => document.getElementById("theme-overlay").classList.remove("show"));

document.getElementById("brand-home").addEventListener("click", () => switchView("pipeline"));

/* ---------- overlay backdrop close ---------- */
document.querySelectorAll(".overlay").forEach((ov) => {
  ov.addEventListener("click", (e) => {
    if (e.target === ov) ov.classList.remove("show");
  });
});
