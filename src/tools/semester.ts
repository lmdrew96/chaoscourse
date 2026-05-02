import { getConvexClient } from "../lib/convex.js";

export type ToolArgs = Record<string, unknown>;

export const SEMESTER_TOOL_DEFINITIONS = [
  {
    name: "get_gpa",
    description:
      "Calculate current GPA from recorded grades. Returns per-course breakdown (current grade, graded/remaining weight, projected grade) plus cumulative GPA on a 4.0 scale when credit hours are available.",
    inputSchema: {
      type: "object" as const,
      properties: {
        semesterId: {
          type: "string",
          description: "Defaults to the active semester.",
        },
      },
    },
  },
  {
    name: "archive_semester",
    description:
      "Archive a semester. Stays queryable but is no longer treated as active for default-scoped tools.",
    inputSchema: {
      type: "object" as const,
      properties: {
        semesterId: { type: "string" },
      },
      required: ["semesterId"],
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

const gradeToGpaPoints = (grade: number): number => {
  if (grade >= 93) return 4.0;
  if (grade >= 90) return 3.7;
  if (grade >= 87) return 3.3;
  if (grade >= 83) return 3.0;
  if (grade >= 80) return 2.7;
  if (grade >= 77) return 2.3;
  if (grade >= 73) return 2.0;
  if (grade >= 70) return 1.7;
  if (grade >= 67) return 1.3;
  if (grade >= 63) return 1.0;
  if (grade >= 60) return 0.7;
  return 0.0;
};

const gradeToLetter = (grade: number): string => {
  if (grade >= 93) return "A";
  if (grade >= 90) return "A-";
  if (grade >= 87) return "B+";
  if (grade >= 83) return "B";
  if (grade >= 80) return "B-";
  if (grade >= 77) return "C+";
  if (grade >= 73) return "C";
  if (grade >= 70) return "C-";
  if (grade >= 67) return "D+";
  if (grade >= 63) return "D";
  if (grade >= 60) return "D-";
  return "F";
};

interface CourseSummary {
  courseId: string;
  code: string;
  name: string;
  creditHours: number | null;
  currentGrade: number | null;
  letterGrade: string | null;
  gradedWeight: number;
  remainingWeight: number;
  projectedGrade: number | null;
}

const summarizeCourse = (course: any, assignments: any[]): CourseSummary => {
  const graded = assignments.filter(
    (a) => a.status === "graded" && typeof a.grade === "number" && typeof a.weight === "number",
  );
  const totalWeightWithWeights = assignments
    .filter((a: any) => typeof a.weight === "number")
    .reduce((s: number, a: any) => s + a.weight, 0);
  const gradedWeight = graded.reduce((s: number, a: any) => s + a.weight, 0);
  const remainingWeight = Math.max(0, totalWeightWithWeights - gradedWeight);

  let currentGrade: number | null = null;
  if (gradedWeight > 0) {
    const weightedSum = graded.reduce((s: number, a: any) => s + a.grade * a.weight, 0);
    currentGrade = weightedSum / gradedWeight;
  }

  const projectedGrade = currentGrade;

  return {
    courseId: course._id,
    code: course.code,
    name: course.name,
    creditHours: course.creditHours ?? null,
    currentGrade: currentGrade !== null ? Number(currentGrade.toFixed(2)) : null,
    letterGrade: currentGrade !== null ? gradeToLetter(currentGrade) : null,
    gradedWeight: Number(gradedWeight.toFixed(2)),
    remainingWeight: Number(remainingWeight.toFixed(2)),
    projectedGrade: projectedGrade !== null ? Number(projectedGrade.toFixed(2)) : null,
  };
};

export const handleSemesterTool = async (
  name: string,
  args: ToolArgs,
  userId: string,
): Promise<string> => {
  const convex = getConvexClient();

  switch (name) {
    case "get_gpa": {
      const semesterId = optionalStringArg(args, "semesterId");
      const data = (await convex.query("semesters:getGpaData" as any, {
        userId,
        semesterId,
      })) as { semester: any | null; courses: { course: any; assignments: any[] }[] };

      if (!data.semester) {
        return JSON.stringify(
          { error: "No active semester found. Pass semesterId explicitly or create a semester first." },
          null,
          2,
        );
      }

      const summaries = data.courses.map(({ course, assignments }) =>
        summarizeCourse(course, assignments),
      );

      const eligibleForGpa = summaries.filter(
        (s) => typeof s.creditHours === "number" && s.currentGrade !== null,
      );
      let cumulativeGpa: number | null = null;
      let cumulativeCredits = 0;
      if (eligibleForGpa.length > 0) {
        const totalCredits = eligibleForGpa.reduce(
          (s, c) => s + (c.creditHours as number),
          0,
        );
        if (totalCredits > 0) {
          const totalPoints = eligibleForGpa.reduce(
            (s, c) =>
              s + gradeToGpaPoints(c.currentGrade as number) * (c.creditHours as number),
            0,
          );
          cumulativeGpa = Number((totalPoints / totalCredits).toFixed(3));
          cumulativeCredits = totalCredits;
        }
      }

      const missingCreditHours = summaries
        .filter((s) => s.creditHours === null)
        .map((s) => s.code);

      return JSON.stringify(
        {
          semester: data.semester,
          courses: summaries,
          cumulativeGpa,
          cumulativeCredits,
          gpaCoverage: {
            coursesIncluded: eligibleForGpa.map((s) => s.code),
            coursesExcludedNoCredit: missingCreditHours,
            coursesExcludedNoGrades: summaries
              .filter((s) => s.currentGrade === null)
              .map((s) => s.code),
          },
        },
        null,
        2,
      );
    }

    case "archive_semester": {
      const result = await convex.mutation("semesters:archive" as any, {
        semesterId: stringArg(args, "semesterId"),
      });
      return JSON.stringify(result, null, 2);
    }

    default:
      throw new Error(`Unknown semester tool: ${name}`);
  }
};
