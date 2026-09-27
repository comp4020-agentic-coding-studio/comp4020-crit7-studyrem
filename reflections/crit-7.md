# Crit 7 reflection

## What was the breakthrough that moved the work forward?

While building auto-unfold I hit a bug where two mutually-incompatible
prerequisite alternatives (e.g. COMP1100 vs COMP1130) could both end up
planned at once, instead of the algorithm recognizing them as satisfying the
same requirement. Each piece involved — checking one requirement group,
placing one course — was correct on its own; the bug only showed up in how
those correct pieces composed across a recursive chain. That was the
breakthrough: correctness doesn't add up. A system built from parts that are
each individually right can still behave wrong once they interact, and no
amount of staring at one function in isolation would have shown me that.

## What did this work change about who I want to be as a software developer?

I'd found the bug by clicking around, which meant I couldn't actually explain
*how* I'd triggered it — only that I had. Agents don't have that gap: every
exploration run leaves a log, so a bug one stumbles into is traceable back
through every step that caused it, instead of relying on my own memory to
reconstruct it. That's the developer I want to be: someone who treats
"found it, not sure how" as unfinished, and reaches for logged, repeatable
exploration to close that gap rather than trusting luck to strike twice.
