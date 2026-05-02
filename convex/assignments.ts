import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";

export const listForUser = queryGeneric({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("assignments")
      .withIndex("by_user_status", (q: any) => q.eq("userId", args.userId))
      .collect();
  },
});

export const listForCourse = queryGeneric({
  args: { userId: v.string(), courseId: v.string() },
  handler: async (ctx, args) => {
    const courseId = ctx.db.normalizeId("courses", args.courseId);
    if (!courseId) return [];
    return await ctx.db
      .query("assignments")
      .withIndex("by_user_course", (q: any) =>
        q.eq("userId", args.userId).eq("courseId", courseId),
      )
      .collect();
  },
});

export const listUpcomingInRange = queryGeneric({
  args: {
    userId: v.string(),
    startDate: v.string(),
    endDate: v.string(),
    courseId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const upcoming = await ctx.db
      .query("assignments")
      .withIndex("by_user_status", (q: any) =>
        q.eq("userId", args.userId).eq("status", "upcoming"),
      )
      .collect();

    return upcoming.filter((a: any) => {
      if (!a.dueDate) return false;
      if (a.dueDate < args.startDate || a.dueDate > args.endDate) return false;
      if (args.courseId) {
        const courseId = ctx.db.normalizeId("courses", args.courseId);
        if (a.courseId !== courseId) return false;
      }
      return true;
    });
  },
});

export const listGradedForCourse = queryGeneric({
  args: { userId: v.string(), courseId: v.string() },
  handler: async (ctx, args) => {
    const courseId = ctx.db.normalizeId("courses", args.courseId);
    if (!courseId) return [];
    return await ctx.db
      .query("assignments")
      .withIndex("by_user_course", (q: any) =>
        q.eq("userId", args.userId).eq("courseId", courseId),
      )
      .filter((q: any) => q.eq(q.field("status"), "graded"))
      .collect();
  },
});

export const get = queryGeneric({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("assignments", args.id);
    if (!id) return null;
    return await ctx.db.get(id);
  },
});

export const markSubmitted = mutationGeneric({
  args: { assignmentId: v.string() },
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("assignments", args.assignmentId);
    if (!id) throw new Error(`Invalid assignmentId: ${args.assignmentId}`);
    await ctx.db.patch(id, { status: "submitted" });
    return await ctx.db.get(id);
  },
});

export const recordGrade = mutationGeneric({
  args: { assignmentId: v.string(), grade: v.number() },
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("assignments", args.assignmentId);
    if (!id) throw new Error(`Invalid assignmentId: ${args.assignmentId}`);
    if (args.grade < 0 || args.grade > 100) {
      throw new Error(`Grade ${args.grade} out of range (expected 0-100)`);
    }
    await ctx.db.patch(id, { status: "graded", grade: args.grade });
    const updated = await ctx.db.get(id);
    if (!updated) throw new Error("Failed to read back updated assignment");

    const courseAssignments = await ctx.db
      .query("assignments")
      .withIndex("by_user_course", (q: any) =>
        q.eq("userId", (updated as any).userId).eq("courseId", (updated as any).courseId),
      )
      .filter((q: any) => q.eq(q.field("status"), "graded"))
      .collect();

    const weighted = courseAssignments.filter(
      (a: any) => typeof a.grade === "number" && typeof a.weight === "number",
    );
    let courseGrade: number | null = null;
    if (weighted.length > 0) {
      const totalWeight = weighted.reduce((s: number, a: any) => s + a.weight, 0);
      if (totalWeight > 0) {
        const weightedSum = weighted.reduce(
          (s: number, a: any) => s + a.grade * a.weight,
          0,
        );
        courseGrade = weightedSum / totalWeight;
      }
    }

    return { assignment: updated, courseGrade };
  },
});
