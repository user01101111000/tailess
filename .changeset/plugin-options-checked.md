---
"tailess": patch
---

Both plugins check their options when created, since they often come from an untyped
`postcss.config.mjs`, `.postcssrc.json` or `vite.config.js`. `diagnostics: "ERROR"` (or
`true`) used to behave as `"warn"` — a CI gate that never failed — and now throws, naming
the option. So do an empty `cacheDir`, which put the generated stylesheet in the project
root, and a list option that is not a list of strings. A single string where a list belongs
is read as a list of one: `content: "src"` used to crash the build with "options.roots.map
is not a function", and `ignore: "src"` skipped the directories `s`, `r` and `c`.
