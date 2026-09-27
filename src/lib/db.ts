import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import {
  type Course,
  courses,
  type PlanEntry,
  planEntries,
  type PlanSettings,
  planSettings,
  prereqGroupOptions,
  prereqGroups,
} from "./schema";

// One SQLite file is the app's whole persistent state. In production
// fly.toml points DATABASE_PATH at the machine's volume (/data), which is
// how state survives a reload and a redeploy; locally it defaults to an
// untracked file in .data/.
const path = process.env.DATABASE_PATH ?? "./.data/app.db";
mkdirSync(dirname(path), { recursive: true });

const client = new Database(path);
client.pragma("journal_mode = WAL");

export const db = drizzle(client);

// Migrations run at boot, on whatever machine holds the volume — the
// recommended shape for SQLite on Fly, where there's no separate machine to
// run them from. The flow: edit src/lib/schema.ts, `pnpm db:generate`,
// commit the migration it writes to drizzle/.
migrate(db, { migrationsFolder: "./drizzle" });

export type { Course };

// A real (not fabricated) slice of the ANU COMP major, sourced from
// programsandcourses.anu.edu.au on 2026-09-27. `prereq` is an AND-of-OR list:
// each inner array is a set of alternative course codes, any one of which
// satisfies that branch. `notes` records the part of the real requirement
// this app doesn't model as a graph edge (unit-count gates, non-COMP
// alternatives) — see README.md for the full scope-cut rationale.
const SEED_COURSES: {
  code: string;
  title: string;
  units: number;
  semesters: string;
  notes: string | null;
  prereq: string[][];
}[] = [
  {
    code: "COMP1100",
    title: "Programming as Problem Solving",
    units: 6,
    semesters: "S1,S2",
    notes: "Incompatible with COMP1130 — an alternative start, not a chain.",
    prereq: [],
  },
  {
    code: "COMP1130",
    title: "Advanced Topics in Programming as Problem Solving",
    units: 6,
    semesters: "S1",
    notes: "Incompatible with COMP1100 — an alternative start, not a chain.",
    prereq: [],
  },
  {
    code: "COMP1110",
    title: "Programming as Problem Solving (Continued)",
    units: 6,
    semesters: "S1,S2",
    notes: "Real prerequisite also accepts COMP1730 (not modelled here).",
    prereq: [["COMP1100", "COMP1130"]],
  },
  {
    code: "COMP1140",
    title: "Advanced Topics in Programming as Problem Solving (Continued)",
    units: 6,
    semesters: "S2",
    notes: "Incompatible with COMP1110.",
    prereq: [["COMP1130"]],
  },
  {
    code: "COMP2100",
    title: "Software Construction",
    units: 6,
    semesters: "S1,S2",
    notes: "Real prerequisite also requires 6 units of 1000-level MATH (not modelled).",
    prereq: [["COMP1110", "COMP1140"]],
  },
  {
    code: "COMP2300",
    title: "Computer Organisation and Program Execution",
    units: 6,
    semesters: "S1",
    notes: "Real prerequisite also requires 6 units of 1000-level MATH (not modelled).",
    prereq: [["COMP1100", "COMP1130"]],
  },
  {
    code: "COMP2120",
    title: "Software Engineering",
    units: 6,
    semesters: "S2",
    notes: "Incompatible with COMP2130, COMP6120, COMP6311.",
    prereq: [["COMP2100"]],
  },
  {
    code: "COMP3310",
    title: "Computer Networks",
    units: 6,
    semesters: "S1",
    notes: "Real prerequisite also requires 6 units of COMP2000-level (not modelled).",
    prereq: [["COMP2100", "COMP2300"]],
  },
  {
    code: "COMP3600",
    title: "Algorithms",
    units: 6,
    semesters: "S2",
    notes:
      "Real prerequisite is 24 units of COMP-coded courses plus (6 units of MATH or COMP1600) — a unit-count gate, deliberately not modelled as a graph edge.",
    prereq: [],
  },
];

