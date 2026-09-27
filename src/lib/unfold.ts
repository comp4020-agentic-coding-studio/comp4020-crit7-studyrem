import {
  type Course,
  type CourseRequirement,
  deletePlanEntry,
  getCourseRequirement,
  getPlanSettings,
  listPlanEntries,
  type PlanEntryWithCourse,
  setPlanSettings,
  upsertPlanEntry,
} from "./db";

export type Semester = "S1" | "S2";

/** A monotonic ordering key: Year 1 S1 = 0, Year 1 S2 = 1, Year 2 S1 = 2, ... */
export function slotIndex(year: number, semester: Semester): number {
  return (year - 1) * 2 + (semester === "S2" ? 1 : 0);
}

export function semesterAt(slot: number): { year: number; semester: Semester } {
  return { year: Math.floor(slot / 2) + 1, semester: slot % 2 === 0 ? "S1" : "S2" };
}

/** Parses the "<year>-<semester>" value used by the year/semester <select>s
 * on the plan and add-course forms, e.g. "2-S1". */
export function parseSlotValue(value: string): { year: number; semester: Semester } | null {
  const match = /^(\d+)-(S1|S2)$/.exec(value);
  if (!match) return null;
  return { year: Number(match[1]), semester: match[2] as Semester };
}

export const PLANNING_YEARS = [1, 2, 3, 4];
export const SEMESTERS: Semester[] = ["S1", "S2"];

/** A normal semester's course load — the number of fixed columns a plan row
 * shows before a placement counts as "overflowing" it. */
export const SLOTS_PER_SEMESTER = 4;

function offeredIn(course: Course, semester: Semester): boolean {
  return course.semesters.split(",").includes(semester);
}

/** Entries that actually occupy a column in this (year, semester) row —
 * completed entries stay off the grid entirely and never block a slot. */
function entriesInSlot(
  entries: PlanEntryWithCourse[],
  year: number,
  semester: Semester,
): PlanEntryWithCourse[] {
  return entries.filter(
    (e) => e.year === year && e.semester === semester && e.source !== "completed",
  );
}

/** The lowest not-yet-taken column in this (year, semester) row, ignoring
 * the given course's own current entry (so re-pinning a course to the row
 * it's already in doesn't count itself as the blocker). Unbounded above
 * `SLOTS_PER_SEMESTER - 1`: a 5th course still gets a position, it's just
 * rendered as visible overflow rather than silently rejected. */
function leftmostFreeSlot(
  entries: PlanEntryWithCourse[],
  year: number,
  semester: Semester,
  excludeCourseId?: number,
): number {
  const taken = new Set(
    entriesInSlot(entries, year, semester)
      .filter((e) => e.courseId !== excludeCourseId)
      .map((e) => e.position),
  );
  let position = 0;
  while (taken.has(position)) position++;
  return position;
}

/**
 * Walk backwards from `beforeSlot - 1` down to `floorSlot` looking for the
 * nearest slot the course is both offered in and has room in (fewer than
 * `SLOTS_PER_SEMESTER` courses already). Returns null if there's no such
 * slot — the caller clamps to the floor and records an overflow.
 */
function nearestSlotBefore(
  course: Course,
  entries: PlanEntryWithCourse[],
  beforeSlot: number,
  floorSlot: number,
): number | null {
  for (let slot = beforeSlot - 1; slot >= floorSlot; slot--) {
    const { year, semester } = semesterAt(slot);
    if (
      offeredIn(course, semester) &&
      entriesInSlot(entries, year, semester).length < SLOTS_PER_SEMESTER
    ) {
      return slot;
    }
  }
  return null;
}

/** A course "satisfies" a requirement group if it's completed (any slot) or
 * planned strictly before the slot that needs it. */
function satisfiesBefore(entry: PlanEntryWithCourse | undefined, beforeSlot: number): boolean {
  if (!entry) return false;
  if (entry.source === "completed") return true;
  return slotIndex(entry.year, entry.semester as Semester) < beforeSlot;
}

/**
 * Ensure every AND-branch of `courseId`'s requirement is satisfied by
 * something before `beforeSlot`, auto-placing the first not-already-planned
 * OR-option as far back as it'll fit (recursing on its own requirement), and
 * flagging overflow when a chain has nowhere left to go before the floor.
 */
