---
"tailess": patch
---

A cold scan no longer pays twice for files that never mention tailess. The build checks
masked every scanned file two or three times before learning it did not import the
package; they now skip such a file outright. On a 1,003-file project (308 using tailess)
the checks take 29 ms instead of 99 ms in 0.12.1.
