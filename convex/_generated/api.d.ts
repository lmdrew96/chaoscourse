/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as assignments from "../assignments.js";
import type * as courses from "../courses.js";
import type * as gradingComponents from "../gradingComponents.js";
import type * as import_ from "../import.js";
import type * as oauth from "../oauth.js";
import type * as policies from "../policies.js";
import type * as readings from "../readings.js";
import type * as semesters from "../semesters.js";
import type * as texts from "../texts.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  assignments: typeof assignments;
  courses: typeof courses;
  gradingComponents: typeof gradingComponents;
  import: typeof import_;
  oauth: typeof oauth;
  policies: typeof policies;
  readings: typeof readings;
  semesters: typeof semesters;
  texts: typeof texts;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
