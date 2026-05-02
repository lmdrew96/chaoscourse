import { verifyToken } from "@clerk/backend";

export const verifyClerkToken = async (token: string): Promise<string | null> => {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) throw new Error("CLERK_SECRET_KEY is required");
  try {
    const claims = await verifyToken(token, { secretKey });
    return typeof claims.sub === "string" ? claims.sub : null;
  } catch {
    return null;
  }
};

export const getBaseUrl = (): string => {
  if (process.env.CHAOSCOURSE_BASE_URL) return process.env.CHAOSCOURSE_BASE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
};
