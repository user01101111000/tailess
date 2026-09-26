---
"tailess": patch
---

The build follows helpers composed up to six deep, not two.

`ss({ dark: on("hover", data("state", "open", aria("selected", "bg-blue-50"))) })` and
`on("focus", on("hover", until("md", withPrefix("[&>li]", "p-2"))))` lost the one class
the runtime builds — the innermost stack — because following nested calls stopped at the
third helper; the scanner emitted prefixes glued to the inner helper's arguments instead,
and `tailess check` passed. The bound still keeps a chain linear: a 5,000-call file scans
in the same time as before.
