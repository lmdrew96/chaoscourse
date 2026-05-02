import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createServerForUser } from "../src/mcpServer.js";
import { getConvexClient } from "../src/lib/convex.js";
import { getBaseUrl } from "../src/lib/clerk.js";

const unauthorized = (): Response => {
  const resourceMetadataUrl = `${getBaseUrl()}/.well-known/oauth-protected-resource`;
  return new Response("Unauthorized", {
    status: 401,
    headers: {
      "WWW-Authenticate": `Bearer resource_metadata="${resourceMetadataUrl}"`,
    },
  });
};

const getUserIdFromToken = async (token: string): Promise<string | null> => {
  const convex = getConvexClient();
  return (await convex.query("oauth:getUserIdByToken" as any, { token })) as
    | string
    | null;
};

export default async function handler(req: Request): Promise<Response> {
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null;
  if (!token) return unauthorized();

  const userId = await getUserIdFromToken(token);
  if (!userId) return unauthorized();

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  const server = createServerForUser(userId);
  await server.connect(transport);
  return transport.handleRequest(req);
}

export const config = { runtime: "nodejs" };
