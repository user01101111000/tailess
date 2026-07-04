---
"tailess": minor
---

Make custom config keys flow into the helpers with the least setup possible.

**The PostCSS plugin now generates types for you.** It already reads your config to
mirror breakpoints into `@theme`; it now also writes a `tailess-env.d.ts` with a
`Register` augmentation, so a bare `import { ss } from "tailess"` autocompletes and
type-checks your custom keys with **zero** hand-written types — you only write the
config. Configurable via the plugin's `types` option (`false` to disable, or a path
string); requires `jiti` for a TypeScript config, same as `@theme` mirroring.

`defineConfig` now returns the config **and** a fully-typed tailess instance in one
call, so a `tailess.config.ts` is the entire setup — no separate `createTailess`
wiring:

```ts
// tailess.config.ts — the whole thing
import { defineConfig } from "tailess";
export default defineConfig({ screens: { xs: "480px", "3xl": "1600px" } });
```

```ts
import t from "@/tailess.config";
t.ss({ xs: "block", "3xl": "text-2xl" }); // custom keys autocompleted + typed
```

The returned value doubles as the config object (its `screens`/`states`/`base` stay
on top level for the PostCSS plugin's default-export read) and as the instance
(`.ss`, `.on`, `.cn`, …). It stays assignable to the old `C` return type, so
`createTailess(defineConfig(...))` keeps working.

It also lets the top-level helpers use your custom config — via a `Register` type
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
