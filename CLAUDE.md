# Your harness

This file is yours, and it arrives empty on purpose. The rules you hold the
agent to are part of what gets marked, so they should be rules you decided on.

Nothing about the starter is recorded here. What the repo ships is explained
where it lives --- `fly.toml`, the `Dockerfile`, the CI workflow and
`spec/README.md` each say what they fix --- and the
[course website](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/)
publishes this deliverable's brief and spec. Read them before you plan or build;
what the agent needs to carry from any of it is your call.

## My working rules

1. Check the course plugin for updates (`claude plugin update comp4020@comp4020`
   and `comp4020-statusline@comp4020`) before running **start** for a new
   deliverable; restart if it reports an update.
2. Commit locally as you go, but never `git push` / open a PR / touch the
   remote without being asked again in that same turn --- approval doesn't
   carry forward.
3. When the user names the deliverable, summarize that week's spec back to
   them after init work finishes --- what's mechanically checkable vs. judged,
   and the cutoff --- before building starts.
4. Big changes (new feature, restructure, multi-file or content/information-model
   changes) get a written plan and sign-off first; small/mechanical edits don't
   need this.
5. Audits go to a clean subagent, not the main thread: when asked for an audit,
   spin up a fresh subagent with no prior context and have it review from a
   client's/audience's position, not an author's.
