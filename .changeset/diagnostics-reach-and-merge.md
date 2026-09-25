---
"tailess": patch
---

The build-time checks reach more of the files they should, and stay quiet where they
cannot be right:

- A renamed helper is reported in a re-export (`export { ss as tw } from "tailess"` — the
  worst place for it, since every importing file loses its classes), a CommonJS
  destructuring (`const { ss: tw } = require("tailess")`), and an import that does not
  start its line (`"use client"; import …`, minified code). A type-only rename, which
  binds nothing callable, is no longer reported.
- Files that bind the package with `const t = require("tailess")` or `await import()` get
  the source checks; they were silently off.
- Two conflicting utilities in one string are not reported in a project that calls
  `configure({ merge })`: the check can only run the default merge, and it failed
  `check --strict` on the README's own `extendTailwindMerge` recipe.
- The README says the checks need a direct import from `"tailess"`, not a local barrel.
