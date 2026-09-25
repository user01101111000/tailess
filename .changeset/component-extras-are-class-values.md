---
"tailess": minor
---

A component built by `variants` takes its caller's extra classes as a `ClassArg`, not an
`ss` map — and says so at runtime when a map gets through.

`button({}, { md: "w-auto" })` and `card({}, { root: { md: "p-10" } })` type-checked,
built `md:w-auto` and `md:p-10` at runtime, and put them on the element with no CSS
behind them: the build reads the recipe and `ss(…)` calls, never the calls of the
component a recipe builds. Nothing warned, and `tailess check --strict` passed. Those
calls are now compile errors; `button({}, ss({ md: "w-auto" }))` is the spelling that
works, since that `ss` call is literal and the build reads it where it is written. A
map that arrives through plain JavaScript or a cast warns in development.

`ClassArg` — every `SsArg` except a map — is exported for a wrapper component that
forwards its own `className`. Code this now rejects was already shipping unstyled
classes, which is why it is a type change in a minor rather than a major.
