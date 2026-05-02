import { auth } from "@clerk/nextjs/server";
import { getConvexClient } from "@/src/lib/convex";
import { getBaseUrl } from "@/src/lib/baseUrl";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const clientId = url.searchParams.get("client_id");
  const redirectUri = url.searchParams.get("redirect_uri");
  const responseType = url.searchParams.get("response_type");
  const codeChallenge = url.searchParams.get("code_challenge");
  const codeChallengeMethod = url.searchParams.get("code_challenge_method");
  const state = url.searchParams.get("state");

  if (responseType !== "code") {
    return Response.json(
      { error: "unsupported_response_type" },
      { status: 400 },
    );
  }
  if (!clientId || !redirectUri || !codeChallenge) {
    return Response.json(
      {
        error: "invalid_request",
        error_description: "Missing required parameters",
      },
      { status: 400 },
    );
  }
  if (codeChallengeMethod !== "S256") {
    return Response.json(
      {
        error: "invalid_request",
        error_description: "Only S256 code_challenge_method is supported",
      },
      { status: 400 },
    );
  }

  const convex = getConvexClient();
  const client = (await convex.query("oauth:getClient" as any, {
    clientId,
  })) as { redirectUris: string[] } | null;
  if (!client) {
    return Response.json({ error: "invalid_client" }, { status: 400 });
  }
  if (!client.redirectUris.includes(redirectUri)) {
    return Response.json(
      {
        error: "invalid_request",
        error_description: "redirect_uri not registered",
      },
      { status: 400 },
    );
  }

  const { userId } = await auth();
  if (!userId) {
    const base = getBaseUrl();
    const returnUrl = url.pathname + url.search;
    return Response.redirect(
      `${base}/sign-in?redirect_url=${encodeURIComponent(returnUrl)}`,
    );
  }

  const code = (await convex.mutation("oauth:createAuthCode" as any, {
    clientId,
    userId,
    redirectUri,
    codeChallenge,
  })) as string;

  const target = new URL(redirectUri);
  target.searchParams.set("code", code);
  if (state) target.searchParams.set("state", state);
  return Response.redirect(target.toString());
}
