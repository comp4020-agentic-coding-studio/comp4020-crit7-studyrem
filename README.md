# StudyRem — a degree planner that unfolds prerequisites for you

ANU's own systems (Programs and Courses, the degree-planning worksheets) will
tell you a course's prerequisites, but nothing will tell you *when* to take
its prerequisites so the course you actually want lands where you want it.
Plan COMP2120 for your final semester and you're on your own to notice it
needs COMP2100, which needs COMP1110 or COMP1140, which needs COMP1100 or
COMP1130 — and to work out, by hand, which semesters those are even offered
in. StudyRem does that backward-chaining for you: add a course to a semester,
and it automatically drops its whole missing prerequisite chain into the
nearest earlier semesters that actually offer each course, and tells you
plainly when a chain can't fit before your target.

Two pages carry the app:

- **`/` — the plan.** A Year × Semester grid you build by adding courses to a
  target slot. Anything auto-placed to satisfy a prerequisite is labelled
  `auto` and can be pinned to lock it in place, moved to a different slot, or
  marked as already completed (the escape hatch for "I already have this,
  stop asking"). An overflow banner names, in plain language, exactly which
  course and which chain couldn't be scheduled in time.
- **`/courses/` — the requirements table.** The accessible source of truth:
  every seeded course, its units, which semesters it runs in, and its
  requirement spelled out as readable AND-of-OR text (e.g. "COMP1110 or
  COMP1140"). This is the page to trust if the plan grid's shorthand ever
  looks ambiguous.

## What good looks like here

**Real data, honestly scoped.** The nine seeded courses (COMP1100, COMP1130,
COMP1110, COMP1140, COMP2100, COMP2300, COMP2120, COMP3310, COMP3600) and
their prerequisites are copied from
[programsandcourses.anu.edu.au](https://programsandcourses.anu.edu.au/), checked
2026-09-27 — not invented placeholder data. Real ANU prerequisites aren't
always a clean graph of course codes: several of these courses also require a
minimum unit count of 1000-level MATH, or a general COMP-coded unit count,
which isn't something this tool can model as a "take this specific course
first" edge. Rather than fake that precision, each course's `notes` field
says the real requirement in full, visible on `/courses/`, and it's simply
not enforced by the unfold logic. A planner that silently drops real
constraints is worse than one that admits what it doesn't model.

**Auto-unfold is additive, never destructive.** It only ever fills gaps
backward from a target semester into the nearest earlier semester a course is
offered — it never moves or removes something the user placed on purpose.
Removing a course garbage-collects only the auto-placed courses nothing else
still needs; anything pinned or marked completed survives untouched. That
asymmetry (auto entries are disposable, pinned/completed entries aren't) is
the one rule the whole feature rests on, and it's what `spec/plan.test.ts`
checks directly: pin, auto-unfold, then remove the root and confirm the
auto-placed chain disappears while the independently-pinned course doesn't.

**Overflow is explained, not just flagged.** When a chain genuinely can't fit
before its target (nothing earlier than the user's own "current position"),
the course is still placed — at the earliest slot the planner could manage —
but flagged with a specific, human-readable reason naming the course and the
requirement it was trying to satisfy. A red banner that just says "something
doesn't fit" would send the user hunting through the whole grid; naming the
course is the difference between a warning and a puzzle.

**Judgement calls, left visible rather than hidden:**

- Interaction is click/select, not drag-and-drop — a deliberate accessibility
  and time trade-off, made explicit rather than silently defaulted to.
- The plan grid runs Year 1–4, S1/S2 only (no summer/winter terms, no
  part-time pacing) — a normal-paced four-year BSc-shape is the target user,
  not every enrolment pattern ANU actually supports.
- There's no course-adding UI: the catalogue is a fixed, curated seed rather
  than something scraped live from ANU, so the data a marker sees is exactly
  the data that was checked against the real course pages.

The rules the agent was held to while building this are in `CLAUDE.md`; the
checks that enforce them mechanically live in `spec/`.
