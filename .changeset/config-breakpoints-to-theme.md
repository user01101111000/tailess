---
"tailess": minor
---

Config breakpoints now drive Tailwind's generated media queries.

Previously the `screens` values in your tailess config were only used as variant
prefix *keys* — the pixel values were never emitted, so overriding a default
(`md: "867px"`) or adding a custom key (`3xl: "1600px"`) had no effect on the CSS
Tailwind produced.

The `tailess/postcss` plugin now mirrors your config's `screens` into a `@theme`
block as `--breakpoint-<key>` declarations. Keys you set win (override or add);
keys you don't set keep Tailwind's own defaults. The plugin's `config` option
also accepts an inline `TailessConfig` object, not just a path.
