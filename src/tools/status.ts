import { getConvexClient } from "../lib/convex";

export type ToolArgs = Record<string, unknown>;

export const STATUS_TOOL_DEFINITIONS = [
  {
    name: "mark_submitted",
    description: "Mark an assignment as submitted.",
    inputSchema: {
      type: "object" as const,
      properties: { assignmentId: { type: "string" } },
      required: ["assignmentId"],
    },
  },
  {
    name: "record_grade",
    description:
      "Log a grade (0-100) for an assignment. Sets status to 'graded' and returns the recalculated course grade.",
    inputSchema: {
      type: "object" as const,
      properties: {
        assignmentId: { type: "string" },
        grade: { type: "number", description: "0-100" },
      },
      required: ["assignmentId", "grade"],
    },
  },
  {
    name: "mark_reading_done",
    description:
      "Mark a single reading as completed (by readingId), OR bulk-mark all readings for a course + classDate.",
    inputSchema: {
      type: "object" as const,
      properties: {
        readingId: {
          type: "string",
          description: "Single reading to mark done. Mutually exclusive with courseCode+classDate.",
        },
        courseCode: {
          type: "string",
          description: "Use with classDate to bulk-mark all readings for a session.",
        },
        classDate: {
          type: "string",
          description: "ISO 8601 date (YYYY-MM-DD). Required with courseCode.",
        },
      },
    },
  },
] as const;

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

const numberArg = (args: ToolArgs, key: string): number => {
  const v = args[key];
  if (typeof v !== "number") throw new Error(`Argument '${key}' must be a number`);
  return v;
};

export const handleStatusTool = async (
  name: string,
  args: ToolArgs,
  userId: string,
): Promise<string> => {
  const convex = getConvexClient();

  switch (name) {
    case "mark_submitted": {
      const result = await convex.mutation("assignments:markSubmitted" as any, {
        assignmentId: stringArg(args, "assignmentId"),
      });
      return JSON.stringify(result, null, 2);
    }

    case "record_grade": {
      const result = await convex.mutation("assignments:recordGrade" as any, {
        assignmentId: stringArg(args, "assignmentId"),
        grade: numberArg(args, "grade"),
      });
      return JSON.stringify(result, null, 2);
    }

    case "mark_reading_done": {
      const readingId = optionalStringArg(args, "readingId");
      const courseCode = optionalStringArg(args, "courseCode");
      const classDate = optionalStringArg(args, "classDate");

      if (readingId && (courseCode || classDate)) {
        throw new Error(
          "Provide either readingId, OR courseCode+classDate — not both",
        );
      }
      if (readingId) {
        const result = await convex.mutation("readings:markDone" as any, {
          readingId,
        });
        return JSON.stringify(result, null, 2);
      }
      if (!courseCode || !classDate) {
        throw new Error(
          "Must provide either readingId, OR both courseCode and classDate",
        );
      }
      const course: any = await convex.query("courses:getByCode" as any, {
        userId,
        code: courseCode,
      });
      if (!course) throw new Error(`Course '${courseCode}' not found`);
      const result = await convex.mutation("readings:markDoneForSession" as any, {
        userId,
        courseId: course._id,
        classDate,
      });
      return JSON.stringify(result, null, 2);
    }

    default:
      throw new Error(`Unknown status tool: ${name}`);
  }
};
