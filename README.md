# ChaosCourse

> MCP server that makes Claude semester-aware by parsing syllabi into structured, queryable data.

ChaosCourse is part of the [Chaos ecosystem](https://adhdesigns.dev). Import syllabi (PDF/DOCX → text), and Claude can answer "what's due this week?", "what should I prioritize?", and "what's the late work policy for PHIL 205?" — factoring in due-date proximity × grade weight × current standing.

## Status

v0.1 — code complete, not yet deployed. See **Deploying** below.

## Stack

| Layer            | Choice                                  |
| ---------------- | --------------------------------------- |
| Runtime          | TypeScript + Node (ESM, NodeNext)       |
| MCP SDK          | `@modelcontextprotocol/sdk` 1.29        |
| Transport        | `WebStandardStreamableHTTPServerTransport` |
| Database         | Convex                                   |
| AI extraction    | Anthropic SDK (`claude-sonnet-4-6`)     |
| PDF / DOCX       | `pdf-parse`, `mammoth`                  |
| Hosting          | Vercel serverless                       |
| Auth             | Clerk + OAuth 2.0 PKCE                  |

## MCP Tools (16)

### Import & Setup
- `create_semester(name, startDate, endDate)`
- `import_syllabus(semesterId, fileContent, fileName)` — parses, returns JSON + warnings, does not commit
- `confirm_import(semesterId, parsedData)` — commits the parsed data after user review
- `add_course_manual(...)` — fallback for courses without a parseable syllabus

### Queries
- `whats_due(courseCode?, daysAhead = 7)`
- `prioritize(courseCode?, limit = 5)` — composite score: `urgency × 0.4 + weight × 0.4 + standing × 0.2`
- `get_schedule(date?, range = "day")`
- `get_course(courseCode)`
- `list_courses()`
- `get_readings(courseCode?, completed?, classDate?)`
- `get_policies(courseCode, category?)`

### Status Updates
- `mark_submitted(assignmentId)`
- `record_grade(assignmentId, grade)` — recalculates course average
- `mark_reading_done(readingId | courseCode + classDate)`

### Semester Management
- `get_gpa(semesterId?)` — per-course breakdown + cumulative GPA on 4.0 scale
- `archive_semester(semesterId)`

## Local Development

```bash
npm install
npm run typecheck     # tsc --noEmit
```

Run the parser smoke test against the bundled `parsed_syllabus.json` (ENGL 204):

```bash
node --experimental-strip-types -e '
  import("./src/parser/validate.js").then(async ({ parseAndValidate }) => {
    const { readFileSync } = await import("node:fs");
    const r = parseAndValidate(readFileSync("./parsed_syllabus.json", "utf-8"));
    console.log(r.data.course.code, r.data.assignments.length, "assignments");
  });
'
```

## Deploying

The deploy needs your hands at the controls. Checklist:

### 1. Convex

```bash
npx convex dev
# Logs you in via browser, creates a deployment, generates convex/_generated/
```

After provisioning, you'll have:
- `CONVEX_URL` — the HTTPS URL of your deployment
- `CONVEX_DEPLOYMENT` — the deployment slug

The schema and all functions in `convex/` will deploy automatically. Verify in the Convex dashboard.

**Optional cleanup:** once `convex/_generated/api.ts` exists, you can swap the string-form Convex refs in `src/tools/*.ts` for typed refs (e.g., `api.semesters.create` instead of `"semesters:create" as any`).

### 2. Anthropic API key

Get a key at [console.anthropic.com](https://console.anthropic.com). Save as `ANTHROPIC_API_KEY`.

### 3. Clerk

You can reuse your existing Clerk app from the ADHDesigns ecosystem (one Clerk app, many properties). Grab:

- `CLERK_PUBLISHABLE_KEY` (for the embedded sign-in component)
- `CLERK_SECRET_KEY` (for server-side JWT verification)

In Clerk's dashboard, add `https://chaoscourse-mcp.vercel.app` (and `https://*.vercel.app` for preview deploys) to the allowed origins / authorized redirect URLs so Clerk's hosted JS bundle will run on this domain.

### 4. Vercel

```bash
vercel link
vercel env add CONVEX_URL
vercel env add ANTHROPIC_API_KEY
vercel env add CLERK_PUBLISHABLE_KEY
vercel env add CLERK_SECRET_KEY
vercel deploy --prod
```

Target URL pattern: `chaoscourse-mcp.vercel.app`.

### 5. Add to Claude

In Claude.ai's MCP connector, add a server pointing to:

- **URL:** `https://chaoscourse-mcp.vercel.app/mcp`
- **Auth:** OAuth (Claude.ai will discover the OAuth endpoints automatically via `.well-known/oauth-protected-resource`)

When you first try to use the connector, Claude.ai redirects you through the OAuth flow:
1. → `https://chaoscourse-mcp.vercel.app/oauth/authorize?...` (renders the embedded Clerk sign-in)
2. After Clerk sign-in → POST to `/oauth/issue-code` (verifies Clerk JWT, returns auth code)
3. → redirect back to Claude.ai with the code
4. Claude.ai exchanges code at `/oauth/token` (PKCE-verified) for a long-lived Bearer token
5. All subsequent MCP requests use that Bearer

### 6. End-to-end test

```
1. Ask Claude: "Create a semester called Fall 2026 from 2026-08-25 to 2026-12-15"
2. Paste syllabus text: "Import this syllabus into Fall 2026: <text>"
3. Review the parsed output, then: "Looks good, confirm the import"
4. Ask: "What's due this week?" or "What should I prioritize?"
```

## Project Structure

```
chaoscourse/
├── api/
│   ├── mcp.ts                     # MCP entry — Bearer (from OAuth) + transport
│   ├── oauth/
│   │   ├── authorize.ts           # HTML page hosting Clerk's JS SDK for sign-in
│   │   ├── issue-code.ts          # Verifies Clerk JWT, mints auth code
│   │   ├── token.ts               # Exchanges code (PKCE) for access token
│   │   └── register.ts            # RFC 7591 dynamic client registration
│   └── well-known/
│       ├── oauth-protected-resource.ts
│       └── oauth-authorization-server.ts
├── convex/
│   ├── schema.ts           # 10 tables, 17 indexes (incl. oauthClients, oauthCodes, mcpTokens)
│   ├── semesters.ts        # create, get, list, getActive, archive, getGpaData
│   ├── courses.ts          # createManual, getByCode, listForSemester, listForActiveSemester, getCourseDetails
│   ├── assignments.ts      # listUpcomingInRange, listGradedForCourse, markSubmitted, recordGrade, …
│   ├── readings.ts         # listForUser, listUnreadInRange, markDone, markDoneForSession
│   ├── policies.ts         # listForCourse
│   ├── gradingComponents.ts
│   ├── texts.ts
│   ├── import.ts           # commitParsedSyllabus (atomic multi-table insert)
│   └── oauth.ts            # registerClient, getClient, createAuthCode, consumeAuthCode, createOrGetAccessToken, getUserIdByToken
├── src/
│   ├── server.ts           # MCP server factory — aggregates 16 tools
│   ├── tools/
│   │   ├── import.ts       # 4 import tools (create_semester, import_syllabus, confirm_import, add_course_manual)
│   │   ├── query.ts        # 7 query tools incl. prioritize scoring
│   │   ├── status.ts       # 3 status tools
│   │   └── semester.ts     # 2 semester tools
│   ├── parser/
│   │   ├── extract.ts      # PDF (pdf-parse) + DOCX (mammoth) → raw text
│   │   ├── prompt.ts       # System prompt + user message builder
│   │   └── validate.ts     # Zod schema + parseAndValidate with backstop warnings
│   └── lib/
│       ├── convex.ts       # Lazy ConvexHttpClient
│       ├── anthropic.ts    # Lazy Anthropic client
│       └── clerk.ts        # verifyClerkToken (JWT) + getBaseUrl helper
├── parsed_syllabus.json    # ENGL 204 reference parse (used for schema design + smoke tests)
├── docs/SPEC.md
├── package.json
├── tsconfig.json
├── convex.json
└── vercel.json
```

## Edge Cases Handled

The system prompt + validator together handle the cases identified during the ENGL 204 test parse:

- Month-header date formats (`**February**` then bare day numbers)
- Continuation entries (e.g., "Emily Dickinson continued")
- Missing dates (flagged in warnings, `class_date: null` + `raw_schedule_text`)
- Spring break / holiday gaps
- Massive single-session reading loads (flagged when >10 items)
- Mixed sources (anthology + standalone books)
- TBA dates (e.g., final exams)
- AM/PM typos (`1:00 to 2:20 a.m.` → flagged)
- Page-number variations (single, ranges, null)
- Missing grading scale (flagged, never fabricated)

## Known Issues

- `pdf-parse` pulls in 6 transitive vulnerabilities. Consider swapping for `pdfjs-dist` or `unpdf` if security review flags it.

## License

Private — part of the ADHDesigns ecosystem.
