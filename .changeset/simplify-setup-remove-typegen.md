---
"tailess": minor
---

Simplify setup: install the package, use the helpers — and reach for a config only
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
export default t;                 // the PostCSS plugin reads this
export const { ss, on, cn } = t;  // fully-typed helpers for your app
```

```tsx
import { ss } from "@/tailess.config";
ss({ base: "text-sm", "3xl": "text-2xl" }); // ✅ "3xl" autocompleted + typed
```

The zero-config path is unchanged: `import { ss } from "tailess"` still gives you
Tailwind's default breakpoints/states with full autocomplete, no setup. The PostCSS
plugin still scans your source and injects `@source inline(...)` so runtime-built
classes get their CSS, and still mirrors custom breakpoints into `@theme`.
