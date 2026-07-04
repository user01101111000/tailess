---
"tailess": minor
---

Let the top-level helpers use your custom config — via a `Register` type
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
