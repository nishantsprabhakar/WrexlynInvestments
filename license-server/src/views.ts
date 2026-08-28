/**
 * Wrexlyn for Investments license-server — Copyright (c) 2026 Nishant Prabhakar. All rights reserved.
 * See LICENSE for details.
 *
 * Plain server-rendered HTML templates for the admin dashboard. No frontend
 * framework, matching the main app's own hand-rolled public/*.html style.
 * Every user-supplied field goes through escapeHtml() — see tokens.test.ts
 * for the stored-XSS regression test this depends on.
 */
import { escapeHtml } from "./tokens";

export interface UserRow {
  id: number;
  name: string;
  email: string;
  device_id: string;
  status: string;
  revoke_reason: string | null;
  created_at: string;
  last_seen_at: string | null;
  checkin_count: number;
}

export interface Stats {
  total: number;
  active: number;
  revoked: number;
  activeLast7d: number;
  activeLast30d: number;
}

export interface SparkPoint {
  day: string;
  count: number;
}

export interface LatestRelease {
  commitSha: string;
  downloadUrl: string;
  notes?: string;
}

const PAGE_STYLE = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Inter, system-ui, sans-serif; background: #f6f7f9; color: #161a20; margin: 0; }
  .wrap { max-width: 1080px; margin: 0 auto; padding: 32px 24px 64px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .sub { color: #667080; font-size: 14px; margin: 0 0 28px; }
  .stats { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 24px; }
  .stat { background: #fff; border: 1px solid #dcdfe4; border-radius: 10px; padding: 14px 16px; }
  .stat .n { font-size: 22px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .stat .l { font-size: 12px; color: #667080; text-transform: uppercase; letter-spacing: 0.04em; }
  .spark { display: flex; align-items: flex-end; gap: 2px; height: 40px; margin-bottom: 24px; background: #fff; border: 1px solid #dcdfe4; border-radius: 10px; padding: 10px 12px; }
  .spark .bar { width: 8px; background: #2563eb; border-radius: 2px 2px 0 0; min-height: 2px; }
  table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #dcdfe4; border-radius: 10px; overflow: hidden; }
  th, td { text-align: left; padding: 10px 12px; font-size: 13.5px; border-bottom: 1px solid #ebedf0; }
  th { background: #fafafa; font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.04em; color: #667080; }
  tr:last-child td { border-bottom: none; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11.5px; font-weight: 600; }
  .badge.active { background: rgba(22,163,74,0.12); color: #16a34a; }
  .badge.revoked { background: rgba(220,38,38,0.12); color: #dc2626; }
  form.inline { display: inline; }
  button { font: inherit; cursor: pointer; border-radius: 6px; border: 1px solid #dcdfe4; background: #fff; padding: 5px 10px; font-size: 12.5px; }
  button.danger { color: #dc2626; border-color: rgba(220,38,38,0.3); }
  button.ok { color: #16a34a; border-color: rgba(22,163,74,0.3); }
  input, select { font: inherit; padding: 8px 10px; border-radius: 8px; border: 1px solid #dcdfe4; width: 100%; }
  .toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; gap: 12px; }
  .toolbar input { max-width: 280px; }
  a.export { font-size: 13px; color: #2563eb; text-decoration: none; }
  .err { color: #dc2626; font-size: 13.5px; margin-top: 10px; }
`;

function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(title)}</title>
<style>${PAGE_STYLE}</style>
</head>
<body>${body}</body>
</html>`;
}

export function renderLoginPage(error?: string): string {
  return page(
    "Wrexlyn for Investments Admin — Sign in",
    `<div class="wrap" style="max-width:380px;padding-top:96px;">
      <h1>Wrexlyn for Investments Admin</h1>
      <p class="sub">Sign in to manage registered installs.</p>
      <form method="post" action="/admin/login">
        <input type="password" name="password" placeholder="Admin password" autofocus />
        <div style="margin-top:10px;"><button class="ok" type="submit" style="width:100%;padding:10px;">Sign in</button></div>
      </form>
      ${error ? `<p class="err">${escapeHtml(error)}</p>` : ""}
    </div>`
  );
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

function renderSparkline(points: SparkPoint[]): string {
  const max = Math.max(1, ...points.map((p) => p.count));
  const bars = points
    .map((p) => {
      const heightPct = Math.round((p.count / max) * 100);
      return `<div class="bar" style="height:${Math.max(heightPct, 4)}%" title="${escapeHtml(p.day)}: ${p.count}"></div>`;
    })
    .join("");
  return `<div class="spark">${bars}</div>`;
}

function renderUserRow(user: UserRow): string {
  const isActive = user.status === "active";
  const action = isActive
    ? `<form class="inline" method="post" action="/admin/users/${user.id}/revoke" onsubmit="return confirm('Revoke access for ${escapeHtml(user.name).replace(/'/g, "\\'")}?');">
         <input type="text" name="reason" placeholder="Reason (optional)" style="width:140px;display:inline-block;" />
         <button class="danger" type="submit">Revoke</button>
       </form>`
    : `<form class="inline" method="post" action="/admin/users/${user.id}/restore">
         <button class="ok" type="submit">Restore</button>
       </form>`;
  return `<tr>
    <td>${escapeHtml(user.name)}</td>
    <td>${escapeHtml(user.email)}</td>
    <td><code>${escapeHtml(user.device_id.slice(0, 10))}…</code></td>
    <td><span class="badge ${isActive ? "active" : "revoked"}">${isActive ? "Active" : "Revoked"}</span>${
    !isActive && user.revoke_reason ? ` <span class="sub" style="display:inline">${escapeHtml(user.revoke_reason)}</span>` : ""
  }</td>
    <td>${formatDate(user.created_at)}</td>
    <td>${formatDate(user.last_seen_at)}</td>
    <td>${user.checkin_count}</td>
    <td>${action}</td>
  </tr>`;
}

function renderReleaseCard(release: LatestRelease | null): string {
  const current = release
    ? `<p class="sub" style="margin:0 0 12px;">Currently published: <code>${escapeHtml(release.commitSha.slice(0, 10))}…</code> &mdash; <a href="${escapeHtml(release.downloadUrl)}">${escapeHtml(release.downloadUrl)}</a>${release.notes ? ` &mdash; ${escapeHtml(release.notes)}` : ""}</p>`
    : `<p class="sub" style="margin:0 0 12px;">No release published yet — not read by anything today (wrexlyn-investments has no auto-update client), kept for parity with the ported design.</p>`;
  return `<div class="stat" style="margin-bottom:24px;">
    <div class="l" style="margin-bottom:8px;">Latest release (served from GET /api/version)</div>
    ${current}
    <form method="post" action="/admin/release" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
      <input type="text" name="commitSha" placeholder="Commit SHA" value="${escapeHtml(release?.commitSha ?? "")}" required />
      <input type="text" name="downloadUrl" placeholder="Installer download URL" value="${escapeHtml(release?.downloadUrl ?? "")}" required />
      <input type="text" name="notes" placeholder="Notes (optional)" value="${escapeHtml(release?.notes ?? "")}" style="grid-column:1/-1;" />
      <div style="grid-column:1/-1;"><button class="ok" type="submit">Publish release</button></div>
    </form>
  </div>`;
}

export function renderDashboard(
  stats: Stats,
  users: UserRow[],
  sparkline: SparkPoint[],
  search: string,
  release: LatestRelease | null
): string {
  const rows = users.map(renderUserRow).join("\n");
  return page(
    "Wrexlyn for Investments Admin",
    `<div class="wrap">
      <h1>Wrexlyn for Investments Admin</h1>
      <p class="sub">Registered installs, access, and usage. <a href="/admin/logout">Sign out</a></p>
      ${renderReleaseCard(release)}
      <div class="stats">
        <div class="stat"><div class="n">${stats.total}</div><div class="l">Total</div></div>
        <div class="stat"><div class="n">${stats.active}</div><div class="l">Active</div></div>
        <div class="stat"><div class="n">${stats.revoked}</div><div class="l">Revoked</div></div>
        <div class="stat"><div class="n">${stats.activeLast7d}</div><div class="l">Active 7d</div></div>
        <div class="stat"><div class="n">${stats.activeLast30d}</div><div class="l">Active 30d</div></div>
      </div>
      ${renderSparkline(sparkline)}
      <div class="toolbar">
        <form method="get" action="/admin">
          <input type="text" name="q" placeholder="Search name or email…" value="${escapeHtml(search)}" />
        </form>
        <a class="export" href="/admin/users.csv">Export CSV &rarr;</a>
      </div>
      <table>
        <thead><tr><th>Name</th><th>Email</th><th>Device</th><th>Status</th><th>Registered</th><th>Last seen</th><th>Check-ins</th><th></th></tr></thead>
        <tbody>${rows || `<tr><td colspan="8" class="sub">No users match.</td></tr>`}</tbody>
      </table>
    </div>`
  );
}

export function toCsv(users: UserRow[]): string {
  const header = "name,email,device_id,status,created_at,last_seen_at,checkin_count";
  const escapeCsv = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const rows = users.map((u) =>
    [u.name, u.email, u.device_id, u.status, u.created_at, u.last_seen_at ?? "", u.checkin_count].map(escapeCsv).join(",")
  );
  return [header, ...rows].join("\n");
}
