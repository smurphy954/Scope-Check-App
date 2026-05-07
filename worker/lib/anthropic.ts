import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error(
        "ANTHROPIC_API_KEY is not set on the worker — extraction cannot run.",
      );
    }
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

// Models per the project spec: Opus 4.7 for visual / reasoning-heavy work,
// Haiku 4.5 for fast text extraction.
export const MODELS = {
  vision: "claude-opus-4-7",
  fast: "claude-haiku-4-5",
} as const;
