---
"tailess": patch
---

`tailess check` no longer goes green because of a stylesheet that generates no
utilities.

A class counted as broken only when *every* stylesheet under `--content` failed it, and a
stylesheet that generates nothing fails nothing. So a design-token file
(`@import "tailwindcss/theme"`), a v3 leftover (`@tailwind utilities`) or a reset file
beside the app's entry cleared every broken class in the project — the gate passed while
`md:p-4` had no rule in the real build. A stylesheet now vouches for a class only by
containing its rule, and one that generates no utilities at all has no say. When no
stylesheet generates any — `--css` pointed at a partial, or a `prefix(…)` hiding in an
imported file — the check exits 2 (`"error": "no-utilities"`) instead of passing.
