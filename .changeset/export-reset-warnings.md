---
"tailess": patch
---

`resetWarnings` is exported from `tailess`, as the 0.12.0 changelog said it was. It clears
the once-per-process memo behind the development warnings, for a test that asserts on the
same warning twice; `configure({ onWarn })` still clears it for you.
