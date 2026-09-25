---
"tailess": patch
---

Both plugins warn when an `extensions` list matches no files, not only a `content` one.
`extensions: ["*.tsx"]` — a glob where a name belongs — left `content` at its default and
every prefixed class unstyled, with the marker present and nothing printed.
