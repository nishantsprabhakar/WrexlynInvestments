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

import { resolveInRoot } from "./lib/tools/paths";
import { workspaceRootDir } from "./lib/workspace";
import { buildArtifactPreview } from "./lib/artifactPreview";
import { runScreeningFlow } from "./flows/screening";
import { runEvaluationFlow } from "./flows/evaluation";
import { runDocumentationFlow } from "./flows/documentation";
import { listDeals, createDeal, updateDeal, deleteDeal, STAGES, STATUSES } from "./pipeline/store";
import { getSettings, saveSettings } from "./lib/settings";
import { loadApiKey, saveApiKey, clearApiKey, maskApiKey, API_KEY_PROVIDERS, type ApiKeyProvider } from "./lib/apiKeys";

const PORT = Number(process.env.PORT) || 4500;
const PUBLIC_DIR = path.join(__dirname, "..", "..", "public");
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
