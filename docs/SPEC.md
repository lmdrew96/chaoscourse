# ChaosCourse — Technical Specification

> **MCP server that makes Claude semester-aware by parsing syllabi into structured, queryable data.**

## Overview

ChaosCourse is an MCP (Model Context Protocol) server in the Chaos ecosystem. Users import college syllabi (PDF/DOCX), and the server auto-parses them into structured course data using Claude's API. Any Claude instance with the MCP connected can then answer questions like "what's due this week?", "what should I prioritize?", and "what's the late work policy for PHIL 205?"

**What makes it more than a calendar:** It understands academic weight. "What should I prioritize?" factors in due date proximity × grade weight × current standing — not just chronological order.

## Tech Stack

| Layer            | Choice                          | Notes                                      |
| ---------------- | ------------------------------- | ------------------------------------------ |
| Runtime          | TypeScript + Node               |                                            |
| MCP SDK          | `@modelcontextprotocol/sdk`     | Standard MCP server SDK                    |
| PDF text extract | `pdf-parse`                     | Lightweight, solid                         |
| DOCX text extract| `mammoth`                       | Clean text extraction from .docx           |
| AI extraction    | Anthropic SDK (`claude-sonnet-4-20250514`) | Structured syllabus parsing     |
| Database         | Convex                          | Already in the ecosystem (ScribeCat, etc.) |
| Hosting          | Vercel                          | Matches other Chaos MCP servers            |

**Repo:** `lmdrew96/chaoscourse` (GitHub)
**Deploy URL pattern:** `chaoscourse-mcp.vercel.app`

---

## Data Model (Convex Schema)

### `semesters`

| Field        | Type     | Notes                              |
| ------------ | -------- | ---------------------------------- |
| `userId`     | string   | Auth user ID                       |
| `name`       | string   | e.g., "Fall 2026"                  |
| `status`     | string   | `"active"` \| `"archived"`        |
| `startDate`  | string   | ISO 8601                           |
| `endDate`    | string   | ISO 8601                           |
| `createdAt`  | string   | ISO 8601                           |

### `courses`

| Field             | Type          | Notes                                   |
| ----------------- | ------------- | --------------------------------------- |
| `userId`          | string        |                                         |
| `semesterId`      | Id<semesters> | FK                                      |
| `code`            | string        | e.g., "LING 202"                        |
| `name`            | string        | e.g., "Introduction to Linguistics"     |
| `instructor`      | string        |                                         |
| `instructorEmail` | string?       |                                         |
| `instructorPhone` | string?       |                                         |
| `officeHours`     | string?       |                                         |
| `schedule`        | string        | e.g., "TR 2:20-3:40pm"                 |
| `location`        | string?       |                                         |
| `creditHours`     | number?       |                                         |
| `createdAt`       | string        |                                         |

### `gradingComponents`

| Field      | Type         | Notes                           |
| ---------- | ------------ | ------------------------------- |
| `courseId`  | Id<courses>  | FK                              |
| `name`     | string       | e.g., "Midterm Exam"            |
| `weight`   | number       | Percentage (0–100)              |
| `notes`    | string?      | e.g., "30% each, two total"     |

### `assignments`

| Field      | Type                | Notes                                              |
| ---------- | ------------------- | -------------------------------------------------- |
| `userId`   | string              |                                                    |
| `courseId`  | Id<courses>         | FK                                                 |
| `title`    | string              |                                                    |
| `type`     | string              | `"exam"` \| `"essay"` \| `"quiz"` \| `"project"` \| `"discussion"` \| `"other"` |
| `dueDate`  | string?             | ISO 8601, null if TBA                              |
| `weight`   | number?             | Percentage of final grade                          |
| `status`   | string              | `"upcoming"` \| `"submitted"` \| `"graded"`       |
| `grade`    | number?             | Recorded grade (0–100), null until graded          |
| `notes`    | string?             |                                                    |

### `readings`

| Field         | Type        | Notes                                          |
| ------------- | ----------- | ---------------------------------------------- |
| `userId`      | string      |                                                |
| `courseId`     | Id<courses> | FK                                             |
| `classDate`   | string?     | ISO 8601, the class session this reading is for|
| `title`       | string      |                                                |
| `author`      | string?     |                                                |
| `source`      | string?     | e.g., "NAAL Volume B"                          |
| `pages`       | string?     | e.g., "332-345"                                |
| `completed`   | boolean     | Default: false                                 |

### `policies`

| Field       | Type        | Notes                                                 |
| ----------- | ----------- | ----------------------------------------------------- |
| `courseId`   | Id<courses> | FK                                                    |
| `category`  | string      | `"attendance"` \| `"late_work"` \| `"participation"` \| `"academic_integrity"` \| `"technology"` \| `"other"` |
| `description`| string     | Full policy text                                      |

### `texts`

