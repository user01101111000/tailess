---
"tailess": patch
---

The PostCSS plugin reports `@import "tailwindcss" prefix(tw)` written in the entry
stylesheet itself, and fails the build over it under `diagnostics: "error"`.

It rebuilt each `@import` as its bare specifier before the theme check read it, so the
prefix on the entry's own import was dropped — only a prefix one file deeper was reported.
Every Next.js or PostCSS project with a Tailwind prefix got a fully unstyled app and none
of the promised build output, and a CI gate on `diagnostics: "error"` stayed green. The
Vite plugin, which hands the whole stylesheet to the check, already reported it.
