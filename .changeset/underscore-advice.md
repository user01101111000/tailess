---
"tailess": patch
---

The literal-underscore warning no longer advises a spelling that fails. It said to use
`withPrefix` for a real `\_`, and the class that builds — `withPrefix("has-[.my\_class]", …)`
— carries a backslash, which the scanner cannot hand to Tailwind, so it was unstyled with
`check --strict` green. The warning now points at a class written out in `String.raw`, which
Tailwind's own scan reads and compiles; and the build check names a prefixed class whose
backslash or brace is in the prefix — `withPrefix`, `data()` — not only in the class.