| Field     | Type        | Notes                                  |
| --------- | ----------- | -------------------------------------- |
| `courseId` | Id<courses> | FK                                    |
| `title`   | string      |                                        |
| `author`  | string?     |                                        |
| `edition` | string?     |                                        |
| `notes`   | string?     | e.g., "Available as PDF on Canvas"     |

---

## MCP Tool Surface (16 tools)

### Import & Setup

#### `create_semester`
Create a new semester container.

- **Params:** `name` (string), `startDate` (string), `endDate` (string)
- **Returns:** Semester object

#### `import_syllabus`
Parse a syllabus file and return extracted data for user confirmation. Does NOT commit to DB.

- **Params:** `semesterId` (string), `fileContent` (string — raw text extracted client-side or passed as text), `fileName` (string)
- **Returns:** Parsed JSON matching the extraction schema + `warnings` array
- **Flow:**
  1. Receive raw text content
  2. Send to Claude API with structured extraction prompt (see Parsing Pipeline below)
  3. Validate response JSON against schema
  4. Return parsed data + warnings to user via MCP
  5. User reviews in conversation, then calls `confirm_import`

#### `confirm_import`
Commit parsed syllabus data to Convex. Called after user reviews `import_syllabus` output.

- **Params:** `semesterId` (string), `parsedData` (object — the full parsed JSON, potentially with user edits)
- **Returns:** Summary of what was created (course, N assignments, N readings, etc.)

#### `add_course_manual`
Fallback for courses without a parseable syllabus.

- **Params:** All `courses` table fields
- **Returns:** Course object

### Query Tools

#### `whats_due`
Get upcoming assignments and readings, optionally filtered.

- **Params:** `courseCode?` (string), `daysAhead?` (number, default 7)
- **Returns:** Sorted list of assignments + unread readings with due dates within range

#### `prioritize`
🔥 **The killer feature.** Rank upcoming work by a composite priority score.

- **Scoring formula:**
  ```
  priority = (urgency × 0.4) + (weight × 0.4) + (standing × 0.2)
  
  urgency = 1 - (daysUntilDue / 14)   // clamped 0–1, maxes out at ≤0 days
  weight  = assignmentWeight / 100      // 30% exam = 0.3
  standing = needsAttention ? 1 : 0     // 1 if current grade < 80 in course, else 0
  ```
- **Params:** `courseCode?` (string), `limit?` (number, default 5)
- **Returns:** Ranked list with score breakdown

#### `get_schedule`
What classes do I have on a given day/week?

- **Params:** `date?` (string, default today), `range?` (`"day"` | `"week"`, default `"day"`)
- **Returns:** Class sessions with times, locations, and what readings are due

#### `get_course`
Full details for one course.

- **Params:** `courseCode` (string)
- **Returns:** Course object + grading components + policies + texts

#### `list_courses`
All courses for the active semester.

- **Params:** none
- **Returns:** Array of course summaries

#### `get_readings`
Readings filtered by course and/or completion status.

- **Params:** `courseCode?` (string), `completed?` (boolean), `classDate?` (string)
- **Returns:** Array of reading objects

#### `get_policies`
Look up a specific policy.

- **Params:** `courseCode` (string), `category?` (string)
- **Returns:** Array of policy objects

### Status Updates

#### `mark_submitted`
Update an assignment's status to submitted.

- **Params:** `assignmentId` (string)
- **Returns:** Updated assignment

#### `record_grade`
Log a grade for an assignment.

- **Params:** `assignmentId` (string), `grade` (number)
- **Returns:** Updated assignment + recalculated course grade

#### `mark_reading_done`
Check off a reading.

- **Params:** `readingId` (string) OR `courseCode` + `classDate` (bulk mark all readings for a session)
- **Returns:** Updated reading(s)

### Semester Management

#### `get_gpa`
Calculate current GPA from recorded grades.

- **Params:** `semesterId?` (string, default active semester)
- **Returns:** Per-course grades + cumulative GPA (if credit hours available) + breakdown
- **Note:** Only calculates from graded assignments. Shows "projected" based on current grades vs. remaining weight.

#### `archive_semester`
Freeze a semester. Remains queryable but marked inactive.

- **Params:** `semesterId` (string)
- **Returns:** Archived semester summary

---

## Parsing Pipeline

### System Prompt

