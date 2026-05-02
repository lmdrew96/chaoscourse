import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";

const randomId = (): string =>
  globalThis.crypto.randomUUID().replace(/-/g, "");

export const registerClient = mutationGeneric({
  args: {
    redirectUris: v.array(v.string()),
    clientName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const clientId = globalThis.crypto.randomUUID();
    const clientSecret = randomId() + randomId();
    const createdAt = new Date().toISOString();
    await ctx.db.insert("oauthClients", {
      clientId,
      clientSecret,
      redirectUris: args.redirectUris,
      clientName: args.clientName,
      createdAt,
    });
    return { clientId, clientSecret };
  },
});

export const getClient = queryGeneric({
  args: { clientId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("oauthClients")
      .withIndex("by_clientId", (q: any) => q.eq("clientId", args.clientId))
      .first();
  },
});

export const createAuthCode = mutationGeneric({
  args: {
    clientId: v.string(),
    userId: v.string(),
    redirectUri: v.string(),
    codeChallenge: v.string(),
  },
  handler: async (ctx, args) => {
    const code = globalThis.crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await ctx.db.insert("oauthCodes", {
      code,
      clientId: args.clientId,
      userId: args.userId,
      redirectUri: args.redirectUri,
      codeChallenge: args.codeChallenge,
      expiresAt,
    });
    return code;
  },
});

export const consumeAuthCode = mutationGeneric({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const record = await ctx.db
      .query("oauthCodes")
      .withIndex("by_code", (q: any) => q.eq("code", args.code))
      .first();
    if (!record) return null;
    await ctx.db.delete(record._id);
    if (new Date(record.expiresAt).getTime() < Date.now()) return null;
    return {
      clientId: record.clientId,
      userId: record.userId,
      redirectUri: record.redirectUri,
      codeChallenge: record.codeChallenge,
    };
  },
});

export const createOrGetAccessToken = mutationGeneric({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("mcpTokens")
      .withIndex("by_user", (q: any) => q.eq("userId", args.userId))
      .first();
    if (existing) return (existing as any).token as string;

    const token = randomId() + randomId();
    const createdAt = new Date().toISOString();
    await ctx.db.insert("mcpTokens", {
      token,
      userId: args.userId,
      createdAt,
    });
    return token;
  },
});

export const getUserIdByToken = queryGeneric({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("mcpTokens")
      .withIndex("by_token", (q: any) => q.eq("token", args.token))
      .first();
    return row ? ((row as any).userId as string) : null;
  },
});
