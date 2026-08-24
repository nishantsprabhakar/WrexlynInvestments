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
  const facts = (r.keyFacts || []).map((f) => `<li>${escHtml(f)}</li>`).join("") || "<li>None</li>";
  const flags = (r.redFlags || []).map((f) => `<li>${escHtml(f)}</li>`).join("") || "<li>None flagged</li>";

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
          `<tr><td>${escHtml(r.risk)}</td><td><span class="badge badge-${(r.severity || "medium").toLowerCase()}">${escHtml(r.severity || "")}</span></td><td>${escHtml(r.mitigant)}</td></tr>`
      )
      .join("") || `<tr><td colspan="3">None identified</td></tr>`;
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
      <table class="grid"><thead><tr><th>Risk</th><th>Severity</th><th>Mitigant</th></tr></thead><tbody>${risks}</tbody></table>

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
              <div class="clause-head"><div class="clause-name">${escHtml(f.flag)}</div><span class="badge badge-${lvl}">${escHtml(lvl)}</span></div>
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
      <div style="overflow-x:auto"><table class="grid" id="pipe-table"><thead><tr><th>Company</th><th>Sector</th><th class="num">Revenue (Cr)</th><th class="num">EBITDA (Cr)</th><th class="num">Margin</th><th>Stage</th><th>Status</th></tr></thead><tbody id="pipe-table-body"></tbody></table></div>
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
        <td class="num">${d.financials?.revenueCr ?? "—"}</td>
        <td class="num">${d.financials?.ebitdaCr ?? "—"}</td>
        <td class="num">${d.financials?.ebitdaMarginPct != null ? d.financials.ebitdaMarginPct + "%" : "—"}</td>
        <td><span class="badge badge-neutral">${escHtml((d.stage || "").replace(/^\d+\.\s*/, ""))}</span></td>
        <td class="${statusClass}" style="font-family:var(--mono)">● ${escHtml(d.status)}</td>
      </tr>`;
      })
      .join("") || '<tr><td colspan="7" class="pipe-empty">No deals match.</td></tr>';
  document.querySelectorAll(".pipe-row").forEach((row) => row.addEventListener("click", () => openDealModal(row.dataset.id)));
}

/* ---------- New deal modal ---------- */
function openNewDealModal() {
  document.getElementById("nd-name").value = "";
  document.getElementById("nd-sector").value = "";
  document.getElementById("nd-size").value = "";
  document.getElementById("new-deal-overlay").classList.add("show");
}
document.getElementById("new-deal-close").addEventListener("click", () => document.getElementById("new-deal-overlay").classList.remove("show"));
document.getElementById("nd-create").addEventListener("click", async () => {
  const companyName = document.getElementById("nd-name").value.trim();
  if (!companyName) return;
  const sector = document.getElementById("nd-sector").value.trim();
  const dealSize = document.getElementById("nd-size").value.trim();
  const { deal } = await apiFetch("/api/pipeline/deals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyName, sector, dealSize }) });
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
