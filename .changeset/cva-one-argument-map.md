---
"tailess": patch
---

The build reads cva's one-argument call with an `ss` map — `variants({ base: "flex",
md: "p-4" })`, no `variants` key — as the base it is. The runtime already did; the scanner
took the object for a config, read only its `base` key, and every breakpoint in it had no
CSS.
