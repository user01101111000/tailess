---
"tailess": patch
---

The README's Requirements table states the Node floor `engines` enforces — 20.19 — rather
than the Node 18 it promised before 0.12.0 raised it. On Node 18, yarn 1 and
`npm --engine-strict` refuse the install outright.
