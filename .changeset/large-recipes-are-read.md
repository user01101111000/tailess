---
"tailess": patch
---

The build reads a helper call whose arguments run past 20,000 characters, when they
plainly start as code.

A `variants()` recipe the size of a tailwind-variants port — a dozen variants, each
option an `ss` map per part — is one call, and past 20,000 characters the scanner
dropped it whole: every responsive and state class in it reached the element with no
CSS, `tailess check` reported "nothing to check", and nothing warned. The cap exists for
prose ("turn it on (or off"), whose `(` never opened a call; an argument list that starts
with an object, an array or a string now gets a far larger one.
