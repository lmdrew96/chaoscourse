import { ConvexHttpClient } from "convex/browser";

let client: ConvexHttpClient | null = null;

export const getConvexClient = (): ConvexHttpClient => {
  if (client) return client;
  const url = process.env.CONVEX_URL;
  if (!url) throw new Error("CONVEX_URL is required");
  client = new ConvexHttpClient(url);
  return client;
};
