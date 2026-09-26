---
"tailess": minor
---

A runtime-built class with a double quote in it reaches Tailwind, and one with a `{`, `}`
or `\` — which cannot — is named by a new build check (`uncarried-class`) instead of
vanishing.

`ss({ md: 'after:content-["x"]' })` was dropped from the candidate list, because
`@source inline("…")` cannot carry a `"` and Tailwind reads neither `\"` nor `\22` inside
it. Such classes now go in a single-quoted directive of their own. A `{`, `}` or `\`
genuinely cannot travel — Tailwind reads them as brace expansion or an escape — and a
prefixed class holding one was unstyled with no signal, since the literal in the source
(`after:content-['{']`) is not the class on the element (`md:after:content-['{']`). The
build check now names each one; eleven things are checked.
