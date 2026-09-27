# Bug-discoverability experiment

**Date:** 2026-09-27
**Base commit:** `edfd65c` (timeline layout landed, but *before* the fix
commit `621ca5e` — so both known bugs below are still present here).

## Why

After manually finding and fixing two bugs in the live app —

1. auto-unfold could plant a second, mutually-incompatible OR-alternative
   (e.g. both COMP1100 *and* COMP1130) alongside an already-planned one that
   merely failed the "strictly before" timing check, instead of just
   flagging it as an ordering conflict;
2. `move`/`add` never checked a course's offered semesters, so a course
   could be pinned into a semester it doesn't actually run in —

the question came up: was bug #1 a genuine edge case that testing can
reasonably miss, or just insufficient care during implementation? This
worktree/branch is the experiment built to get an empirical answer, instead
of just guessing.

## Method

- Three isolated copies of this exact commit, each on its own port and own
  fresh SQLite DB (so the three runs couldn't interfere with each other).
- Three **fresh** agents, no shared context, no knowledge that any bug was
  known to exist. Identical brief: explore the running app like a curious
  user via curl (GET pages, POST forms), try 6-10 varied actions in
  whatever order curiosity suggests, report anything that looks wrong.

## Results

| Bug | Found by | How |
|---|---|---|
| Bug 2 — offered-semester bypass | 2 of 3 agents | Both hit it within their first few actions — "add/move a course into a semester it isn't offered in" is close to the first thing anyone would try. |
| Bug 1 — duplicate incompatible alternative | 1 of 3 agents | Needed a specific multi-step setup: pin a course, move its dependent into a slot that creates a same-semester ordering conflict, *then* re-add the original course to re-trigger auto-unfold's candidate selection. The other two agents ran plenty of add/move/complete churn and never hit it. |
| New (previously unknown) — `POST /api/plan/complete` crashed with an unhandled `SqliteError` 500 on a nonexistent `courseId` | 1 of 3 agents | `add`/`move` were already accidentally safe (a side effect of the `getCourseById` guard added for the bug-2 fix); `completeCourse` had no such guard. Fixed same day in the main branch by adding the same guard. |

Lower-confidence nits also surfaced, not acted on: the banner-overflow CSS
class is reused for two different severities (real slot-capacity overflow
vs. a "squeezed to fit" chain warning); Remove uses `entryId` where
Move/Complete use `courseId` (likely intentional, since Remove needs to
disambiguate).

## Takeaway

A reasonably clean split:

- **Bug 2 was insufficient care**, not bad luck. It was foreseeable
  straight from the app's own stated value proposition (schedule into
  semesters that actually offer the course), and two independent random
  explorers found it almost immediately.
- **Bug 1 is closer to a genuine edge case.** It required a deliberate
  multi-step interaction that casual exploration mostly didn't produce, and
  the existing test suite's only coverage of that code path was the single
  happy-path scenario. It surfaced through hand-tracing the algorithm
  against known-incompatible OR-alternatives, not through clicking around.
- Independent random exploration by multiple agents is a distinct, cheap,
  useful technique from either "run the test suite" or "read the code
  carefully" — it found a bug (the 500 crash) that neither of those two had
  surfaced, precisely because it tries malformed/unexpected inputs a
  feature-focused review doesn't prioritize.
