import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const semesterStatus = v.union(v.literal("active"), v.literal("archived"));

const assignmentType = v.union(
  v.literal("exam"),
  v.literal("essay"),
  v.literal("quiz"),
  v.literal("project"),
  v.literal("discussion"),
  v.literal("other"),
);

const assignmentStatus = v.union(
  v.literal("upcoming"),
  v.literal("submitted"),
  v.literal("graded"),
);

const policyCategory = v.union(
  v.literal("attendance"),
  v.literal("late_work"),
  v.literal("participation"),
  v.literal("academic_integrity"),
  v.literal("technology"),
  v.literal("other"),
);

export default defineSchema({
  semesters: defineTable({
    userId: v.string(),
    name: v.string(),
    status: semesterStatus,
    startDate: v.string(),
    endDate: v.string(),
    createdAt: v.string(),
  })
    .index("by_user", ["userId"])
    .index("by_user_status", ["userId", "status"]),

  courses: defineTable({
    userId: v.string(),
    semesterId: v.id("semesters"),
    code: v.string(),
    name: v.string(),
    instructor: v.string(),
    instructorEmail: v.optional(v.string()),
    instructorPhone: v.optional(v.string()),
    officeHours: v.optional(v.string()),
    schedule: v.string(),
    location: v.optional(v.string()),
    creditHours: v.optional(v.number()),
    createdAt: v.string(),
  })
    .index("by_user_semester", ["userId", "semesterId"])
    .index("by_user_code", ["userId", "code"]),

  gradingComponents: defineTable({
    userId: v.string(),
    courseId: v.id("courses"),
    name: v.string(),
    weight: v.number(),
    notes: v.optional(v.string()),
  }).index("by_course", ["courseId"]),

  assignments: defineTable({
    userId: v.string(),
    courseId: v.id("courses"),
    title: v.string(),
    type: assignmentType,
    dueDate: v.optional(v.string()),
    weight: v.optional(v.number()),
    status: assignmentStatus,
    grade: v.optional(v.number()),
    notes: v.optional(v.string()),
  })
    .index("by_user_course", ["userId", "courseId"])
    .index("by_user_status", ["userId", "status"])
    .index("by_user_due", ["userId", "dueDate"]),

  readings: defineTable({
    userId: v.string(),
    courseId: v.id("courses"),
    classDate: v.optional(v.string()),
    title: v.string(),
    author: v.optional(v.string()),
    source: v.optional(v.string()),
    pages: v.optional(v.string()),
    completed: v.boolean(),
  })
    .index("by_user_course", ["userId", "courseId"])
    .index("by_course_classDate", ["courseId", "classDate"])
    .index("by_user_completed", ["userId", "completed"]),

  policies: defineTable({
    userId: v.string(),
    courseId: v.id("courses"),
    category: policyCategory,
    description: v.string(),
  })
    .index("by_course", ["courseId"])
    .index("by_course_category", ["courseId", "category"]),

  texts: defineTable({
    userId: v.string(),
    courseId: v.id("courses"),
    title: v.string(),
    author: v.optional(v.string()),
    edition: v.optional(v.string()),
    notes: v.optional(v.string()),
  }).index("by_course", ["courseId"]),

  oauthClients: defineTable({
    clientId: v.string(),
    clientSecret: v.string(),
    redirectUris: v.array(v.string()),
    clientName: v.optional(v.string()),
    createdAt: v.string(),
  }).index("by_clientId", ["clientId"]),

  oauthCodes: defineTable({
    code: v.string(),
    clientId: v.string(),
    userId: v.string(),
    redirectUri: v.string(),
    codeChallenge: v.string(),
    expiresAt: v.string(),
  }).index("by_code", ["code"]),

  mcpTokens: defineTable({
    token: v.string(),
    userId: v.string(),
    createdAt: v.string(),
  })
    .index("by_token", ["token"])
    .index("by_user", ["userId"]),
});
