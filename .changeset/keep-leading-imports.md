---
"tailess": patch
---

A stylesheet that `@import`s a web font before Tailwind — Google Fonts' own snippet,
`@import url("https://fonts.googleapis.com/…"); @import "tailwindcss";` — keeps the font.
Both plugins put their injection at the very top, and its marker rule then stood ahead of
the font's `@import`, which CSS ignores after a rule: the font vanished from dev and
production CSS with only a minifier warning. The injection now goes after the file's
leading `@charset`, `@import`, `@layer` and other block-less statements.
