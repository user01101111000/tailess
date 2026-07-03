---
"tailess": patch
---

Fix variant keys that collide with `Object.prototype` members.

Resolving a state/variant key looked it up with `map[key] ?? key`, which returns
an inherited function for keys like `toString`, `constructor`, `valueOf`, or
`hasOwnProperty` instead of falling back. `on("toString", "block")` produced
`"function toString() { [native code] }:block"` rather than treating the key as a
literal prefix.

Lookups now read own properties only (`Object.hasOwn`), so any unregistered key —
including prototype names — behaves like a normal unknown key across `on`, `ss`,
`match`, the `until`/`between` warnings, and the class scanner.
