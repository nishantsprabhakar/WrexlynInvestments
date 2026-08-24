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
import { loadApiKey, type ApiKeyProvider } from "./apiKeys";

export interface AppSettings {
  provider: LlmProvider;
  model: string;
  baseUrl?: string;
}

const DEFAULT_SETTINGS: AppSettings = { provider: "kilo", model: "kilo-auto/free" };

function settingsPath(): string {
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

export async function getConfiguredLlmConfig(): Promise<LlmConfig> {
  const settings = getSettings();
  if (settings.provider === "kilo") {
    return { provider: "kilo", model: settings.model || "kilo-auto/free" };
  }
  if (settings.provider === "custom") {
    const apiKey = (await loadApiKey("custom")) || undefined;
    return { provider: "custom", model: settings.model, apiKey, baseUrl: settings.baseUrl };
  }
  const apiKey = (await loadApiKey(settings.provider as ApiKeyProvider)) || undefined;
  return { provider: settings.provider, model: settings.model, apiKey };
}
