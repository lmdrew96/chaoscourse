export const getBaseUrl = (): string => {
  if (process.env.CHAOSCOURSE_BASE_URL) return process.env.CHAOSCOURSE_BASE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
};
