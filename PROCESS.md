# Process overview

## What I built

A degree planner that auto-unfolds prerequisite chains: add a course to a
semester and it backward-fills its missing prerequisites into the nearest
earlier semesters that actually offer them, recursively, flagging overflow by
name when a chain can't fit. `README.md` covers what the app is and what good
means here; this is how the build actually went.

## How I got here

**Scoping before building.** The starter ships a generic guestbook (a
`messages` table plus SSE); none of it is ANU-specific. Before writing any
code, I picked a real personal annoyance — nothing in ANU's own tooling tells
you *when* to schedule a prerequisite chain, only *what* it needs — and spent
time on programsandcourses.anu.edu.au pulling a real nine-course slice
(COMP1100 through COMP3600) with their actual prerequisites, rather than
inventing plausible-looking placeholder data. That real data surfaced a
design question immediately: several of these courses gate on unit counts
("24 units of COMP-coded courses") or non-COMP courses (1000-level MATH), not
on specific course codes, and a graph edge can't represent that honestly. I
chose to record those as a visible `notes` field rather than silently drop
them or fake a graph edge that isn't true — a scope cut stated in `README.md`
rather than hidden.

**A written plan before the multi-file change.** Because this touches the
schema, the whole page set, a new recursive algorithm, and the test suite —
squarely the "big change" bar in `CLAUDE.md` rule 4 — I wrote a full plan
(data model, the exact auto-unfold algorithm, page/API structure, and an
eight-step build order) and got it approved before writing code. One design
decision came up explicitly during that planning: drag-and-drop for moving
courses around the grid vs. click/select controls. I chose click/select — a
deliberate accessibility and time trade-off, not a default — and that's the
interaction the shipped app uses throughout.

**Building in dependency order.**
[`8c46372`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-studyrem/commit/8c46372ee3d9e1b174a9f28964d07fffc26707a4)
replaces the guestbook schema with the real shape this problem needs —
`courses`, `prereqGroups` + `prereqGroupOptions` for AND-of-OR requirements,
`planEntries`, `planSettings` — seeded from the real ANU data, with a fresh
Drizzle migration.
[`9177de3`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-studyrem/commit/9177de3d736288230138d88073e8c54cc81fcffc)
is the rest: `/courses/` (the read-only requirements table), `/` (the plan
grid with add/remove/pin/move/mark-completed), the recursive unfold algorithm
in `src/lib/unfold.ts`, the five `POST /api/plan/*` routes, retiring the
guestbook's write endpoint and test, and repointing the SSE bus from a
guestbook `"message"` event to a generic `planChanged` one so the deploy
pipeline's live-stream smoke check stays meaningful instead of vestigial.

**Two environment problems that weren't the plan's fault.** Regenerating the
Drizzle migration for the new schema first triggered a `pnpm` dependency
check that tried to rebuild `better-sqlite3` from source, which failed
(WSL2 has neither `make` nor passwordless `sudo`) and — more damaging —
deleted `node_modules/.bin`, breaking every local CLI tool. I confirmed the
already-built native binary loaded fine on its own, then reinstalled with
`--ignore-scripts` to relink `.bin` without re-triggering the failing
rebuild. Separately, `drizzle-kit generate` wanted an interactive yes/no on
whether the old `messages` table was being renamed into the five new tables,
which a non-TTY session can't answer. Since the app had never been deployed —
no production data depends on the old migration history — I judged it safe to
discard `drizzle/` and regenerate a clean `0000_*` migration rather than
force an answer through a prompt that can't be answered non-interactively.

**Verifying the unfold logic, three ways.** `spec/plan.test.ts` drives the
built server over real HTTP (per the starter's black-box pattern): pin
COMP1100, add COMP2120 four semesters out and confirm COMP2100 and COMP1110
appear auto-placed to satisfy it, then remove COMP2120 and confirm the
auto-placed chain is garbage-collected while the independently-pinned
COMP1100 survives. One assertion in that test was initially wrong, not the
app: a bare "page doesn't contain this code" check couldn't tell "removed
from the plan" apart from "back in the add-a-course picker", since removed
courses reappear there by design. I confirmed the removal itself was correct
by inspecting the raw HTML from the failing run, then fixed the assertion to
check for the specific badge markup a planned entry renders, not just the
course code's presence anywhere on the page. Beyond the automated suite, I
also drove a manually-booted server with `curl` to read the overflow
banner's actual wording end to end, and ran the full `pnpm check`
(typecheck + build + test) to confirm nothing else regressed —
39 tests green, zero typecheck errors.

## Before you ship

`pnpm check:evidence` confirms this file's citations resolve and that
`reflections/crit-7.md` exists.
