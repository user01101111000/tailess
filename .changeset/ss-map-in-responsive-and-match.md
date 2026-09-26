---
"tailess": patch
---

The build check for an `ss` map written where a flat class value goes now reads
`responsive()`'s breakpoints and `match()`'s options, and the README no longer claims the
types refuse it.

`responsive("p-2", { md: { hover: "p-4" } })` builds `md:hover` and
`match(size, { sm: { md: "p-4" } })` builds `md`. Neither is a utility, so `tailess
check` skipped both as junk, the runtime said nothing, and the element shipped unstyled.
The README said the types refuse an `ss` map handed to a helper; they cannot — a `clsx`
dictionary is any object — so the build check is what catches it, and now it does there
too. A real dictionary, `{ md: { hidden: !open } }`, stays quiet.
