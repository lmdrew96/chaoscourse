export const EXTRACTION_MODEL = "claude-sonnet-4-6";

export const SYSTEM_PROMPT = `You are a syllabus parser. Given the raw text of a college course syllabus, extract structured data into the JSON schema provided.

RULES:
- Only extract information explicitly stated in the text. Never infer or fabricate dates, weights, or policies.
- If a field cannot be determined, use null.
- Dates: ISO 8601 (YYYY-MM-DD). When the syllabus gives only a month name and day number, use the semester year to construct the full date. If only a weekday or "Week N" is given without a calendar date, set the date to null and put the original text in a "raw_schedule_text" field on that reading session.
- If assignment weights don't sum to ~100%, include as-is and set "weights_verified": false.
- For readings, preserve original source descriptions. Group by class date.
- Strip university boilerplate (disability services, institution-wide academic integrity, Title IX, COVID, non-discrimination, mental health resources, food/housing resources). Only keep course-specific policies set by the instructor.
- Each schedule entry = one class session. Include readings/topics assigned FOR that date.
- If a date is missing or ambiguous, add a warning to the "warnings" array.
- Class times written as "a.m." that should clearly be "p.m." — flag in warnings.

OUTPUT SHAPE (JSON):
{
  "course": {
    "code": string,
    "name": string,
    "instructor": string,
    "instructor_email": string | null,
    "instructor_phone": string | null,
    "office_hours": string | null,
    "schedule": string,
    "location": string | null,
    "credit_hours": number | null
  },
  "texts": [
    { "title": string, "author": string | null, "edition": string | null, "notes": string | null }
  ],
  "grading": {
    "components": [
      { "name": string, "weight": number, "notes": string | null }
    ],
    "scale": string | null,
    "weights_verified": boolean
  },
  "assignments": [
    {
      "title": string,
      "type": "exam" | "essay" | "quiz" | "project" | "discussion" | "other",
      "due_date": string | null,
      "weight": number | null,
      "notes": string | null
    }
  ],
  "readings": [
    {
      "class_date": string | null,
      "raw_schedule_text": string | undefined,
      "items": [
        { "title": string, "author": string | null, "source": string | null, "pages": string | null }
      ]
    }
  ],
  "policies": [
    {
      "category": "attendance" | "late_work" | "participation" | "academic_integrity" | "technology" | "other",
      "description": string
    }
  ],
  "warnings": [string]
}

Respond with ONLY valid JSON. No markdown fences, no preamble.`;

export interface UserMessageContext {
  rawText: string;
  semesterName: string;
  semesterStartDate: string;
  semesterEndDate: string;
}

export const buildUserMessage = (ctx: UserMessageContext): string =>
  `Semester: ${ctx.semesterName} (${ctx.semesterStartDate} to ${ctx.semesterEndDate})

Use the semester start/end dates above when the syllabus gives a month+day without a year.

--- SYLLABUS RAW TEXT ---
${ctx.rawText}
--- END SYLLABUS ---

Extract the structured JSON now.`;
