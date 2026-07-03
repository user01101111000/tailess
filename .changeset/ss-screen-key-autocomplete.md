---
"tailess": patch
---

Fix missing autocomplete for breakpoint/state keys on the default helpers.

The top-level `ss`, `responsive`, `on`, `until`, and `between` are bound to the
zero-config instance, whose config type is the wide `Record<string, string>`.
`keyof` on that is `string`, so `"sm" | "md" | ... | string` collapsed to plain
`string` and every literal key suggestion was lost — you got no autocomplete and
unknown keys were silently accepted.

Key resolution now filters out the `string`/`number` index signature via a
`LiteralKeys` helper, so the default breakpoints (`sm`/`md`/`lg`/`xl`/`2xl`) and
states always autocomplete, and any custom keys from a `createTailess(config)`
instance are added on top. Unknown keys are now a compile-time error, matching
the existing dev-time runtime warning.
