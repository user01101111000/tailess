# tailess

## 0.8.0

### Minor Changes

- 4da7c2d: Fix silent class loss in markup files, complete the variant list, and roughly halve
  the runtime cost of `ss`.

  **The scanner no longer loses calls to surrounding markup.** It used to read every
  scanned file as JavaScript, so a quote that wasn't a string literal — an apostrophe in
  `<p>Let's go</p>`, or the delimiters of a Vue attribute like
  `:class="ss({ md: 'grid' })"` — opened a string that ran to the next quote in the file,
  and every `tailess` call in between produced no CSS. The class still landed on the
  element; there was just no rule behind it. In practice this meant Vue and HTML lost
  **all** candidates, and Svelte, JSX, Astro and Markdown lost everything after the first
  unpaired apostrophe. Calls are now located individually and their arguments parsed in
  place, so nothing desyncs.

  The trade is that a call written inside a comment or a string is now picked up too and
  contributes its classes. `@source inline(...)` discards a candidate that matches no
  utility, so a spare one costs a moment of compile time — a missed one costs a broken
  layout.

  **A comment inside an `ss({ … })` object no longer takes the next key with it.** The
  comment was glued onto the key that followed it, so

  ```ts
  ss({
    base: "flex",
    // wider gutters on desktop
    lg: "gap-8",
  });
  ```

  asked Tailwind for a candidate named `// wider gutters on desktop\n  lg:gap-8`, which has
  whitespace in it and was dropped — leaving `lg:gap-8` with no CSS while every other key
  worked. Annotating a breakpoint is common enough that this was worth its own fix. Leading
  trivia is now skipped before the key is read, and a `:` inside a comment is no longer
  mistaken for the key separator. An object left unterminated by a mid-save read is parsed
  as far as it goes rather than discarded whole. A lone `\r` now ends a line comment and an
  unterminated string as well, so a file with classic-Mac line endings no longer lets one
  `//` swallow the rest of itself. LF, CRLF, CR and a leading byte-order mark are covered
  by tests that assert all four produce identical output.

  **`ss` now accepts every static Tailwind variant.** The key list went from 87 to 138,
  adding the child combinators `*` and `**` and completing the `group-*` / `peer-*`
  families, which were missing 24 and 25 entries respectively (`peer-first`,
  `group-invalid`, `group-valid`, `peer-visited`, …). Both families are now derived from
  one shared list, and the test suite enumerates Tailwind's own variant registry and
  compares in both directions, so the list can no longer drift. New exported types:
  `ElementStateKey`, `StandaloneStateKey`, `GroupStateKey`, `PeerStateKey`.

  **Performance.** Measured on the built package: `ss` with three groups dropped from
  ~679 ns to ~313 ns per call, and `withPrefix` roughly halved to ~62 ns, by removing the
  per-key object allocation and `Array#sort` and replacing the regex split with a single
  pass.

  **Three more ways a class could quietly do nothing now say so.**

  - A variant prefix containing whitespace — which is what `data("state", "a b", …)` builds —
    produces `data-[state=a b]:p-2`. The browser reads that as two class names and the build
    scanner drops it for the same reason, so nothing anywhere works and nothing complains.
    It now warns in development, once per prefix, and names Tailwind's `_` escape.
  - `between("lg", "sm", …)` describes an empty range. It compiles to real CSS that no
    viewport can satisfy, so it passes every check and styles nothing; it now warns.
  - The integration check claimed its one-shot flag before testing for a `document`, so a
    server-side render could consume it and leave the browser pass — the only one able to
    observe the marker — permanently silent. The flag is now claimed only once there is a
    document to check.

  **A relative `content` path on Vite is resolved against Vite's root, not the working
  directory.** They are the same only when the build runs from the project it builds, so
  `vite build apps/web`, a monorepo task launched from the workspace root, or a `--config`
  pointing elsewhere all made a documented option — the README's own `content: ["src"]` —
  walk a directory that does not exist. The scan found nothing, the sidecar was still
  written with its marker so the runtime integration check reported success, and every
  runtime-built class lost its CSS with no warning anywhere. An explicit `content` that
  matches no files now warns as well, since that is always a mistake.

  **A dev-server restart no longer stops picking up new classes.** `configureServer`
  latched on the plugin instance, but Vite calls it again on every restart and reuses an
  instance passed through `inlineConfig.plugins`. The new server's watcher then had no
  tailess listeners, so newly written classes silently stopped reaching Tailwind until the
  process was restarted. The latch is now scoped to the watcher.

  **Registering `tailess/postcss` after `@tailwindcss/postcss` says so.** The wrong order
  produced a green build whose CSS was missing every runtime-built class — the one setup
  mistake with no other signal. Tailwind's licence banner is a one-property tell that it has
  already compiled, so the plugin recognises it and names the fix.

  **`extractClasses` can no longer throw.** `skipTemplate` recursed once per nested
  template, so pathological input overflowed the stack; a `RangeError` there escaped the CSS
  transform and failed the whole build. Nesting is now bounded, degrading to the same
  over-approximation the module uses everywhere else.

  **Windows sidecar writes retry.** Renaming onto a file another handle has open is reported
  as `EPERM`/`EACCES`/`EBUSY` on Windows even though it is usually momentary — Tailwind
  reading the sidecar, a virus scanner, the file indexer. A short bounded retry turns a
  spurious failure (and the unnecessary fall back to inlining) back into a normal write.

  **Plugin option types accept an explicit `undefined`,** so `content: isCI ? [...] :
undefined` compiles under `exactOptionalPropertyTypes` — which is what the implementations
  already did at runtime.

  **Build integration robustness.**

  - The generated stylesheet is written atomically and refreshes are serialized, so two
    overlapping writes can no longer interleave into a file that parses as neither list.
  - A failed write no longer fails the Vite build; it falls back to inlining the class
    list, as the PostCSS plugin already did.
  - The PostCSS plugin's directory watch is scoped to the extensions actually scanned
    instead of `**/*`, which had bundlers watching `node_modules`.
  - `withPrefix("", …)` returned `":class"`, which matches nothing. It now returns the
    classes unprefixed and warns in development.
  - Builds keep the `node:` prefix on Node imports instead of emitting bare `fs`/`path`.

  **`tailess/postcss` types now describe the module it actually is.** `require()` of the
  CJS build returns the plugin creator directly — the shape PostCSS needs, since Next.js
  and `postcss-load-config` hand a string-named plugin straight to PostCSS without
  unwrapping `.default`. The declarations claimed a default export instead, so a
  `node16` CJS consumer was told to reach for `.default`, which is `undefined` at runtime,
  and a `postcss.config.cts` could not type the import at all. They now use `export =`.
  The runtime is deliberately unchanged; a test asserts the shape so it stays that way.
  With the declarations fixed, `check:exports` no longer needs to suppress
  `false-export-default`, so that check now runs at full strictness.

