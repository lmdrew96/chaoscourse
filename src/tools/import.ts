import { getAnthropicClient } from "../lib/anthropic.js";
import { getConvexClient } from "../lib/convex.js";
import {
  EXTRACTION_MODEL,
  SYSTEM_PROMPT,
  buildUserMessage,
} from "../parser/prompt.js";
import { ParsedSyllabusSchema, parseAndValidate } from "../parser/validate.js";

export type ToolArgs = Record<string, unknown>;

export const IMPORT_TOOL_DEFINITIONS = [
  {
    name: "create_semester",
    description:
      "Create a new semester container. Returns the created semester object.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: 'e.g., "Fall 2026"' },
        startDate: { type: "string", description: "ISO 8601 date (YYYY-MM-DD)" },
        endDate: { type: "string", description: "ISO 8601 date (YYYY-MM-DD)" },
      },
      required: ["name", "startDate", "endDate"],
    },
  },
  {
    name: "import_syllabus",
    description:
      "Parse a syllabus and return extracted data + warnings for user review. Does NOT commit. Follow up with confirm_import after the user approves.",
    inputSchema: {
      type: "object" as const,
      properties: {
        semesterId: { type: "string", description: "Target semester ID" },
        fileContent: {
          type: "string",
          description: "Raw text of the syllabus (extracted client-side from PDF/DOCX or pasted directly)",
        },
        fileName: {
          type: "string",
          description: "Original file name (used for context only)",
        },
      },
      required: ["semesterId", "fileContent", "fileName"],
    },
  },
  {
    name: "confirm_import",
    description:
      "Commit parsed syllabus data to the database. Call after the user reviews import_syllabus output. Accepts the full parsed JSON, possibly with user edits.",
    inputSchema: {
      type: "object" as const,
      properties: {
        semesterId: { type: "string", description: "Target semester ID" },
        parsedData: {
          type: "object",
          description: "The full parsed syllabus JSON returned from import_syllabus, possibly with user edits",
        },
      },
      required: ["semesterId", "parsedData"],
    },
  },
  {
    name: "add_course_manual",
    description:
      "Manually add a course without parsing a syllabus. Use when no syllabus is available or the syllabus failed to parse.",
    inputSchema: {
      type: "object" as const,
      properties: {
        semesterId: { type: "string" },
        code: { type: "string", description: 'e.g., "LING 202"' },
        name: { type: "string", description: 'e.g., "Introduction to Linguistics"' },
        instructor: { type: "string" },
        instructorEmail: { type: "string" },
        instructorPhone: { type: "string" },
        officeHours: { type: "string" },
        schedule: { type: "string", description: 'e.g., "TR 2:20-3:40pm"' },
        location: { type: "string" },
        creditHours: { type: "number" },
      },
      required: ["semesterId", "code", "name", "instructor", "schedule"],
    },
  },
] as const;

const extractTextFromResponse = (content: unknown): string => {
  if (!Array.isArray(content)) {
    throw new Error("Anthropic response: expected content array");
  }
  const block = content.find(
    (b): b is { type: "text"; text: string } =>
      typeof b === "object" &&
      b !== null &&
      (b as { type?: unknown }).type === "text" &&
      typeof (b as { text?: unknown }).text === "string",
  );
  if (!block) throw new Error("Anthropic response: no text block found");
  return block.text;
};

const stringArg = (args: ToolArgs, key: string): string => {
  const v = args[key];
  if (typeof v !== "string") throw new Error(`Argument '${key}' must be a string`);
  return v;
};

const optionalStringArg = (args: ToolArgs, key: string): string | undefined => {
  const v = args[key];
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "string") throw new Error(`Argument '${key}' must be a string`);
  return v;
};

const optionalNumberArg = (args: ToolArgs, key: string): number | undefined => {
  const v = args[key];
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "number") throw new Error(`Argument '${key}' must be a number`);
  return v;
};

export const handleImportTool = async (
  name: string,
  args: ToolArgs,
  userId: string,
): Promise<string> => {
  const convex = getConvexClient();

  switch (name) {
    case "create_semester": {
      const result = await convex.mutation("semesters:create" as any, {
        userId,
        name: stringArg(args, "name"),
        startDate: stringArg(args, "startDate"),
        endDate: stringArg(args, "endDate"),
      });
      return JSON.stringify(result, null, 2);
    }

    case "import_syllabus": {
      const semesterId = stringArg(args, "semesterId");
      const fileContent = stringArg(args, "fileContent");
      stringArg(args, "fileName"); // validated, currently informational only

      const semester = await convex.query("semesters:get" as any, { id: semesterId });
      if (!semester) throw new Error(`Semester '${semesterId}' not found`);

      const anthropic = getAnthropicClient();
      const response = await anthropic.messages.create({
        model: EXTRACTION_MODEL,
        max_tokens: 8000,
        system: [
          {
            type: "text",
            text: SYSTEM_PROMPT,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [
          {
            role: "user",
            content: buildUserMessage({
              rawText: fileContent,
              semesterName: (semester as { name: string }).name,
              semesterStartDate: (semester as { startDate: string }).startDate,
              semesterEndDate: (semester as { endDate: string }).endDate,
            }),
          },
        ],
      });

      const rawJson = extractTextFromResponse(response.content);
      const { data, warnings } = parseAndValidate(rawJson);
      return JSON.stringify({ parsed: data, warnings }, null, 2);
    }

    case "confirm_import": {
      const semesterId = stringArg(args, "semesterId");
      const rawParsed = args["parsedData"];
      if (typeof rawParsed !== "object" || rawParsed === null) {
        throw new Error("Argument 'parsedData' must be an object");
      }

      const validated = ParsedSyllabusSchema.parse(rawParsed);

      const result = await convex.mutation("import:commitParsedSyllabus" as any, {
        userId,
        semesterId,
        parsed: validated,
      });
      return JSON.stringify(result, null, 2);
    }

    case "add_course_manual": {
      const result = await convex.mutation("courses:createManual" as any, {
        userId,
        semesterId: stringArg(args, "semesterId"),
        code: stringArg(args, "code"),
        name: stringArg(args, "name"),
        instructor: stringArg(args, "instructor"),
        instructorEmail: optionalStringArg(args, "instructorEmail"),
        instructorPhone: optionalStringArg(args, "instructorPhone"),
        officeHours: optionalStringArg(args, "officeHours"),
        schedule: stringArg(args, "schedule"),
        location: optionalStringArg(args, "location"),
        creditHours: optionalNumberArg(args, "creditHours"),
      });
      return JSON.stringify(result, null, 2);
    }

    default:
      throw new Error(`Unknown import tool: ${name}`);
  }
};
