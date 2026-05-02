import { getConvexClient } from "../../src/lib/convex.js";
import { verifyClerkToken } from "../../src/lib/clerk.js";

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const auth = req.headers.get("Authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  if (!token) {
    return Response.json(
      { error: "invalid_request", error_description: "Missing Bearer token" },
      { status: 401 },
    );
  }

  const userId = await verifyClerkToken(token);
  if (!userId) {
    return Response.json(
      { error: "invalid_grant", error_description: "Clerk token verification failed" },
      { status: 401 },
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: "invalid_request", error_description: "Body must be JSON" },
      { status: 400 },
    );
  }

  const clientId = body?.client_id;
  const redirectUri = body?.redirect_uri;
  const codeChallenge = body?.code_challenge;
  const state = typeof body?.state === "string" ? body.state : null;

  if (typeof clientId !== "string" || typeof redirectUri !== "string" || typeof codeChallenge !== "string") {
    return Response.json(
      {
        error: "invalid_request",
        error_description: "client_id, redirect_uri, and code_challenge required",
      },
      { status: 400 },
    );
  }

  const convex = getConvexClient();
  const client: any = await convex.query("oauth:getClient" as any, { clientId });
  if (!client || !client.redirectUris.includes(redirectUri)) {
    return Response.json(
      { error: "invalid_client", error_description: "Unknown client or redirect_uri" },
      { status: 400 },
    );
  }

  const code = (await convex.mutation("oauth:createAuthCode" as any, {
    clientId,
    userId,
    redirectUri,
    codeChallenge,
  })) as string;

  return Response.json({ code, redirect_uri: redirectUri, state });
}

export const config = { runtime: "nodejs" };
