---
"tailess": patch
---

Two `tailess/postcss` instances with different `content`, `extensions` or `ignore` in one
working directory — a monorepo root running two apps' pipelines, a multi-compiler build —
no longer share one generated stylesheet. Each got the other's candidate list, concurrently
and again on a rebuild, with the marker present and nothing printed. Each configuration now
writes its own file, and a refresh checks the file still holds its list rather than
trusting that it wrote it last.
