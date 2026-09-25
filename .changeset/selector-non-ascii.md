---
"tailess": patch
---

`tailess check` — and the exported `hasRule` / `selectorFor` — find a class with
characters outside ASCII the way Tailwind writes it.

Every character past ASCII was escaped, while Tailwind (like `CSS.escape`) writes it as it
is. So `data("state", "geöffnet", …)` or `has("[lang='日本']", …)` failed the gate on
working code, and a broken class with an arrow or a checkmark in its `content` passed,
because its utility "did not resolve" either. Control characters are hex-escaped, as
`CSS.escape` does.
