---
"tailess": patch
---

The build reads both branches of a ternary in `data()` values and in `on()` state
stacks, whatever the branches are.

- `data("level", open ? 1 : 2, …)`, `data("active", on ? true : false, …)` and
  `data("state", open ? "open" : null, …)` each left one branch — or both — with no CSS:
  only string literals were read, and a number or boolean only when it was the whole
  argument.
- `on(["dark", cond ? "hover" : "focus"], …)` enumerated `dark:hover:focus:`, a stack
  the runtime never builds, instead of `dark:hover:` and `dark:focus:`; and
  `on(cond ? ["dark", "hover"] : "focus", …)` enumerated three single states instead of
  one stack and one state.
