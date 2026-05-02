import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";

export const listForUser = queryGeneric({
  args: {
    userId: v.string(),
    courseId: v.optional(v.string()),
    completed: v.optional(v.boolean()),
    classDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let rows: any[];
    if (args.courseId) {
      const courseId = ctx.db.normalizeId("courses", args.courseId);
      if (!courseId) return [];
      rows = await ctx.db
        .query("readings")
        .withIndex("by_user_course", (q: any) =>
          q.eq("userId", args.userId).eq("courseId", courseId),
        )
        .collect();
    } else {
      rows = await ctx.db
        .query("readings")
        .withIndex("by_user_completed", (q: any) => q.eq("userId", args.userId))
        .collect();
    }
    return rows.filter((r: any) => {
      if (args.completed !== undefined && r.completed !== args.completed) return false;
      if (args.classDate !== undefined && r.classDate !== args.classDate) return false;
      return true;
    });
  },
});

export const markDone = mutationGeneric({
  args: { readingId: v.string() },
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("readings", args.readingId);
    if (!id) throw new Error(`Invalid readingId: ${args.readingId}`);
    await ctx.db.patch(id, { completed: true });
    return await ctx.db.get(id);
  },
});

export const markDoneForSession = mutationGeneric({
  args: { userId: v.string(), courseId: v.string(), classDate: v.string() },
  handler: async (ctx, args) => {
    const courseId = ctx.db.normalizeId("courses", args.courseId);
    if (!courseId) throw new Error(`Invalid courseId: ${args.courseId}`);
    const rows = await ctx.db
      .query("readings")
      .withIndex("by_course_classDate", (q: any) =>
        q.eq("courseId", courseId).eq("classDate", args.classDate),
      )
      .collect();
    const targets = rows.filter((r: any) => r.userId === args.userId);
    for (const r of targets) {
      await ctx.db.patch(r._id, { completed: true });
    }
    return { updated: targets.length };
  },
});

export const listUnreadInRange = queryGeneric({
  args: {
    userId: v.string(),
    startDate: v.string(),
    endDate: v.string(),
    courseId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("readings")
      .withIndex("by_user_completed", (q: any) =>
        q.eq("userId", args.userId).eq("completed", false),
      )
      .collect();

    return rows.filter((r: any) => {
      if (!r.classDate) return false;
      if (r.classDate < args.startDate || r.classDate > args.endDate) return false;
      if (args.courseId) {
        const courseId = ctx.db.normalizeId("courses", args.courseId);
        if (r.courseId !== courseId) return false;
      }
      return true;
    });
  },
});
