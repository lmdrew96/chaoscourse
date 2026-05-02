import { z } from "zod";

const ParsedCourse = z.object({
  code: z.string(),
  name: z.string(),
  instructor: z.string(),
  instructor_email: z.string().nullable(),
  instructor_phone: z.string().nullable(),
  office_hours: z.string().nullable(),
  schedule: z.string(),
  location: z.string().nullable(),
  credit_hours: z.number().nullable(),
});

const ParsedText = z.object({
  title: z.string(),
  author: z.string().nullable(),
  edition: z.string().nullable(),
  notes: z.string().nullable(),
});

const ParsedGradingComponent = z.object({
  name: z.string(),
  weight: z.number(),
  notes: z.string().nullable(),
});

const ParsedAssignment = z.object({
  title: z.string(),
  type: z.enum(["exam", "essay", "quiz", "project", "discussion", "other"]),
  due_date: z.string().nullable(),
  weight: z.number().nullable(),
  notes: z.string().nullable(),
});

const ParsedReadingItem = z.object({
  title: z.string(),
  author: z.string().nullable(),
  source: z.string().nullable(),
  pages: z.string().nullable(),
});

const ParsedReadingSession = z.object({
  class_date: z.string().nullable(),
  raw_schedule_text: z.string().optional(),
  items: z.array(ParsedReadingItem),
});

const ParsedPolicy = z.object({
  category: z.enum([
    "attendance",
    "late_work",
    "participation",
    "academic_integrity",
    "technology",
    "other",
  ]),
  description: z.string(),
});

export const ParsedSyllabusSchema = z.object({
  course: ParsedCourse,
  texts: z.array(ParsedText),
  grading: z.object({
    components: z.array(ParsedGradingComponent),
    scale: z.string().nullable(),
    weights_verified: z.boolean(),
  }),
  assignments: z.array(ParsedAssignment),
  readings: z.array(ParsedReadingSession),
  policies: z.array(ParsedPolicy),
  warnings: z.array(z.string()),
});

export type ParsedSyllabus = z.infer<typeof ParsedSyllabusSchema>;

const stripCodeFences = (raw: string): string => {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  const withoutFirstFence = trimmed.replace(/^```(?:json)?\s*/i, "");
  return withoutFirstFence.replace(/```\s*$/, "").trim();
};

const HEAVY_READING_THRESHOLD = 10;

const computeBackstopWarnings = (data: ParsedSyllabus): string[] => {
  const warnings: string[] = [];

  const totalWeight = data.grading.components.reduce(
    (sum, c) => sum + c.weight,
    0,
  );
  if (
    data.grading.components.length > 0 &&
    (totalWeight < 98 || totalWeight > 102)
  ) {
    warnings.push(
      `Grading components weights sum to ${totalWeight}%, not 100%`,
    );
  }

  if (data.grading.scale === null) {
    warnings.push("No grading scale provided (e.g., what % = A, B+, etc.)");
  }

  const undatedAssignments = data.assignments.filter((a) => a.due_date === null);
  if (undatedAssignments.length > 0) {
    const titles = undatedAssignments.map((a) => a.title).join(", ");
    warnings.push(`${undatedAssignments.length} assignment(s) missing due dates: ${titles}`);
  }

  for (const session of data.readings) {
    if (session.items.length > HEAVY_READING_THRESHOLD) {
      const label = session.class_date ?? session.raw_schedule_text ?? "(undated)";
      warnings.push(
        `Class on ${label} has ${session.items.length} readings — verify this is a single session`,
      );
    }
    if (session.class_date === null) {
      const label = session.raw_schedule_text ?? "(no raw text)";
      warnings.push(`Reading session has no date: ${label}`);
    }
  }

  return warnings;
};

const dedupeWarnings = (existing: string[], added: string[]): string[] => {
  const seen = new Set(existing.map((w) => w.toLowerCase().trim()));
  const result = [...existing];
  for (const w of added) {
    const key = w.toLowerCase().trim();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(w);
    }
  }
  return result;
};

export interface ParseResult {
  data: ParsedSyllabus;
  warnings: string[];
}

export const parseAndValidate = (raw: string): ParseResult => {
  const cleaned = stripCodeFences(raw);

  let json: unknown;
  try {
    json = JSON.parse(cleaned);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Parser returned invalid JSON: ${message}`);
  }

  const data = ParsedSyllabusSchema.parse(json);
  const backstop = computeBackstopWarnings(data);
  const warnings = dedupeWarnings(data.warnings, backstop);

  return { data, warnings };
};
