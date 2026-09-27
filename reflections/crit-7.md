# Crit 7 reflection

**Breakthrough.** The real turning point wasn't the recursive auto-unfold
algorithm itself — it was pulling real ANU prerequisite data before writing
any schema. Once I had COMP2120's actual chain (COMP2100 → COMP1110/1140 →
COMP1100/1130) in front of me, and saw that several of these courses also
gate on unit counts rather than specific course codes, the data model became
obvious: AND-of-OR groups for what's really an edge, and a plain `notes`
field for what isn't. If I'd started from invented placeholder courses, I'd
have modelled a graph that looked complete and wasn't. Working from the real
handbook forced the honest scope cut instead of hiding it.

**What this changed.** I used to treat "what didn't you build" as an
afterthought to mention if a marker asked. This crit made it load-bearing: the
`notes` field, the README's explicit list of unmodelled gates, and the
overflow banner's specific wording are all the same instinct — say precisely
what the system does and doesn't know, rather than let silence imply more
confidence than the model actually has. The other habit I want to keep is
verifying a recursive, stateful feature three ways before calling it done:
automated black-box tests against the built server, a manual end-to-end pass
reading the actual output, and only then trusting the green check. The one
failing test I did hit was a test-assertion bug, not an app bug — and I only
knew that because I'd read the raw output first instead of assuming the code
was wrong.
