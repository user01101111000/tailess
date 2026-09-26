---
"tailess": patch
---

A framework's own build output no longer fails the build-time checks. SolidStart 1's
`.vinxi/build` and Qwik's `server/` hold minified bundles with
`import{ss as s}from"tailess"`, and each helper there was reported as a renamed import, so
`check --strict` and `diagnostics: "error"` went red after a successful build (SolidStart
on the first one). `.vinxi`, `.nitro`, `.react-router`, `.tanstack` and `.angular` are
skipped by default, and a file a bundler wrote — a source-map comment, or a minified line —
is not checked, only scanned.
