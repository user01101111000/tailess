---
"tailess": patch
---

The README's `tailess.d.ts` for declaring your own keys adds to the package's types
instead of replacing them.

Copied as printed, the file had no import or export, so TypeScript read it as a global
script and `declare module "tailess"` became an ambient declaration that shadowed the
package: every `import { ss } from "tailess"` failed with "has no exported member". The
snippet now starts with `export {};`, says why, and a test compiles it verbatim against
the built declarations.
