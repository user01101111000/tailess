---
"tailess": patch
---

`tailess check` resolves a stylesheet `@import` from a package the way Tailwind does,
including a style-only package and a scoped one.

A project whose entry stylesheet imports `tw-animate-css` — which shadcn/ui's Tailwind
v4 setup does — could not be checked at all: the build resolved the import, and the
gate exited 2 with `Package subpath './package.json' is not defined by "exports"`,
because it looked the manifest up through the package's own exports map. A scoped
package (`@import "@acme/tokens"`) failed as `Cannot find module '@acme/package.json'`.
The package is now found on disk, and the `style` condition is followed on the root and
on a subpath (`@import "@acme/ui/theme"`).
