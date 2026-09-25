---
"tailess": patch
---

`variants()` types the same with `strictNullChecks` off — TypeScript's default — as with
it on. A regression from 0.11.0.

The "was a parent recipe passed to `extend`?" check asked it of a type parameter that
defaults to `undefined`, and without `strictNullChecks` `undefined` is assignable to every
object type, so every recipe in such a project inherited `Record<string, …>` as its
variants. Boolean and numeric variant props stopped compiling (`{ disabled: true }`,
`{ cols: 2 }`), a misspelt variant compiled, and the README's
`ComponentProps<"button"> & VariantProps<typeof button>` rejected `onClick` and
`tabIndex`. The published declarations are now compiled in the suite under three sets of
compiler options.
