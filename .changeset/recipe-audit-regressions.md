---
"tailess": patch
---

Four regressions in `variants()` from this release's own fixes. A recipe whose map
contains itself no longer throws `RangeError` at import — the snapshot keeps the cycle and
`ss` cuts it with one warning. `button(props, props.className)` no longer warns that
`className` was dropped, since it was passed on. An extra `{ base: "mt-2" }` or `{}` is no
longer reported as getting no CSS: it builds no prefixed class. And the one-argument
overload refuses any config-shaped object — `{ extend, base }` compiled and rendered the
base alone, inheriting nothing.
