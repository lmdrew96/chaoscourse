import { getConvexClient } from "../lib/convex";

export type ToolArgs = Record<string, unknown>;

export const QUERY_TOOL_DEFINITIONS = [
  {
    name: "whats_due",
    description:
      "List upcoming assignments and unread readings due within the next N days. Defaults to 7 days.",
    inputSchema: {
      type: "object" as const,
      properties: {
        courseCode: {
          type: "string",
          description: "Optional course code filter (e.g., 'LING 202')",
        },
        daysAhead: {
          type: "number",
          description: "How many days ahead to look. Default: 7.",
        },
      },
    },
  },
  {
    name: "prioritize",
    description:
      "Rank upcoming assignments by composite priority score (urgency × 0.4 + weight × 0.4 + standing × 0.2). Returns top N with score breakdown.",
    inputSchema: {
      type: "object" as const,
      properties: {
        courseCode: {
          type: "string",
          description: "Optional course code filter",
        },
        limit: {
          type: "number",
          description: "Max results. Default: 5.",
        },
      },
    },
  },
  {
    name: "get_schedule",
    description:
      "Get class sessions for a given day or week, including the readings due for those sessions.",
    inputSchema: {
      type: "object" as const,
      properties: {
        date: {
          type: "string",
          description: "ISO 8601 date (YYYY-MM-DD). Default: today (UTC).",
        },
        range: {
          type: "string",
          enum: ["day", "week"],
          description: "Default: 'day'.",
        },
      },
    },
  },
  {
    name: "get_course",
    description:
      "Full details for one course: course info + grading components + policies + texts.",
    inputSchema: {
      type: "object" as const,
      properties: {
        courseCode: { type: "string" },
      },
      required: ["courseCode"],
    },
  },
  {
    name: "list_courses",
    description: "List all courses for the active semester.",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "get_readings",
    description:
      "Filter readings by course, completion status, and/or class date.",
    inputSchema: {
      type: "object" as const,
      properties: {
        courseCode: { type: "string" },
        completed: { type: "boolean" },
        classDate: {
          type: "string",
          description: "ISO 8601 date (YYYY-MM-DD)",
        },
      },
    },
  },
  {
    name: "get_policies",
    description: "List policies for a course, optionally filtered by category.",
    inputSchema: {
      type: "object" as const,
      properties: {
        courseCode: { type: "string" },
        category: {
          type: "string",
          enum: [
            "attendance",
            "late_work",
            "participation",
            "academic_integrity",
            "technology",
            "other",
          ],
        },
      },
      required: ["courseCode"],
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

const optionalNumberArg = (args: ToolArgs, key: string): number | undefined => {
  const v = args[key];
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "number") throw new Error(`Argument '${key}' must be a number`);
  return v;
};

const optionalBooleanArg = (args: ToolArgs, key: string): boolean | undefined => {
  const v = args[key];
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "boolean") throw new Error(`Argument '${key}' must be a boolean`);
  return v;
};

const todayUtc = (): string => new Date().toISOString().slice(0, 10);

const addDays = (isoDate: string, days: number): string => {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

const daysBetween = (from: string, to: string): number => {
  const a = new Date(`${from}T00:00:00Z`).getTime();
  const b = new Date(`${to}T00:00:00Z`).getTime();
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
};

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

const computeCourseGrade = (graded: any[]): number | null => {
  const weighted = graded.filter((a) => typeof a.grade === "number" && typeof a.weight === "number");
  if (weighted.length === 0) return null;
  const totalWeight = weighted.reduce((s, a) => s + a.weight, 0);
  if (totalWeight === 0) return null;
  const weightedSum = weighted.reduce((s, a) => s + a.grade * a.weight, 0);
  return weightedSum / totalWeight;
};

const resolveCourseId = async (
  convex: ReturnType<typeof getConvexClient>,
  userId: string,
  courseCode: string | undefined,
): Promise<string | undefined> => {
  if (!courseCode) return undefined;
  const course: any = await convex.query("courses:getByCode" as any, {
    userId,
    code: courseCode,
  });
  if (!course) throw new Error(`Course '${courseCode}' not found`);
  return course._id as string;
};

export const handleQueryTool = async (
  name: string,
  args: ToolArgs,
  userId: string,
): Promise<string> => {
  const convex = getConvexClient();

  switch (name) {
    case "whats_due": {
      const daysAhead = optionalNumberArg(args, "daysAhead") ?? 7;
      const courseCode = optionalStringArg(args, "courseCode");
      const courseId = await resolveCourseId(convex, userId, courseCode);
      const start = todayUtc();
      const end = addDays(start, daysAhead);

      const [assignments, readings] = await Promise.all([
        convex.query("assignments:listUpcomingInRange" as any, {
          userId,
          startDate: start,
          endDate: end,
          courseId,
        }),
        convex.query("readings:listUnreadInRange" as any, {
          userId,
          startDate: start,
          endDate: end,
          courseId,
        }),
      ]);

      const sortedAssignments = [...(assignments as any[])].sort((a, b) =>
        (a.dueDate ?? "").localeCompare(b.dueDate ?? ""),
      );
      const sortedReadings = [...(readings as any[])].sort((a, b) =>
        (a.classDate ?? "").localeCompare(b.classDate ?? ""),
      );

      return JSON.stringify(
        {
          rangeStart: start,
          rangeEnd: end,
          assignments: sortedAssignments,
          readings: sortedReadings,
        },
        null,
        2,
      );
    }

    case "prioritize": {
      const limit = optionalNumberArg(args, "limit") ?? 5;
      const courseCode = optionalStringArg(args, "courseCode");
      const courseFilter = await resolveCourseId(convex, userId, courseCode);

      const today = todayUtc();
      const horizon = addDays(today, 14);

      const upcoming = (await convex.query("assignments:listUpcomingInRange" as any, {
        userId,
        startDate: today,
        endDate: horizon,
        courseId: courseFilter,
      })) as any[];

      const courseIds = Array.from(new Set(upcoming.map((a) => a.courseId)));
      const courseDocs = await Promise.all(
        courseIds.map((id) =>
          convex.query("assignments:listGradedForCourse" as any, {
            userId,
            courseId: id,
          }),
        ),
      );
      const gradesByCourse = new Map<string, number | null>();
      courseIds.forEach((id, i) => {
        gradesByCourse.set(id, computeCourseGrade(courseDocs[i] as any[]));
      });

      const courseList = (await convex.query("courses:listForActiveSemester" as any, {
        userId,
      })) as { courses: any[] };
      const courseMetaMap = new Map<string, any>();
      for (const c of courseList.courses) courseMetaMap.set(c._id, c);

      const scored = upcoming
        .filter((a) => typeof a.dueDate === "string")
        .map((a) => {
          const days = daysBetween(today, a.dueDate);
          const urgency = clamp01(1 - days / 14);
          const weight = typeof a.weight === "number" ? a.weight / 100 : 0;
          const courseGrade = gradesByCourse.get(a.courseId) ?? null;
          const standing = courseGrade !== null && courseGrade < 80 ? 1 : 0;
          const priority = urgency * 0.4 + weight * 0.4 + standing * 0.2;
          const courseMeta = courseMetaMap.get(a.courseId);
          return {
            assignmentId: a._id,
            title: a.title,
            type: a.type,
            courseCode: courseMeta?.code ?? null,
            dueDate: a.dueDate,
            assignmentWeight: a.weight ?? null,
            priority: Number(priority.toFixed(4)),
            breakdown: {
              urgency: Number(urgency.toFixed(4)),
              weight: Number(weight.toFixed(4)),
              standing,
              currentCourseGrade: courseGrade,
            },
          };
        })
        .sort((a, b) => b.priority - a.priority)
        .slice(0, limit);

      return JSON.stringify(scored, null, 2);
    }

    case "get_schedule": {
      const date = optionalStringArg(args, "date") ?? todayUtc();
      const range = optionalStringArg(args, "range") ?? "day";
      const endDate = range === "week" ? addDays(date, 6) : date;

      const [readings, courseList] = await Promise.all([
        convex.query("readings:listForUser" as any, { userId }),
        convex.query("courses:listForActiveSemester" as any, { userId }),
      ]);

      const inRange = (readings as any[]).filter((r) => {
        if (!r.classDate) return false;
        return r.classDate >= date && r.classDate <= endDate;
      });

      const courseById = new Map<string, any>();
      for (const c of (courseList as { courses: any[] }).courses) {
        courseById.set(c._id, c);
      }

      const sessionsByDate = new Map<string, any[]>();
      for (const r of inRange) {
        const list = sessionsByDate.get(r.classDate) ?? [];
        list.push(r);
        sessionsByDate.set(r.classDate, list);
      }

      const sessions = Array.from(sessionsByDate.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([classDate, items]) => {
          const byCourse = new Map<string, any[]>();
          for (const item of items) {
            const list = byCourse.get(item.courseId) ?? [];
            list.push(item);
            byCourse.set(item.courseId, list);
          }
          return {
            classDate,
            classes: Array.from(byCourse.entries()).map(([cid, readings]) => {
              const course = courseById.get(cid);
              return {
                courseCode: course?.code ?? null,
                courseName: course?.name ?? null,
                schedule: course?.schedule ?? null,
                location: course?.location ?? null,
                readings,
              };
            }),
          };
        });

      return JSON.stringify(
        {
          rangeStart: date,
          rangeEnd: endDate,
          sessions,
          allCourses: (courseList as { courses: any[] }).courses,
        },
        null,
        2,
      );
    }

    case "get_course": {
      const courseCode = stringArg(args, "courseCode");
      const result = await convex.query("courses:getCourseDetails" as any, {
        userId,
        code: courseCode,
      });
      if (!result) throw new Error(`Course '${courseCode}' not found`);
      return JSON.stringify(result, null, 2);
    }

    case "list_courses": {
      const result = await convex.query("courses:listForActiveSemester" as any, {
        userId,
      });
      return JSON.stringify(result, null, 2);
    }

    case "get_readings": {
      const courseCode = optionalStringArg(args, "courseCode");
      const courseId = await resolveCourseId(convex, userId, courseCode);
      const completed = optionalBooleanArg(args, "completed");
      const classDate = optionalStringArg(args, "classDate");
      const result = await convex.query("readings:listForUser" as any, {
        userId,
        courseId,
        completed,
        classDate,
      });
      return JSON.stringify(result, null, 2);
    }

    case "get_policies": {
      const courseCode = stringArg(args, "courseCode");
      const category = optionalStringArg(args, "category");
      const course: any = await convex.query("courses:getByCode" as any, {
        userId,
        code: courseCode,
      });
      if (!course) throw new Error(`Course '${courseCode}' not found`);
      const result = await convex.query("policies:listForCourse" as any, {
        courseId: course._id,
        category,
      });
      return JSON.stringify(result, null, 2);
    }

    default:
      throw new Error(`Unknown query tool: ${name}`);
  }
};