function seedIfEmpty(): void {
  const existing = db.select({ id: courses.id }).from(courses).limit(1).all();
  if (existing.length > 0) return;

  const idByCode = new Map<string, number>();
  for (const c of SEED_COURSES) {
    const row = db
      .insert(courses)
      .values({
        code: c.code,
        title: c.title,
        units: c.units,
        semesters: c.semesters,
        notes: c.notes,
      })
      .returning({ id: courses.id })
      .get();
    idByCode.set(c.code, row.id);
  }

  for (const c of SEED_COURSES) {
    const courseId = idByCode.get(c.code);
    if (courseId === undefined) continue;
    for (const group of c.prereq) {
      const groupRow = db
        .insert(prereqGroups)
        .values({ courseId })
        .returning({ id: prereqGroups.id })
        .get();
      for (const optionCode of group) {
        const optionCourseId = idByCode.get(optionCode);
        if (optionCourseId === undefined) continue;
        db.insert(prereqGroupOptions)
          .values({ groupId: groupRow.id, optionCourseId })
          .run();
      }
    }
  }

  db.insert(planSettings).values({ id: 1, year: 1, semester: "S1" }).run();
}

seedIfEmpty();

export function listCourses(): Course[] {
  return db.select().from(courses).orderBy(courses.code).all();
}

export function getCourseByCode(code: string): Course | undefined {
  return db.select().from(courses).where(eq(courses.code, code)).get();
}

export function getCourseById(id: number): Course | undefined {
  return db.select().from(courses).where(eq(courses.id, id)).get();
}

/** A course's requirement as AND-of-OR groups of resolved course rows. */
export type CourseRequirement = { course: Course; groups: Course[][] };

export function getCourseRequirement(courseId: number): CourseRequirement {
  const course = getCourseById(courseId);
  if (!course) throw new Error(`no course with id ${courseId}`);
  const groupRows = db
    .select()
    .from(prereqGroups)
    .where(eq(prereqGroups.courseId, courseId))
    .all();
  const groups = groupRows.map((group) => {
    const optionRows = db
      .select()
      .from(prereqGroupOptions)
      .innerJoin(courses, eq(prereqGroupOptions.optionCourseId, courses.id))
      .where(eq(prereqGroupOptions.groupId, group.id))
      .all();
    return optionRows.map((row) => row.courses);
  });
  return { course, groups };
}

export function listCourseRequirements(): CourseRequirement[] {
  return listCourses().map((course) => getCourseRequirement(course.id));
}

export type { PlanEntry };

/** A plan entry with its course resolved, ordered by semester slot then code. */
export type PlanEntryWithCourse = PlanEntry & { course: Course };

export function listPlanEntries(): PlanEntryWithCourse[] {
  const rows = db
    .select()
    .from(planEntries)
    .innerJoin(courses, eq(planEntries.courseId, courses.id))
    .all();
  return rows
    .map((row) => ({ ...row.plan_entries, course: row.courses }))
    .sort((a, b) => {
      const slot = (e: PlanEntryWithCourse) => (e.year - 1) * 2 + (e.semester === "S2" ? 1 : 0);
      return slot(a) - slot(b) || a.course.code.localeCompare(b.course.code);
    });
}

export function getPlanEntryByCourseId(courseId: number): PlanEntryWithCourse | undefined {
  return listPlanEntries().find((e) => e.courseId === courseId);
}

export function getPlanEntryById(id: number): PlanEntryWithCourse | undefined {
  return listPlanEntries().find((e) => e.id === id);
}

export function upsertPlanEntry(input: {
  courseId: number;
  year: number;
  semester: "S1" | "S2";
  source: "pinned" | "auto" | "completed";
  overflow?: boolean;
  overflowReason?: string | null;
}): PlanEntry {
  const existing = db
    .select()
    .from(planEntries)
    .where(eq(planEntries.courseId, input.courseId))
    .get();
  const values = {
    courseId: input.courseId,
    year: input.year,
    semester: input.semester,
    source: input.source,
    overflow: input.overflow ?? false,
    overflowReason: input.overflowReason ?? null,
  };
  if (existing) {
    return db
      .update(planEntries)
      .set(values)
      .where(eq(planEntries.id, existing.id))
      .returning()
      .get();
  }
  return db.insert(planEntries).values(values).returning().get();
}

export function deletePlanEntry(id: number): void {
  db.delete(planEntries).where(eq(planEntries.id, id)).run();
}

export function getPlanSettings(): PlanSettings {
  const row = db.select().from(planSettings).where(eq(planSettings.id, 1)).get();
  if (!row) throw new Error("plan settings row missing — seed did not run");
  return row;
}

export function setPlanSettings(year: number, semester: "S1" | "S2"): PlanSettings {
  return db
    .update(planSettings)
    .set({ year, semester })
    .where(eq(planSettings.id, 1))
    .returning()
    .get();
}
