---
"tailess": patch
---

The build reads a `variants` compound list written with a TypeScript assertion or in
parentheses.

`compound: [ … ] as const`, `compoundVariants: [ … ] satisfies ReadonlyArray<…>` and
`compound: ([ … ])` each lost every compound class from the candidate list, because the
scanner only unwrapped text that started with `[` and ended with `]`. The runtime still
applied the classes, so they reached the element with no CSS, and no check said so.
