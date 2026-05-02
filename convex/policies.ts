import { queryGeneric } from "convex/server";
import { v } from "convex/values";

export const listForCourse = queryGeneric({
  args: { courseId: v.string(), category: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const courseId = ctx.db.normalizeId("courses", args.courseId);
    if (!courseId) return [];
    if (args.category) {
      return await ctx.db
        .query("policies")
        .withIndex("by_course_category", (q: any) =>
          q.eq("courseId", courseId).eq("category", args.category),
        )
        .collect();
    }
    return await ctx.db
      .query("policies")
      .withIndex("by_course", (q: any) => q.eq("courseId", courseId))
      .collect();
  },
});
