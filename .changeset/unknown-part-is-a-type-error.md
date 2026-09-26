---
"tailess": patch
---

A slotted option that names a part the recipe does not have is a type error even when it
also names one that exists: `{ root: "p-2", titel: "text-xl" }` compiled, and `text-xl`
reached no part. Parts inherited through `extend` still count.
