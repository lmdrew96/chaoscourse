import { getConvexClient } from "../../src/lib/convex.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: "invalid_request", error_description: "Body must be JSON" },
      { status: 400, headers: corsHeaders },
    );
  }

  const redirectUris = body?.redirect_uris;
  if (!Array.isArray(redirectUris) || redirectUris.length === 0) {
    return Response.json(
      { error: "invalid_request", error_description: "redirect_uris required" },
      { status: 400, headers: corsHeaders },
    );
  }
  if (!redirectUris.every((u: unknown) => typeof u === "string")) {
    return Response.json(
      { error: "invalid_request", error_description: "redirect_uris must be strings" },
      { status: 400, headers: corsHeaders },
    );
  }

  const convex = getConvexClient();
  const { clientId, clientSecret } = (await convex.mutation(
    "oauth:registerClient" as any,
    {
      redirectUris,
      clientName: typeof body.client_name === "string" ? body.client_name : undefined,
    },
  )) as { clientId: string; clientSecret: string };

  return Response.json(
    {
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uris: redirectUris,
      client_name: body.client_name ?? null,
      token_endpoint_auth_method: "none",
    },
    { status: 201, headers: corsHeaders },
  );
}

export const config = { runtime: "nodejs" };
