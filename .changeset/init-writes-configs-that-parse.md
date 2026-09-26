---
"tailess": patch
---

`tailess init --write` no longer turns a working config into one Vite cannot load. Three
shapes did, after exiting 0 and with `doctor` calling the result wired:

- An `import tailess from "tailess/vite"` already in the file — left behind by a deleted or
  commented-out call — got a second one ("Identifier `tailess` has already been
  declared"). The existing binding is reused now, `import { default as tw }` included.
- A CommonJS `vite.config.cjs` (or a `.js` one written with `require`) got an ESM
  `import` on line 1. It gets `const tailess = require("tailess/vite");` now.
- An import carrying `with { type: "json" }` or `assert { … }`, or TypeScript's
  `import x = require()`, was split in two by the new line.

The edit is also parsed with the project's own Vite before it is written, and refused if
the config parsed before and would not after.
