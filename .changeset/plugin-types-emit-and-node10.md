---
"tailess": patch
---

The plugins' types work in two more setups:

- `tailess/postcss` exports `TailessPostcssPlugin`, the type its call returns. A typed
  `postcss.config.ts` in a `composite` project, or a package exporting the plugin, failed to
  emit declarations: "has or is using private name 'Plugin'".
- Under `moduleResolution: node10` the subpath entries resolve to the CommonJS declarations,
  which say what `require()` really returns. Without `esModuleInterop`, the spelling that
  type-checked — `import tailess from "tailess/postcss"` — crashed at runtime, and the one
  that runs — `import tailess = require("tailess/postcss")` — was a type error.

  The trade-off: node10 cannot tell a CommonJS build from an ESM one, so a config compiled
  with `module: "ESNext"` — which loads the ESM entry, where the default import runs — now
  needs `allowSyntheticDefaultImports` (or `esModuleInterop`) under TypeScript 5.x to accept
  `import tailess from "tailess/vite"`. Vite's node10 templates set it; TypeScript 6 has it
  on always.
