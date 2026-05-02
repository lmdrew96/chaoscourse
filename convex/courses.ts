import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";

export const createManual = mutationGeneric({
  args: {
    userId: v.string(),
    semesterId: v.string(),
    code: v.string(),
    name: v.string(),
    instructor: v.string(),
    instructorEmail: v.optional(v.string()),
    instructorPhone: v.optional(v.string()),
    officeHours: v.optional(v.string()),
    schedule: v.string(),
    location: v.optional(v.string()),
    creditHours: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const semesterId = ctx.db.normalizeId("semesters", args.semesterId);
    if (!semesterId) throw new Error(`Invalid semesterId: ${args.semesterId}`);

    const createdAt = new Date().toISOString();
    const id = await ctx.db.insert("courses", {
      userId: args.userId,
      semesterId,
      code: args.code,
      name: args.name,
      instructor: args.instructor,
      instructorEmail: args.instructorEmail,
      instructorPhone: args.instructorPhone,
      officeHours: args.officeHours,
      schedule: args.schedule,
      location: args.location,
      creditHours: args.creditHours,
      createdAt,
    });
    return await ctx.db.get(id);
  },
});

export const getByCode = queryGeneric({
  args: { userId: v.string(), code: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("courses")
      .withIndex("by_user_code", (q: any) =>
        q.eq("userId", args.userId).eq("code", args.code),
      )
      .first();
  },
});

export const listForSemester = queryGeneric({
  args: { userId: v.string(), semesterId: v.string() },
  handler: async (ctx, args) => {
    const semesterId = ctx.db.normalizeId("semesters", args.semesterId);
    if (!semesterId) return [];
    return await ctx.db
      .query("courses")
      .withIndex("by_user_semester", (q: any) =>
        q.eq("userId", args.userId).eq("semesterId", semesterId),
      )
      .collect();
  },
});

export const listForActiveSemester = queryGeneric({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const semester = await ctx.db
      .query("semesters")
      .withIndex("by_user_status", (q: any) =>
        q.eq("userId", args.userId).eq("status", "active"),
      )
      .order("desc")
      .first();
    if (!semester) return { semester: null, courses: [] };
    const courses = await ctx.db
      .query("courses")
      .withIndex("by_user_semester", (q: any) =>
        q.eq("userId", args.userId).eq("semesterId", semester._id),
      )
      .collect();
    return { semester, courses };
  },
});

export const getCourseDetails = queryGeneric({
  args: { userId: v.string(), code: v.string() },
  handler: async (ctx, args) => {
    const course = await ctx.db
      .query("courses")
      .withIndex("by_user_code", (q: any) =>
        q.eq("userId", args.userId).eq("code", args.code),
      )
      .first();
    if (!course) return null;

    const [gradingComponents, policies, texts] = await Promise.all([
      ctx.db
        .query("gradingComponents")
        .withIndex("by_course", (q: any) => q.eq("courseId", course._id))
        .collect(),
      ctx.db
        .query("policies")
        .withIndex("by_course", (q: any) => q.eq("courseId", course._id))
        .collect(),
      ctx.db
        .query("texts")
        .withIndex("by_course", (q: any) => q.eq("courseId", course._id))
        .collect(),
    ]);

    return { course, gradingComponents, policies, texts };
  },
});