## 0.7.0

### Minor Changes

- 2a9b5b1: Make the generated classes actually get CSS, in both Vite and Next.js — and drop the
  custom-key config in favour of Tailwind's own breakpoints and variants.

  ## Fixed: prefixed classes had no CSS

  `tailess` builds `md:`/`hover:` prefixes at runtime, so Tailwind's scanner never sees
  them and emits nothing. The old PostCSS plugin was supposed to bridge that gap. Two
  bugs meant it often didn't:

  - **Vite was never wired up at all.** All of `@tailwindcss/vite`'s plugins are
    `enforce: "pre"`, so Tailwind compiles CSS _before_ Vite's PostCSS stage. The
    injected `@source inline(...)` arrived too late and was emitted into the output
    stylesheet as dead text. There is now a real Vite plugin — **`tailess/vite`** —
    registered `order: "pre"` so it wins regardless of where you put it in `plugins`.

  - **New classes needed a dev-server restart.** Tailwind bakes `@source inline(...)`
    into its compiler when that compiler is created, and only recreates it when one of
    its own _build dependencies_ has a newer mtime — source files aren't build
    dependencies, so the candidate list froze at whatever the first build saw. Both
    plugins now keep the list in a small generated stylesheet that your entry
    `@import`s, which _is_ a dependency Tailwind tracks. Rewriting it is a guaranteed
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

  ss({
    base: "text-xl flex",
    md: "text-2xl",
    "max-md": "gap-2",
    "group-hover": "underline",
  });
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
