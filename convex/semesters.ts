import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";

export const create = mutationGeneric({
  args: {
    userId: v.string(),
    name: v.string(),
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
    const createdAt = new Date().toISOString();
    const id = await ctx.db.insert("semesters", {
      userId: args.userId,
      name: args.name,
      status: "active",
      startDate: args.startDate,
      endDate: args.endDate,
      createdAt,
    });
    const doc = await ctx.db.get(id);
    return doc;
  },
});

export const get = queryGeneric({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db.get(ctx.db.normalizeId("semesters", args.id)!);
  },
});

export const listForUser = queryGeneric({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("semesters")
      .withIndex("by_user", (q: any) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

export const getActiveForUser = queryGeneric({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("semesters")
      .withIndex("by_user_status", (q: any) =>
        q.eq("userId", args.userId).eq("status", "active"),
      )
      .order("desc")
      .collect();
    return rows[0] ?? null;
  },
});

export const archive = mutationGeneric({
  args: { semesterId: v.string() },
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("semesters", args.semesterId);
    if (!id) throw new Error(`Invalid semesterId: ${args.semesterId}`);
    await ctx.db.patch(id, { status: "archived" });
    return await ctx.db.get(id);
  },
});

export const getGpaData = queryGeneric({
  args: { userId: v.string(), semesterId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    let semester: any;
    if (args.semesterId) {
      const id = ctx.db.normalizeId("semesters", args.semesterId);
      semester = id ? await ctx.db.get(id) : null;
    } else {
      semester = await ctx.db
        .query("semesters")
        .withIndex("by_user_status", (q: any) =>
          q.eq("userId", args.userId).eq("status", "active"),
        )
        .order("desc")
        .first();
    }
    if (!semester) return { semester: null, courses: [] };

    const courses = await ctx.db
      .query("courses")
      .withIndex("by_user_semester", (q: any) =>
        q.eq("userId", args.userId).eq("semesterId", semester._id),
      )
      .collect();

    const courseData = await Promise.all(
      courses.map(async (course: any) => {
        const assignments = await ctx.db
          .query("assignments")
          .withIndex("by_user_course", (q: any) =>
            q.eq("userId", args.userId).eq("courseId", course._id),
          )
          .collect();
        return { course, assignments };
      }),
    );

    return { semester, courses: courseData };
  },
});
