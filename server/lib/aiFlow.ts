/**
 * Wrexlyn for Investments — built on Wrexlyn's backend.
 * Shared "one structured JSON call" helper used by every flow — mirrors
 * Praevix's proven callAIJson pattern (direct-parse, then strip fences,
 * then extract the outermost {...}), now backed by Wrexlyn's real
 * chatCompletion/provider stack instead of a raw browser fetch.
 */
import { chatCompletion } from "wrexlyn";
import type { ChatMessage } from "./types";
import { getConfiguredLlmConfig } from "./settings";

export function parseJsonLoose(raw: string): any {
  try {
    return JSON.parse(raw);
  } catch {
    /* fall through */
  }
  const cleaned = raw.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    /* fall through */
  }
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch {
      /* fall through */
    }
  }
  throw new Error("The AI did not return valid JSON. Try again, or switch model/provider in Settings.");
}

export async function runStructuredJson(systemPrompt: string, userContent: string): Promise<any> {
  const config = await getConfiguredLlmConfig();
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userContent },
  ];
  const result = await chatCompletion(messages, [], config);
  const raw = result.content;
  if (!raw) throw new Error("Empty response from the AI provider. Please try again.");
  return parseJsonLoose(raw);
}
