---
"tailess": patch
---

`diagnostics: "error"` no longer fails a build over a theme note about CSS that works.

Following "Keys your own CSS adds" — `--breakpoint-3xl`, a `@custom-variant`, the keys
declared — under the `diagnostics: "error"` the README recommends for CI failed the
production build, with a message saying `ss({ "3xl": … })` "will not compile" to a
project where it compiled. A moved breakpoint width failed it too, on a note that itself
said the classes are fine. Those three cases are now marked `informational` on the
`Diagnostic` (a new optional field in `tailess/build`), printed in every mode, and never
counted as a failure; the message says to declare the key or use `withPrefix`. A removed
breakpoint — classes with no rule — still fails the build.
