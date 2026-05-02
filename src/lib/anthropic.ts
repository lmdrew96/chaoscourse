import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

export const getAnthropicClient = (): Anthropic => {
  if (client) return client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is required");
  client = new Anthropic({ apiKey });
  return client;
};
