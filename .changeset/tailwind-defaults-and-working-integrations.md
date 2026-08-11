---
"tailess": minor
---

Make the generated classes actually get CSS, in both Vite and Next.js — and drop the
custom-key config in favour of Tailwind's own breakpoints and variants.

## Fixed: prefixed classes had no CSS

`tailess` builds `md:`/`hover:` prefixes at runtime, so Tailwind's scanner never sees
them and emits nothing. The old PostCSS plugin was supposed to bridge that gap. Two
bugs meant it often didn't:

- **Vite was never wired up at all.** All of `@tailwindcss/vite`'s plugins are
  `enforce: "pre"`, so Tailwind compiles CSS *before* Vite's PostCSS stage. The
  injected `@source inline(...)` arrived too late and was emitted into the output
  stylesheet as dead text. There is now a real Vite plugin — **`tailess/vite`** —
  registered `order: "pre"` so it wins regardless of where you put it in `plugins`.

- **New classes needed a dev-server restart.** Tailwind bakes `@source inline(...)`
  into its compiler when that compiler is created, and only recreates it when one of
  its own *build dependencies* has a newer mtime — source files aren't build
  dependencies, so the candidate list froze at whatever the first build saw. Both
  plugins now keep the list in a small generated stylesheet that your entry
  `@import`s, which *is* a dependency Tailwind tracks. Rewriting it is a guaranteed
  trigger, and the rebuild uses the exact current list, so deleting a class removes
  its CSS too.

Verified end to end against projects created by `create-next-app` and `create-vite`,
plus a split-entry setup and Vite-via-PostCSS: five build configurations and repeated
cold-start dev runs on Turbopack, webpack and Vite, asserting on the generated CSS
each time.

Three more fixes along the way: a stylesheet that reaches Tailwind through a chain of
`@import`s (`app.css` → `tailwind.css`) is now recognised instead of silently getting
nothing; stylesheets Tailwind never compiles are left alone rather than having
`@source` leak into their output; and the dev-only warnings now work in browser
bundles, where `process` doesn't exist.

`match()` also accepts more cases than the key's narrowed type, so the ordinary
`const size: "sm" | "lg" = "sm"` spelling no longer fails to compile.

## Added: it tells you when the integration is missing

The integration injects `:root { --tailess: 1 }`, and in development the runtime
checks for it the first time it builds a prefixed class. If it's absent you get one
console warning naming the exact line to add, instead of silently unstyled elements.
Declare the property yourself to silence it.

## Removed (breaking): custom breakpoints and states

`ss`, `on`, `responsive`, `until` and `between` are now plain functions typed to
Tailwind's built-in keys, which autocomplete with no setup:

```ts
import { ss } from "tailess";

ss({ base: "text-xl flex", md: "text-2xl", "max-md": "gap-2", "group-hover": "underline" });
```

Gone: `defineConfig`, `createTailess`, `resolveConfig`, `st`, `defaultConfig`,
`defaultScreens`, `defaultStates`, and the `Tailess` / `TailessConfig` /
`ResolvedConfig` / `Screens` / `States` types — along with the `tailess.config.ts`
file, its `jiti` peer dependency, and the `@theme` injection that supported it. The
`base` config option is gone too; pass shared tokens explicitly.

**Migrating.** Replace `t.ss(...)` / `st.ss(...)` with the imported `ss(...)` and
delete `tailess.config.ts`. Custom keys have no equivalent for now: use
`withPrefix("3xl", …)` plus your own `@theme` and `@source inline(...)`, or keep the
class literal.

`ss` now also accepts `max-*` keys directly (`ss({ "max-md": "hidden" })`), and state
keys are Tailwind's own names, so an alias like `groupHover` becomes `group-hover`.
