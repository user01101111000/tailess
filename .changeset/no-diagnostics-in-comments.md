---
"tailess": patch
---

The build-time checks no longer report a call that does not run: one in a `//` or block
comment (a JSDoc "do not write `ss({ md: size })`"), in an HTML comment in a `.vue`,
`.svelte`, `.astro` or `.html` file, or in a Markdown code fence or code span. Each of
these failed `tailess check --strict` and `diagnostics: "error"` builds on working code.
Class enumeration still reads them, since an extra candidate costs nothing.
