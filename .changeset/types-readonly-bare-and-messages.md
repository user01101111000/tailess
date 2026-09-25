---
"tailess": patch
---

Type fixes:

- `ss` and `variants` accept `readonly` class lists — `["flex", "gap-2"] as const`, a
  `readonly string[]` prop — which the runtime already read like any other list.
- A recipe's props must be an object. With no variants they were typed `{}`, which a string
  satisfies, so `bare(className)` compiled and the class was dropped.
- A mistake in a recipe's `compound` rules is reported with the mistake in it —
  "'tones' does not exist … Did you mean to write 'tone'?" — at the rule. Every such error
  read "'variants' does not exist in type 'SsInput'", because `variants(base)` was the last
  overload TypeScript tried.
- The README states the TypeScript floor: 5.0, for `const` type parameters.
