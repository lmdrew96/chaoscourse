import { queryGeneric } from "convex/server";
import { v } from "convex/values";

export const listForCourse = queryGeneric({
  args: { courseId: v.string() },
  handler: async (ctx, args) => {
    const courseId = ctx.db.normalizeId("courses", args.courseId);
    if (!courseId) return [];
    return await ctx.db
      .query("texts")
      .withIndex("by_course", (q: any) => q.eq("courseId", courseId))
      .collect();
  },
});
