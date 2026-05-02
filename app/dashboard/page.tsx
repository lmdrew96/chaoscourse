import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { getConvexClient } from "@/src/lib/convex";
import { getBaseUrl } from "@/src/lib/baseUrl";

export const dynamic = "force-dynamic";

const fetchOverview = async (userId: string) => {
  const convex = getConvexClient();
  try {
    const result = (await convex.query("courses:listForActiveSemester" as any, {
      userId,
    })) as { semester: any | null; courses: any[] };
    return result;
  } catch {
    return { semester: null, courses: [] };
  }
};

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const user = await currentUser();
  const overview = await fetchOverview(userId);
  const mcpUrl = `${getBaseUrl()}/mcp`;

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-10 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-(--color-deep-teal) dark:text-(--color-sage)">
            Welcome
            {user?.firstName ? `, ${user.firstName}` : ""}
          </h1>
          <p className="mt-1 text-sm text-(--color-mauve)">
            Signed in as {user?.primaryEmailAddress?.emailAddress ?? userId}
          </p>
        </div>
        <UserButton />
      </header>

      <section className="mb-10 rounded-xl border border-(--color-lavender) bg-white/60 p-6 dark:bg-(--color-deep-dark)/60 dark:border-(--color-deep-teal)">
        <h2 className="mb-3 text-xl font-semibold text-(--color-deep-teal) dark:text-(--color-sage)">
          Connect Claude
        </h2>
        <p className="mb-4 text-sm leading-relaxed">
          Add ChaosCourse to Claude.ai&rsquo;s MCP connector. The OAuth flow
          will pick up your sign-in automatically.
        </p>
        <dl className="space-y-2 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <dt className="font-medium text-(--color-mauve)">URL:</dt>
            <dd>
              <code className="rounded bg-(--color-lavender) px-2 py-0.5 dark:bg-(--color-deep-teal)/40">
                {mcpUrl}
              </code>
            </dd>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <dt className="font-medium text-(--color-mauve)">Auth:</dt>
            <dd>OAuth 2.0 (auto-discovered)</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-(--color-lavender) bg-white/60 p-6 dark:bg-(--color-deep-dark)/60 dark:border-(--color-deep-teal)">
        <h2 className="mb-3 text-xl font-semibold text-(--color-deep-teal) dark:text-(--color-sage)">
          Your data
        </h2>
        {overview.semester === null ? (
          <p className="text-sm text-(--color-mauve)">
            No active semester yet. Once you ask Claude to{" "}
            <em>&ldquo;create a semester&rdquo;</em> and import a syllabus,
            it&rsquo;ll show up here.
          </p>
        ) : (
          <div className="space-y-3 text-sm">
            <div>
              <span className="font-medium text-(--color-mauve)">
                Active semester:
              </span>{" "}
              {overview.semester.name}
            </div>
            <div>
              <span className="font-medium text-(--color-mauve)">
                Courses:
              </span>{" "}
              {overview.courses.length === 0 ? (
                <span className="text-(--color-mauve)">
                  none yet — import a syllabus through Claude
                </span>
              ) : (
                <ul className="mt-2 space-y-1">
                  {overview.courses.map((c: any) => (
                    <li key={c._id}>
                      <span className="font-mono text-(--color-deep-teal) dark:text-(--color-sage)">
                        {c.code}
                      </span>{" "}
                      — {c.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
