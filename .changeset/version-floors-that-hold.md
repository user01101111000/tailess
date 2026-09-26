---
"tailess": minor
---

The dependency ranges now admit only versions tailess works with: `tailwindcss` 4.1 or
later, and `tailwind-merge` 3.7 or later.

- **`peerDependencies.tailwindcss` is `^4.1.0`** (was `^4.0.0`). The plugins inject
  `@source inline(…)`, which Tailwind parses from 4.1.0; on 4.0.x every build failed
  with Tailwind's own "`@source` paths must be quoted", naming neither tailess nor the
  version, and 29 of the typed keys have no rule there. `tailess check` now says so
  outright — "tailess needs tailwindcss 4.1 or later, and this project has 4.0.17" —
  instead of blaming a moved breakpoint.
- **`tailwind-merge` is `^3.7.0`** (was `^3.3.1`). Below 3.5.0 it does not know the
  Tailwind 4.2 logical utilities, so `ss({ base: "mbs-2" }, { base: "mbs-1" })` kept
  both and the earlier one won in the CSS; below 3.7.0 the same happened to
  `bg-radial` / `bg-conic`. npm dedupes to whatever an app already locks, which is how
  the old floor was reached in practice.
