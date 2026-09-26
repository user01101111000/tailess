---
"tailess": patch
---

`ss` cuts a map that contains itself where the cycle closes, and says so once. The depth
bound only slowed a cycle down: a map reaching itself from two keys walked 2¹⁰ paths, from
four keys 4¹⁰ — around nine seconds for one call, in production too — and warned once per
path on every call. A map shared by two keys, which is not a cycle, is emitted under both.
