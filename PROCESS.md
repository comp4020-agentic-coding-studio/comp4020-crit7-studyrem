# Process overview

## What I built

A degree planner that auto-unfolds prerequisite chains: add a course to a
semester and it backward-fills its missing prerequisites into the nearest
earlier semesters that actually offer them, recursively.

## The moment that mattered

**Found a bug by coincidence, then asked whether that was luck.** While
working on auto-unfold I stumbled onto a case where it could duplicate an
incompatible prerequisite alternative instead of recognizing the two as the
same requirement — something no test had caught. Fixed in
[`621ca5e`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-studyrem/commit/621ca5ea079c48bad22cd04781ae3d7de0741a56),
but that raised a real question: was this a bug that testing could ever have
found, or just one I happened to notice?

> if you get some subagent just randomly explore the website, will they
> find this bug?

I ran three fresh agents — no knowledge of the bug between them — against
three isolated copies of the pre-fix app, told only to explore like curious
users. The answer was yes: one of the three found it, via a specific
multi-step sequence (pin a course, force an ordering conflict, re-trigger
unfold) that a simple script wouldn't think to try. Between them the three
agents also surfaced a second, previously-unknown bug — a crash from marking
a nonexistent course complete — that neither the existing test suite nor a
careful read of the code had caught. That's the actual finding: random
exploration by independent agents is a real technique for catching bugs in
cross-module interaction, not a novelty act, because it tries the
weird/unexpected sequences a hand-written test plan doesn't think to cover.
Fixed in
[`4f245ea`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-studyrem/commit/4f245ea12f3136f9ca316fe8959de142416a2b95);
the full write-up (method, per-agent results) is on `experiment/pre-fix-bugs`
([`612c112`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-studyrem/commit/612c1127cd65c02cccd14738337332d3cd9be7c2)).
