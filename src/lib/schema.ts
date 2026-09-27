import { int, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

// The schema is the ground truth for the database. To change it: edit here,
// run `pnpm db:generate` to turn the diff into a migration under drizzle/,
// and commit both — the migration applies automatically when the server
// boots (see src/lib/db.ts), locally and deployed. Never edit the database
// by hand: state on the deployed volume outlives every deploy, and the
// migration trail is what keeps old state and new code compatible.

// The read-only catalog, seeded once at boot (see seedIfEmpty in db.ts) from
// a real slice of ANU COMP courses. Source and date are recorded in README.md.
export const courses = sqliteTable("courses", {
  id: int().primaryKey({ autoIncrement: true }),
  code: text().notNull().unique(),
  title: text().notNull(),
  units: int().notNull().default(6),
  // comma-separated subset of "S1,S2" — the semesters this course is offered in
  semesters: text().notNull(),
  // the part of the real requirement this app doesn't model as a graph edge
  // (unit-count gates, non-COMP alternatives) — shown as free text alongside
  // the modelled prerequisite groups
  notes: text(),
});
export type Course = typeof courses.$inferSelect;

// One row per AND-branch of a course's prerequisite. A course with no rows
// here has no modelled prerequisite.
export const prereqGroups = sqliteTable("prereq_groups", {
  id: int().primaryKey({ autoIncrement: true }),
  courseId: int()
    .notNull()
    .references(() => courses.id),
});
export type PrereqGroup = typeof prereqGroups.$inferSelect;

// Rows sharing a groupId are OR'd: satisfying any one option satisfies that
// AND-branch.
export const prereqGroupOptions = sqliteTable("prereq_group_options", {
  id: int().primaryKey({ autoIncrement: true }),
  groupId: int()
    .notNull()
    .references(() => prereqGroups.id),
  optionCourseId: int()
    .notNull()
    .references(() => courses.id),
});
export type PrereqGroupOption = typeof prereqGroupOptions.$inferSelect;

// The user's plan: at most one entry per course. "source" distinguishes a
// course the user explicitly placed ("pinned") from one auto-unfold dropped
// in to satisfy a prerequisite ("auto", movable/pinnable by the user) from
// one the user says they've already done ("completed", off the grid but
// still satisfies prereq checks regardless of slot).
export const planEntries = sqliteTable(
  "plan_entries",
  {
    id: int().primaryKey({ autoIncrement: true }),
    courseId: int()
      .notNull()
      .references(() => courses.id),
    year: int().notNull(),
    semester: text({ enum: ["S1", "S2"] }).notNull(),
    source: text({ enum: ["pinned", "auto", "completed"] }).notNull(),
    // set when auto-unfold had to clamp this entry to the current-position
    // floor instead of a real nearest-possible slot
    overflow: int({ mode: "boolean" }).notNull().default(false),
    overflowReason: text(),
  },
  (table) => [unique().on(table.courseId)],
);
export type PlanEntry = typeof planEntries.$inferSelect;

// Single-row settings table: the user's "current position", the floor
// auto-unfold won't schedule earlier than. Stands in for a real transcript.
export const planSettings = sqliteTable("plan_settings", {
  id: int().primaryKey(),
  year: int().notNull(),
  semester: text({ enum: ["S1", "S2"] }).notNull(),
});
export type PlanSettings = typeof planSettings.$inferSelect;
