---
"tailess": patch
---

`has('[data-state="open"]', …)`, `supports('font-family: "Inter"', …)` and the like no
longer warn in development or at build time. The plugin has carried a class holding `"`
since the double-quote fix, but the unusable-value check still called every `"` unusable,
so working code failed `tailess check --strict` and `diagnostics: "error"` builds. It now
reports only what really cannot be carried: `{`, `}`, `\`, `;`, an unclosed quote, or both
kinds of quote. A quoted `nth` position (`nthOfType('"2n"', …)`) — a selector the browser
discards — keeps a warning of its own.
