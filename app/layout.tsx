import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  title: "ChaosCourse",
  description:
    "MCP server that makes Claude semester-aware by parsing syllabi into structured course data.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F7F5FA" },
    { media: "(prefers-color-scheme: dark)", color: "#1E1830" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body className="antialiased">{children}</body>
      </html>
    </ClerkProvider>
  );
}
