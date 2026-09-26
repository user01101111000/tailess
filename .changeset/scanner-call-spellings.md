---
"tailess": patch
---

The scanner finds more of the calls the runtime makes, so fewer classes land unstyled:
an optional call (`t.ss?.(…)`), a comment between a helper's name and its parenthesis,
TypeScript type arguments (`variants<Props>(…)`), and a comment between a key and its
colon (`lg /* desktops */: "p-3"`). String values decode `\xHH`, `\uHHHH` and `\u{…}`
escapes and backslash line continuations the way the runtime does — a CRLF continuation
used to end the string early and drop the next argument's classes — and template literals
decode their escapes too. The unknown-key warning no longer calls a working Tailwind
variant such as `aria-checked` "not a Tailwind breakpoint or state variant"; it says the
key is not one of `ss()`'s and points to `configure({ keys })`.