function ensurePrereqs(courseId: number, beforeSlot: number, floorSlot: number): void {
  const requirement: CourseRequirement = getCourseRequirement(courseId);
  const entries = listPlanEntries();
  const byCourseId = new Map(entries.map((e) => [e.courseId, e]));

  for (const group of requirement.groups) {
    if (group.length === 0) continue;
    const alreadySatisfied = group.some((option) =>
      satisfiesBefore(byCourseId.get(option.id), beforeSlot),
    );
    if (alreadySatisfied) continue;

    // Prefer an option with no existing plan entry at all — one that's
    // already planned elsewhere (necessarily at/after beforeSlot, since we
    // just checked satisfaction) is left in place, not moved or duplicated;
    // it'll surface as an ordering conflict instead.
    const candidate = group.find((option) => !byCourseId.has(option.id)) ?? group[0];
    if (byCourseId.has(candidate.id)) continue;

    const current = listPlanEntries();
    const found = nearestSlotBefore(candidate, current, beforeSlot, floorSlot);
    const chosenSlot = found ?? floorSlot;
    const { year, semester } = semesterAt(chosenSlot);
    const placed = upsertPlanEntry({
      courseId: candidate.id,
      year,
      semester,
      position: leftmostFreeSlot(current, year, semester, candidate.id),
      source: "auto",
      overflow: found === null,
      overflowReason:
        found === null
          ? `${candidate.code} had to be squeezed onto your current position (${semester} Year ${year}) to satisfy ${requirement.course.code} in time — there wasn't a real earlier slot it's offered in with room.`
          : null,
    });
    byCourseId.set(candidate.id, { ...placed, course: candidate });
    ensurePrereqs(candidate.id, chosenSlot, floorSlot);
  }
}

/** Recompute every auto-placed entry from scratch off the current pinned +
 * completed entries. Idempotent, and the mechanism the plan calls "garbage
 * collect any auto entry no longer needed" — simplest correct way to get
 * that is to throw them all away and regenerate. */
export function rebuildAutoEntries(): void {
  const settings = getPlanSettings();
  const floorSlot = slotIndex(settings.year, settings.semester as Semester);

  for (const entry of listPlanEntries()) {
    if (entry.source === "auto") deletePlanEntry(entry.id);
  }

  const roots = listPlanEntries()
    .filter((e) => e.source === "pinned")
    .sort((a, b) => slotIndex(a.year, a.semester as Semester) - slotIndex(b.year, b.semester as Semester));

  for (const root of roots) {
    ensurePrereqs(root.courseId, slotIndex(root.year, root.semester as Semester), floorSlot);
  }
}

export function placeCourse(courseId: number, year: number, semester: Semester): void {
  const entries = listPlanEntries();
  upsertPlanEntry({
    courseId,
    year,
    semester,
    position: leftmostFreeSlot(entries, year, semester, courseId),
    source: "pinned",
  });
  rebuildAutoEntries();
}

export function removeCourse(entryId: number): void {
  deletePlanEntry(entryId);
  rebuildAutoEntries();
}

/** Pin an auto-placed course to a slot of the user's choosing (or re-pin a
 * pinned one elsewhere). Same operation either way: it becomes a root. */
export function moveCourse(courseId: number, year: number, semester: Semester): void {
  placeCourse(courseId, year, semester);
}

export function completeCourse(courseId: number, year: number, semester: Semester): void {
  // Position is meaningless here — completed entries never render in the
  // slot grid — but the column is NOT NULL, so pick something harmless.
  upsertPlanEntry({ courseId, year, semester, position: 0, source: "completed" });
  rebuildAutoEntries();
}

export function setCurrentPosition(year: number, semester: Semester): void {
  setPlanSettings(year, semester);
  rebuildAutoEntries();
}

/** Read-time (not stored) ordering conflicts: a course planned or completed
 * whose requirement group is only satisfied by something scheduled at or
 * after it, rather than strictly before. */
export function orderingConflicts(): { courseCode: string; needs: string; scheduledAt: string }[] {
  const entries = listPlanEntries();
  const byCourseId = new Map(entries.map((e) => [e.courseId, e]));
  const warnings: { courseCode: string; needs: string; scheduledAt: string }[] = [];

  for (const entry of entries) {
    if (entry.source === "completed") continue;
    const slot = slotIndex(entry.year, entry.semester as Semester);
    const requirement = getCourseRequirement(entry.courseId);
    for (const group of requirement.groups) {
      if (group.length === 0) continue;
      const satisfied = group.some((option) => satisfiesBefore(byCourseId.get(option.id), slot));
      if (satisfied) continue;
      const conflicting = group
        .map((option) => byCourseId.get(option.id))
        .find((e) => e !== undefined);
      if (conflicting) {
        warnings.push({
          courseCode: entry.course.code,
          needs: group.map((o) => o.code).join(" or "),
          scheduledAt: `${conflicting.semester} Year ${conflicting.year}`,
        });
      }
    }
  }
  return warnings;
}

export function overflowEntries(): PlanEntryWithCourse[] {
  return listPlanEntries().filter((e) => e.overflow);
}
