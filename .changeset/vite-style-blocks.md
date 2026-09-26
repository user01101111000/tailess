---
"tailess": patch
---

The Vite plugin handles `@import "tailwindcss"` written in a Vue or Svelte `<style>` block,
or in an inline `<style>` in `index.html`. Tailwind compiles those, but the plugin read
only the path before `?`, saw `App.vue`, and skipped it — every runtime-built class
unstyled, with nothing printed. It now uses the same test Tailwind's own plugin does.