```
You are a syllabus parser. Given the raw text of a college course syllabus,
extract structured data into the JSON schema provided.

RULES:
- Only extract information explicitly stated in the text. Never infer or
  fabricate dates, weights, or policies.
- If a field cannot be determined, use null.
- Dates: ISO 8601 (YYYY-MM-DD). When the syllabus gives only a month name
  and day number, use the semester year to construct the full date. If only
  a weekday or "Week N" is given without a calendar date, set the date to
  null and put the original text in a "raw_schedule_text" field.
- If assignment weights don't sum to ~100%, include as-is and set
  "weights_verified": false.
- For readings, preserve original source descriptions. Group by class date.
- Strip university boilerplate (disability services, institution-wide
  academic integrity, Title IX, COVID, non-discrimination, mental health
  resources, food/housing resources). Only keep course-specific policies
  set by the instructor.
- Each schedule entry = one class session. Include readings/topics assigned
  FOR that date.
- If a date is missing or ambiguous, add a warning.
- Class times written as "a.m." that should clearly be "p.m." — flag in
  warnings.

Respond with ONLY valid JSON. No markdown fences, no preamble.
```

### Extraction Schema

(See `parsed_syllabus.json` in project root for the full validated example output from the ENGL 204 test parse.)

### File Text Extraction

**PDF:** Use `pdf-parse` to extract raw text.
```typescript
import pdfParse from 'pdf-parse';
const data = await pdfParse(buffer);
const rawText = data.text;
```

**DOCX:** Use `mammoth` to extract raw text.
```typescript
import mammoth from 'mammoth';
const result = await mammoth.extractRawText({ buffer });
const rawText = result.value;
```

### Confirm Flow

The two-step import is critical for trust:

1. `import_syllabus` → returns parsed JSON + warnings
2. Claude-in-conversation presents the parsed data naturally:
   > "I parsed your LING 202 syllabus! Found 6 assignments, 14 readings, and 3 policies. A couple things to check: the assignment weights only add up to 95% — is there a participation grade missing? Also, 3 readings don't have specific dates. Want me to fix those before saving?"
3. User approves (possibly with edits) → `confirm_import` commits to Convex

---

## Auth & Multi-tenancy

Follow the same pattern as other Chaos MCP servers (ControlledChaos, ChaosPatch):

- Clerk authentication
- `userId` on all tables
- Per-user data isolation
- MCP server URL includes user ID: `chaoscourse-mcp.vercel.app/{userId}`

---

## Project Structure

```
chaoscourse/
├── convex/
│   ├── schema.ts           # All table definitions
│   ├── semesters.ts         # Semester CRUD mutations/queries
│   ├── courses.ts           # Course CRUD
│   ├── assignments.ts       # Assignment CRUD + grade calculations
│   ├── readings.ts          # Reading CRUD
│   ├── policies.ts          # Policy queries
│   ├── texts.ts             # Textbook queries
│   ├── gradingComponents.ts # Grading component queries
│   └── import.ts            # Import/confirm logic
├── src/
│   ├── server.ts            # MCP server entry point
│   ├── tools/
│   │   ├── import.ts        # import_syllabus, confirm_import, create_semester, add_course_manual
│   │   ├── query.ts         # whats_due, prioritize, get_schedule, get_course, list_courses, get_readings, get_policies
│   │   ├── status.ts        # mark_submitted, record_grade, mark_reading_done
│   │   └── semester.ts      # get_gpa, archive_semester
│   ├── parser/
│   │   ├── extract.ts       # PDF/DOCX text extraction
│   │   ├── prompt.ts        # System prompt + schema for Claude API
│   │   └── validate.ts      # JSON schema validation of parsed output
│   └── lib/
│       ├── convex.ts        # Convex client setup
│       └── anthropic.ts     # Anthropic client setup
├── api/
│   └── mcp.ts               # Vercel serverless entry point
├── package.json
├── tsconfig.json
├── convex.json
├── vercel.json
├── SPEC.md                   # This file
└── README.md
```

---

## Edge Cases Identified (from ENGL 204 test parse)

1. **Month-header date format** — Syllabi using `**February**` then just `5` for dates. Parser must combine month header + day + semester year.
2. **Continuation entries** — "Emily Dickinson continued" with no new readings. Handle gracefully as a session with no new items.
3. **Missing dates** — Some entries have no day number (e.g., a dash or blank). Flag in warnings with best guess.
4. **Spring Break / holidays** — Gaps in the schedule are normal, not errors.
5. **Massive single-session loads** — Feb 5 had 21 readings. Flag for user verification (might span multiple sessions).
6. **Mixed sources** — Readings from both anthology and standalone books. Track source per reading, not per course.
7. **TBA dates** — Final exams often have no date. Store as null, flag for later update.
8. **AM/PM typos** — "1:00 to 2:20 a.m." → flag in warnings.
9. **Page number variations** — Single pages ("612"), ranges ("92-111"), and null (standalone books without pagination).
10. **No grading scale** — Some professors omit this. Don't fabricate; flag as missing.

---

## Future Considerations (not in v1)

- **Canvas API integration** — auto-import from Canvas instead of file upload
- **ControlledChaos sync** — push academic tasks into CC as tasks
- **Notification triggers** — "assignment due in 48 hours" push
- **Multi-user / sharing** — study group features
- **Syllabus diff** — detect when a professor updates the syllabus mid-semester
