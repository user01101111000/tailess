---
"tailess": patch
---

`tailess doctor`, `tailess init` and `check --strict` read a config the way its loader
does, rather than looking for the plugin's name:

- A PostCSS config that imports or requires `tailess/postcss` and never lists it, or lists
  it as `false`, is not wired. Nor is one that lists it after `@tailwindcss/postcss`:
  `doctor` exits 1 and says to move it first, and `init` leaves it for you to reorder. All
  three built with no variant CSS and passed both gates.
- `init` adds `require("tailess/postcss")()` — or an import and a call — to a PostCSS list
  of plugin instances, the README's own form. It used to add the string, which
  postcss-load-config rejects ("Invalid PostCSS Plugin found at: plugins[0]").
- A Vite `tailess()` counts only in the config's own `plugins`, not in
  `build.rollupOptions.plugins` or `css.postcss.plugins` — and `init` no longer writes it
  there when the top-level list is a variable. The first lost every variant class in dev
  with nothing printed; the second failed the build.
- `tailess/postcss` beside `@tailwindcss/vite` is not wired, as the README says.
