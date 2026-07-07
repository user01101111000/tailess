# tailess

## 0.6.0

### Minor Changes

- 2fa84de: Simplify setup: install the package, use the helpers — and reach for a config only
  when you want custom keys. Removes the "env"-style machinery in favor of one clear path.

  **Removed** (breaking):

  - The PostCSS plugin no longer generates a `tailess-env.d.ts`. The `types` option and
    the auto-written `Register` augmentation are gone.
  - `configureTailess()` and the `Register` / `RegisteredConfig` types are removed.

  **How custom keys work now.** Write a `tailess.config.ts` with `defineConfig` and
  re-export its helpers — your custom breakpoints/states are autocompleted and
  type-checked at every call site, with **no generated file** and no global setup:

  ```ts
  // tailess.config.ts
  import { defineConfig } from "tailess";

  const t = defineConfig({ screens: { "3xl": "1600px" } });
  export default t; // the PostCSS plugin reads this
  export const { ss, on, cn } = t; // fully-typed helpers for your app
  ```

  ```tsx
  import { ss } from "@/tailess.config";
  ss({ base: "text-sm", "3xl": "text-2xl" }); // ✅ "3xl" autocompleted + typed
  ```

  The zero-config path is unchanged: `import { ss } from "tailess"` still gives you
  Tailwind's default breakpoints/states with full autocomplete, no setup. The PostCSS
  plugin still scans your source and injects `@source inline(...)` so runtime-built
  classes get their CSS, and still mirrors custom breakpoints into `@theme`.

## 0.5.0

### Minor Changes

- Make custom config keys flow into the helpers with the least setup possible — you
  write only the config file.

  **The PostCSS plugin now generates types for you.** It already reads your config to
  mirror breakpoints into `@theme`; it now also writes a `tailess-env.d.ts` with a
  `Register` augmentation, so a bare `import { ss } from "tailess"` autocompletes and
  type-checks your custom keys with **zero** hand-written types. Configurable via the
  plugin's `types` option (`false` to disable, or a path string); reading a TypeScript
  config needs `jiti`, same as `@theme` mirroring. The write is skipped when unchanged,
  so it never triggers a watch-mode rebuild loop.

  ```ts
  // tailess.config.ts — the entire setup
  import { defineConfig } from "tailess";
  export default defineConfig({ screens: { xs: "480px", "3xl": "1600px" } });
  ```

  ```ts
  import { ss } from "tailess";
  ss({ xs: "block", "3xl": "text-2xl" }); // custom keys autocompleted + typed
  ```

  `defineConfig` also now returns the config **and** a fully-typed tailess instance in
  one call, so the config file can double as your tailess module (`import t from
"./tailess.config"; t.ss(...)`) without a separate `createTailess` call. It stays
  assignable to the old `C` return type, so `createTailess(defineConfig(...))` keeps
  working.

## 0.4.0

### Minor Changes

- ba3287a: Let the top-level helpers use your custom config — via a `Register` type
  augmentation and a runtime `configureTailess()`.

  Previously the helpers imported straight from `"tailess"` (`ss`, `on`,
  `responsive`, `until`, `between`) were locked to the zero-config default: a custom
  key like `xs` from your `tailess.config.ts` was a type error with no autocomplete,
  and at runtime it fell back to the default config (no `base`, dev warning). Custom
  keys only worked through a `createTailess(config)` instance.

  Now you can wire the top-level helpers to your config in two one-time steps:

  ```ts
  // tailess.d.ts — teaches the types your keys
  import type config from "./tailess.config";
  declare module "tailess" {
    interface Register {
      config: typeof config;
    }
  }

  // app entry — teaches the runtime your config
  import { configureTailess } from "tailess";
  import config from "./tailess.config";
  configureTailess(config);
  ```

  After that, `ss({ xs: "block", groupHover: "underline" })` autocompletes,
  type-checks, applies your `base`, and stops warning at runtime — no per-file
  instance import required. New exports: `configureTailess`, plus the `Register` and
  `RegisteredConfig` types.

  The top-level `cn` now also honors the configured `base` (it delegates to the
  active instance instead of being a raw re-export), so `base` tokens are prepended
  consistently across every top-level helper. With no config this is unchanged — a
  plain `clsx` + `tailwind-merge`.

  Also fixes the top-level helpers' hover docs: they now surface the full JSDoc
  (description + `@example`) instead of a one-line summary that overrode it, and
  fills in full JSDoc + examples on every `Tailess` instance method (`cn`,
  `responsive`, `on`, `until`, `between`, `match`, `data`, `aria`).

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
