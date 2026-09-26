---
"tailess": patch
---

The "Your Tailwind CSS doesn't include tailess' generated classes" check no longer fires
in component tests. jsdom and happy-dom — under Vitest or Jest — load no stylesheet, so the
marker could never be there, and every test file of a correctly wired project printed the
whole message. A document with no stylesheet at all is now skipped; a page whose CSS lacks
the marker still warns.
