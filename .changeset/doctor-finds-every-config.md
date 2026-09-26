---
"tailess": patch
---

`tailess doctor` and `tailess init` find the config your build actually uses, and stop
failing working projects:

- PostCSS configs in `package.json`'s `postcss` key and every `.postcssrc` spelling
  (`.yml`, `.yaml`, `.js`, `.cjs`, `.mjs`, `.ts`) are read. They exited 2 — "no
  postcss.config here" — on wired, working projects. JSON and YAML configs are read but
  never edited, and the line to add is printed in their own syntax.
- Astro, Nuxt and SolidStart configs are read for `vite.plugins`, instead of exiting 2 with
  advice about monorepos. `init` says what to add rather than editing them.
- A plugin list built in a local preset (`plugins: sharedPlugins()` from `./vite.shared`) is
  followed. It failed a working build, and `init` then registered the plugin twice. A
  preset that cannot be read is reported as such, not as unwired.
- Of two Vite configs, the one Vite loads is read. A Vite project that compiles Tailwind
  through `postcss.config` is answered for that file, as the README recommends.
- A config that never loads Tailwind's own plugin gets a note: nothing compiles Tailwind
  there, which `doctor` used to call healthy.
