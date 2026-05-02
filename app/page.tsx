import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <header className="mb-12">
        <h1 className="text-4xl font-bold text-(--color-deep-teal) dark:text-(--color-sage)">
          ChaosCourse
        </h1>
        <p className="mt-2 text-lg text-(--color-olive)">
          MCP server that makes Claude semester-aware.
        </p>
      </header>

      <section className="mb-10 space-y-4">
        <p className="text-base leading-relaxed">
          Import a syllabus once. Then ask Claude{" "}
          <em>&ldquo;what&rsquo;s due this week?&rdquo;</em>,{" "}
          <em>&ldquo;what should I prioritize?&rdquo;</em>, or{" "}
          <em>&ldquo;what&rsquo;s the late-work policy for PHIL 205?&rdquo;</em>{" "}
          — and get answers grounded in your actual coursework.
        </p>
        <p className="text-base leading-relaxed">
          More than a calendar: ChaosCourse understands academic weight.
          Priorities factor in due-date proximity × grade weight × current
          standing — not just chronological order.
        </p>
      </section>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/sign-up"
          className="rounded-lg bg-(--color-deep-teal) px-5 py-2.5 font-medium text-(--color-off-white) hover:bg-(--color-olive) transition-colors"
        >
          Get started
        </Link>
        <Link
          href="/sign-in"
          className="rounded-lg border border-(--color-deep-teal) px-5 py-2.5 font-medium text-(--color-deep-teal) hover:bg-(--color-lavender) dark:text-(--color-sage) dark:border-(--color-sage) dark:hover:bg-(--color-deep-teal)/40 transition-colors"
        >
          Sign in
        </Link>
      </div>

      <footer className="mt-16 text-sm text-(--color-mauve)">
        Part of the{" "}
        <a
          href="https://adhdesigns.dev"
          className="underline hover:text-(--color-amber)"
        >
          ADHDesigns
        </a>{" "}
        ecosystem ·{" "}
        <a
          href="https://github.com/lmdrew96/chaoscourse"
          className="underline hover:text-(--color-amber)"
        >
          source
        </a>
      </footer>
    </main>
  );
}
