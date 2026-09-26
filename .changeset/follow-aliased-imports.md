---
"tailess": patch
---

Both plugins and `tailess check` find the stylesheet Tailwind compiles when it is reached
through a workspace package — the shadcn/ui monorepo template's
`@import "@workspace/ui/globals.css"` — and the Vite plugin through an alias as well
(`@import "@/styles/tailwind.css"`). They followed only relative `@import`s, three hops
deep, so such an app's stylesheet got no injection: every runtime-built class unstyled,
and the dev warning told the reader to add a plugin that was already there. Relative
chains are now followed eight hops deep.
