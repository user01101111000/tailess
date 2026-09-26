---
"tailess": patch
---

`tailess check` agrees with the build in three more places:

- `--strict` fails on the stylesheet's own build-time checks — a `@theme` that removes a
  breakpoint — which both plugins fail a `diagnostics: "error"` build on. It never ran
  them, and exited 0. Notes (a variant or breakpoint the project added) are printed and
  fail nothing, as in the build.
- `--ignore` applies to the search for entry stylesheets too, so a stale one under
  `--content` can be left out; since a class passes when any entry has its rule, it used
  to vouch for the app's broken classes. The README now says so, and recommends `--css`.
- The "plugin may not be running" guess reads configs the way `doctor` does, and counts
  only real build configs: an `.npmrc` at a monorepo root was one, and failed a correctly
  wired app under `--strict`. With no build config in the working directory, the nearest
  one above each `--content` root answers.
