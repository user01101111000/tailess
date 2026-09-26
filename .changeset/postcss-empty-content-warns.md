---
"tailess": patch
---

The PostCSS plugin warns when `content` matches no files, as the Vite plugin always has
and as the README says both do — including the note that a glob is not expanded.

A v3-style `content: ["src/**/*.tsx"]` under Next.js or the PostCSS CLI scanned nothing,
and every prefixed class went unstyled with no warning, while the stylesheet still carried
the marker that keeps the runtime's own "plugin not wired" check quiet. The warning now
lives in one place both plugins call.
