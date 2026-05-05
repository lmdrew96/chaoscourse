import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getConvexClient } from "@/src/lib/convex";

/**
 * Issues (or returns the existing) long-lived MCP access token for the
 * Clerk-authenticated user. Bypasses the full OAuth PKCE dance for clients
 * that just need a Bearer token to paste into config (e.g. ChaosDash worker).
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const convex = getConvexClient();
  const token = (await convex.mutation(
    "oauth:createOrGetAccessToken" as any,
    { userId },
  )) as string;

  return NextResponse.json({ token });
}
