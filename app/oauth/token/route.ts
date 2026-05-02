import { getConvexClient } from "@/src/lib/convex";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const verifyPkce = async (
  codeVerifier: string,
  codeChallenge: string,
): Promise<boolean> => {
  const data = new TextEncoder().encode(codeVerifier);
  const hash = await globalThis.crypto.subtle.digest("SHA-256", data);
  const computed = btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return computed === codeChallenge;
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function POST(req: Request) {
  const body = await req.text();
  const params = new URLSearchParams(body);

  const grantType = params.get("grant_type");
  const code = params.get("code");
  const redirectUri = params.get("redirect_uri");
  const clientId = params.get("client_id");
  const codeVerifier = params.get("code_verifier");

  if (grantType !== "authorization_code") {
    return Response.json(
      { error: "unsupported_grant_type" },
      { status: 400, headers: corsHeaders },
    );
  }
  if (!code || !redirectUri || !clientId || !codeVerifier) {
    return Response.json(
      {
        error: "invalid_request",
        error_description: "Missing required parameters",
      },
      { status: 400, headers: corsHeaders },
    );
  }

  const convex = getConvexClient();
  const record = (await convex.mutation("oauth:consumeAuthCode" as any, {
    code,
  })) as {
    clientId: string;
    userId: string;
    redirectUri: string;
    codeChallenge: string;
  } | null;
  if (!record) {
    return Response.json(
      { error: "invalid_grant", error_description: "Code expired or already used" },
      { status: 400, headers: corsHeaders },
    );
  }

  if (record.clientId !== clientId || record.redirectUri !== redirectUri) {
    return Response.json(
      { error: "invalid_grant", error_description: "Client or redirect mismatch" },
      { status: 400, headers: corsHeaders },
    );
  }

  const pkceValid = await verifyPkce(codeVerifier, record.codeChallenge);
  if (!pkceValid) {
    return Response.json(
      { error: "invalid_grant", error_description: "PKCE verification failed" },
      { status: 400, headers: corsHeaders },
    );
  }

  const accessToken = (await convex.mutation(
    "oauth:createOrGetAccessToken" as any,
    { userId: record.userId },
  )) as string;

  return Response.json(
    { access_token: accessToken, token_type: "Bearer" },
    { headers: corsHeaders },
  );
}
