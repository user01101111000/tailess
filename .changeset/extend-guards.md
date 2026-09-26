---
"tailess": patch
---

`extend` says so when it cannot inherit. Given a plain config object — a shared
`{ base, variants }` — it inherited nothing while the prop types said its variants were
there; that is now a type error, and a dev warning when a cast gets it through. A slotted
recipe extending a flat one (only reachable through a cast) spread the parent's `ss`-map
options by slot name and kept its groups as props; it now warns and inherits none of it,
the same as the opposite direction already did.
