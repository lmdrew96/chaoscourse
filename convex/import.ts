import { mutationGeneric } from "convex/server";
import { v } from "convex/values";

const courseFields = v.object({
  code: v.string(),
  name: v.string(),
  instructor: v.string(),
  instructor_email: v.union(v.string(), v.null()),
  instructor_phone: v.union(v.string(), v.null()),
  office_hours: v.union(v.string(), v.null()),
  schedule: v.string(),
  location: v.union(v.string(), v.null()),
  credit_hours: v.union(v.number(), v.null()),
});

const textFields = v.object({
  title: v.string(),
  author: v.union(v.string(), v.null()),
  edition: v.union(v.string(), v.null()),
  notes: v.union(v.string(), v.null()),
});

const gradingComponentFields = v.object({
  name: v.string(),
  weight: v.number(),
  notes: v.union(v.string(), v.null()),
});

const assignmentFields = v.object({
  title: v.string(),
  type: v.union(
    v.literal("exam"),
    v.literal("essay"),
    v.literal("quiz"),
    v.literal("project"),
    v.literal("discussion"),
    v.literal("other"),
  ),
  due_date: v.union(v.string(), v.null()),
  weight: v.union(v.number(), v.null()),
  notes: v.union(v.string(), v.null()),
});

const readingItemFields = v.object({
  title: v.string(),
  author: v.union(v.string(), v.null()),
  source: v.union(v.string(), v.null()),
  pages: v.union(v.string(), v.null()),
});

const readingSessionFields = v.object({
  class_date: v.union(v.string(), v.null()),
  raw_schedule_text: v.optional(v.string()),
  items: v.array(readingItemFields),
});

const policyFields = v.object({
  category: v.union(
    v.literal("attendance"),
    v.literal("late_work"),
    v.literal("participation"),
    v.literal("academic_integrity"),
    v.literal("technology"),
    v.literal("other"),
  ),
  description: v.string(),
});

const nullToUndef = <T>(v: T | null): T | undefined => (v === null ? undefined : v);

export const commitParsedSyllabus = mutationGeneric({
  args: {
    userId: v.string(),
    semesterId: v.string(),
    parsed: v.object({
      course: courseFields,
      texts: v.array(textFields),
      grading: v.object({
        components: v.array(gradingComponentFields),
        scale: v.union(v.string(), v.null()),
        weights_verified: v.boolean(),
      }),
      assignments: v.array(assignmentFields),
      readings: v.array(readingSessionFields),
      policies: v.array(policyFields),
      warnings: v.array(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const semesterId = ctx.db.normalizeId("semesters", args.semesterId);
    if (!semesterId) throw new Error(`Invalid semesterId: ${args.semesterId}`);

    const createdAt = new Date().toISOString();
    const { userId, parsed } = args;

    const courseId = await ctx.db.insert("courses", {
      userId,
      semesterId,
      code: parsed.course.code,
      name: parsed.course.name,
      instructor: parsed.course.instructor,
      instructorEmail: nullToUndef(parsed.course.instructor_email),
      instructorPhone: nullToUndef(parsed.course.instructor_phone),
      officeHours: nullToUndef(parsed.course.office_hours),
      schedule: parsed.course.schedule,
      location: nullToUndef(parsed.course.location),
      creditHours: nullToUndef(parsed.course.credit_hours),
      createdAt,
    });

    for (const t of parsed.texts) {
      await ctx.db.insert("texts", {
        userId,
        courseId,
        title: t.title,
        author: nullToUndef(t.author),
        edition: nullToUndef(t.edition),
        notes: nullToUndef(t.notes),
      });
    }

    for (const c of parsed.grading.components) {
      await ctx.db.insert("gradingComponents", {
        userId,
        courseId,
        name: c.name,
        weight: c.weight,
        notes: nullToUndef(c.notes),
      });
    }

    for (const a of parsed.assignments) {
      await ctx.db.insert("assignments", {
        userId,
        courseId,
        title: a.title,
        type: a.type,
        dueDate: nullToUndef(a.due_date),
        weight: nullToUndef(a.weight),
        status: "upcoming",
        notes: nullToUndef(a.notes),
      });
    }

    let readingCount = 0;
    for (const session of parsed.readings) {
      for (const item of session.items) {
        await ctx.db.insert("readings", {
          userId,
          courseId,
          classDate: nullToUndef(session.class_date),
          title: item.title,
          author: nullToUndef(item.author),
          source: nullToUndef(item.source),
          pages: nullToUndef(item.pages),
          completed: false,
        });
        readingCount++;
      }
    }

    for (const p of parsed.policies) {
      await ctx.db.insert("policies", {
        userId,
        courseId,
        category: p.category,
        description: p.description,
      });
    }

    return {
      courseId,
      courseCode: parsed.course.code,
      counts: {
        texts: parsed.texts.length,
        gradingComponents: parsed.grading.components.length,
        assignments: parsed.assignments.length,
        readings: readingCount,
        policies: parsed.policies.length,
      },
    };
  },
});
