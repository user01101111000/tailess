---
"tailess": minor
---

Make custom config keys flow into the helpers with the least setup possible — you
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
