---
"tailess": patch
---

A source directory named `build`, `out`, `coverage` or `dist` is scanned.

Those names were skipped at any depth, so a Next.js route at `app/build/page.tsx` or a
feature folder at `src/coverage/` lost every runtime-built class while Tailwind still
styled the literals on the same page — and `tailess check`, reading the same walk, passed.
They are now skipped only where a build writes them: at the top of a scanned directory,
or beside a `package.json`. A name listed in `ignore` is still skipped wherever it is.
