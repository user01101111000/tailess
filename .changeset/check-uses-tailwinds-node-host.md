---
"tailess": patch
---

`tailess check` compiles through Tailwind's own Node host (`@tailwindcss/node`, which
`@tailwindcss/postcss` and `@tailwindcss/vite` both run) when the project has it, so it
loads `@import`, `@plugin` and `@config` exactly as the build does.

An ESM-only `@plugin` package — an exports map with only an `import` condition — made the
gate exit 2 with `could not resolve` while the build loaded it, and a TypeScript
`@config` or `@plugin` worked only on a Node that strips types natively, which excludes
the 20.19 floor. A project without `@tailwindcss/node` keeps the previous loaders.
