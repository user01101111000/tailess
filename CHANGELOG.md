# tailess

## 0.3.0

### Minor Changes

- 0c0471d: Config breakpoints now drive Tailwind's generated media queries.

  Previously the `screens` values in your tailess config were only used as variant
  prefix _keys_ — the pixel values were never emitted, so overriding a default
  (`md: "867px"`) or adding a custom key (`3xl: "1600px"`) had no effect on the CSS
  Tailwind produced.

  The `tailess/postcss` plugin now mirrors your config's `screens` into a `@theme`
  block as `--breakpoint-<key>` declarations. Keys you set win (override or add);
  keys you don't set keep Tailwind's own defaults. The plugin's `config` option
  also accepts an inline `TailessConfig` object, not just a path.

### Patch Changes

- 5ecf0d7: Fix variant keys that collide with `Object.prototype` members.

  Resolving a state/variant key looked it up with `map[key] ?? key`, which returns
  an inherited function for keys like `toString`, `constructor`, `valueOf`, or
  `hasOwnProperty` instead of falling back. `on("toString", "block")` produced
  `"function toString() { [native code] }:block"` rather than treating the key as a
  literal prefix.

  Lookups now read own properties only (`Object.hasOwn`), so any unregistered key —
  including prototype names — behaves like a normal unknown key across `on`, `ss`,
  `match`, the `until`/`between` warnings, and the class scanner.

- 267b294: Fix missing autocomplete for breakpoint/state keys on the default helpers.

  The top-level `ss`, `responsive`, `on`, `until`, and `between` are bound to the
  zero-config instance, whose config type is the wide `Record<string, string>`.
  `keyof` on that is `string`, so `"sm" | "md" | ... | string` collapsed to plain
  `string` and every literal key suggestion was lost — you got no autocomplete and
  unknown keys were silently accepted.

  Key resolution now filters out the `string`/`number` index signature via a
  `LiteralKeys` helper, so the default breakpoints (`sm`/`md`/`lg`/`xl`/`2xl`) and
  states always autocomplete, and any custom keys from a `createTailess(config)`
  instance are added on top. Unknown keys are now a compile-time error, matching
  the existing dev-time runtime warning.

## 0.2.0

### Minor Changes

- 08a3cfa: Add `tailess/postcss` — a PostCSS plugin that makes tailess work with Tailwind v4.

  Tailwind v4 only generates CSS for class names that appear literally in source,
  but tailess builds variant prefixes (`md:`, `hover:`, …) at runtime — so the full
  class names were never seen and no CSS was emitted.

  The plugin scans your source, enumerates the classes tailess produces, and injects
  them into Tailwind via `@source inline(...)`. Setup is a single line in
  `postcss.config` — no CSS `@source`, no generated file, no scan step — and it
  registers source directories as watch dependencies for live dev updates.
  TypeScript configs load via `jiti` when installed (optional peer dependency).

  See the "Tailwind v4 setup" section in the README.

## 0.1.0

### Minor Changes

- c3664c2: Initial release. Type-safe, config-driven Tailwind CSS class helpers:

  - `ss` — group classes by breakpoint/state in a readable object
  - `cn` — join classes and resolve Tailwind conflicts (`clsx` + `tailwind-merge`)
  - `responsive` — mobile-first responsive strings, plus `until` / `between` for `max-*` ranges
  - `on` — state variants, with array support for stacked variants (`dark:hover:`)
  - `data` / `aria` — attribute variants for headless UI libraries
  - `match` — exhaustive, compile-time-checked variant selection
  - `createTailess` factory and `defineConfig` for type-safe `tailess.config.ts` files
