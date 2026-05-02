import { getConvexClient } from "../../src/lib/convex.js";

const escape = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const errorPage = (title: string, detail: string): Response =>
  new Response(
    `<!doctype html><meta charset="utf-8"><title>${escape(title)}</title>
     <body style="font-family:system-ui;max-width:480px;margin:48px auto;padding:0 16px">
     <h1>${escape(title)}</h1><p>${escape(detail)}</p></body>`,
    { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const clientId = url.searchParams.get("client_id");
  const redirectUri = url.searchParams.get("redirect_uri");
  const responseType = url.searchParams.get("response_type");
  const codeChallenge = url.searchParams.get("code_challenge");
  const codeChallengeMethod = url.searchParams.get("code_challenge_method");
  const state = url.searchParams.get("state");

  if (responseType !== "code") {
    return errorPage("Unsupported response_type", "Only response_type=code is supported.");
  }
  if (!clientId || !redirectUri || !codeChallenge) {
    return errorPage(
      "Missing parameters",
      "client_id, redirect_uri, and code_challenge are required.",
    );
  }
  if (codeChallengeMethod !== "S256") {
    return errorPage(
      "Unsupported PKCE method",
      "Only code_challenge_method=S256 is supported.",
    );
  }

  const convex = getConvexClient();
  const client: any = await convex.query("oauth:getClient" as any, { clientId });
  if (!client) {
    return errorPage("Invalid client", "Unknown client_id.");
  }
  if (!client.redirectUris.includes(redirectUri)) {
    return errorPage(
      "Invalid redirect_uri",
      "The provided redirect_uri is not registered for this client.",
    );
  }

  const publishableKey = process.env.CLERK_PUBLISHABLE_KEY;
  if (!publishableKey) {
    return errorPage(
      "Server misconfigured",
      "CLERK_PUBLISHABLE_KEY is not set on the server.",
    );
  }

  const oauthParams = {
    client_id: clientId,
    redirect_uri: redirectUri,
    code_challenge: codeChallenge,
    state: state ?? "",
  };

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sign in — ChaosCourse</title>
<style>
  body { font-family: system-ui, -apple-system, sans-serif; max-width: 480px; margin: 48px auto; padding: 0 16px; color: #1E1830; background: #F7F5FA; }
  h1 { margin: 0 0 8px 0; font-size: 24px; }
  p { color: #6b7280; margin: 0 0 24px 0; }
  #status { padding: 12px 16px; border-radius: 8px; background: #DBD5E2; margin-bottom: 16px; }
  #clerk-mount { min-height: 360px; }
  .err { background: #fef2f2; color: #991b1b; padding: 12px 16px; border-radius: 8px; }
</style>
</head>
<body>
<h1>ChaosCourse</h1>
<p>Sign in to authorize the connection. You'll be redirected back automatically.</p>
<div id="status">Loading sign-in…</div>
<div id="clerk-mount"></div>
<script>
window.__OAUTH_PARAMS__ = ${JSON.stringify(oauthParams)};
</script>
<script src="https://cdn.jsdelivr.net/npm/@clerk/clerk-js@5/dist/clerk.browser.js" data-clerk-publishable-key="${escape(
    publishableKey,
  )}"></script>
<script>
(async () => {
  const status = document.getElementById('status');
  const mount = document.getElementById('clerk-mount');
  try {
    await Clerk.load({ afterSignInUrl: window.location.href });
  } catch (e) {
    status.className = 'err';
    status.textContent = 'Failed to load sign-in: ' + (e && e.message || e);
    return;
  }

  async function exchange() {
    status.textContent = 'Authorizing…';
    const token = await Clerk.session.getToken();
    if (!token) {
      status.className = 'err';
      status.textContent = 'No active session token — please refresh.';
      return;
    }
    const res = await fetch('/oauth/issue-code', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(window.__OAUTH_PARAMS__),
    });
    if (!res.ok) {
      const detail = await res.text();
      status.className = 'err';
      status.textContent = 'Authorization failed: ' + detail;
      return;
    }
    const { code, redirect_uri, state } = await res.json();
    const target = new URL(redirect_uri);
    target.searchParams.set('code', code);
    if (state) target.searchParams.set('state', state);
    window.location.href = target.toString();
  }

  if (Clerk.user) {
    await exchange();
    return;
  }
  status.textContent = 'Please sign in.';
  Clerk.mountSignIn(mount, {
    afterSignInUrl: window.location.href,
    afterSignUpUrl: window.location.href,
    appearance: { variables: { colorPrimary: '#244952' } },
  });
  Clerk.addListener(async ({ user }) => {
    if (user) {
      Clerk.unmountSignIn(mount);
      await exchange();
    }
  });
})();
</script>
</body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export const config = { runtime: "nodejs" };
