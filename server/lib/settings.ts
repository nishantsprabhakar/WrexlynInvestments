/**
 * Wrexlyn for Investments — built on Wrexlyn's backend.
 * App-level settings (which LLM provider/model is active). API keys never
 * live here — they stay in secretStore.ts's OS-native storage, shared with
 * the Wrexlyn coding-agent (same service name/base dir), so a key already
 * saved there just works here too with zero extra setup.
 */
import * as fs from "fs";
import * as path from "path";
import type { LlmConfig, LlmProvider } from "./types";
import { loadApiKey, type ApiKeyProvider } from "wrexlyn";

export interface AppSettings {
  provider: LlmProvider;
  model: string;
  baseUrl?: string;
}

const DEFAULT_SETTINGS: AppSettings = { provider: "kilo", model: "kilo-auto/free" };

let testDataDir: string | null = null;
/** Test-only seam so integration tests never read/write the real deployment's data/settings.json. */
export function _setSettingsPathForTesting(dir: string | null): void {
  testDataDir = dir;
}

function settingsPath(): string {
  if (testDataDir) return path.join(testDataDir, "settings.json");
  return path.join(__dirname, "..", "..", "..", "data", "settings.json");
}

export function getSettings(): AppSettings {
  try {
    const filePath = settingsPath();
    if (!fs.existsSync(filePath)) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(fs.readFileSync(filePath, "utf-8")) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(patch: Partial<AppSettings>): AppSettings {
  const current = getSettings();
  const next = { ...current, ...patch };
  const filePath = settingsPath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(next, null, 2), "utf-8");
  return next;
}

// Every investment flow asks for a large structured-JSON response (IC memos, financial models) that
// truncates at Wrexlyn Core's 8000-token default — this was previously a hand-patched fork of 4
// vendored provider files; now it's just the LlmConfig field those providers were extended to accept.
const INVESTMENT_MAX_TOKENS = 16000;

export async function getConfiguredLlmConfig(): Promise<LlmConfig> {
  const settings = getSettings();
  if (settings.provider === "kilo") {
    return { provider: "kilo", model: settings.model || "kilo-auto/free", maxTokens: INVESTMENT_MAX_TOKENS };
  }
  if (settings.provider === "custom") {
    const apiKey = (await loadApiKey("custom")) || undefined;
    return { provider: "custom", model: settings.model, apiKey, baseUrl: settings.baseUrl, maxTokens: INVESTMENT_MAX_TOKENS };
  }
  const apiKey = (await loadApiKey(settings.provider as ApiKeyProvider)) || undefined;
  return { provider: settings.provider, model: settings.model, apiKey, maxTokens: INVESTMENT_MAX_TOKENS };
}
