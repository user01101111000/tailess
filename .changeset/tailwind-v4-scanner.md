---
"tailess": minor
---

Add `tailess/postcss` — a PostCSS plugin that makes tailess work with Tailwind v4.

Tailwind v4 only generates CSS for class names that appear literally in source,
but tailess builds variant prefixes (`md:`, `hover:`, …) at runtime — so the full
class names were never seen and no CSS was emitted.

The plugin scans your source, enumerates the classes tailess produces, and injects
them into Tailwind via `@source inline(...)`. Setup is a single line in
`postcss.config` — no CSS `@source`, no generated file, no scan step — and it
registers source directories as watch dependencies for live dev updates.
TypeScript configs load via `jiti` when installed (optional peer dependency).

See the "Tailwind v4 setup" section in the README.
