---
"tailess": patch
---

Overlapping content roots — `src` and `src/components`, or the project and one of its
folders — read each file once. A file reached twice was counted twice, and every
diagnostic in it was reported twice, in the build output and in `check --json`.
