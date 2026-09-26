---
"tailess": patch
---

The build check for a bucket the scanner cannot read now fires inside `variants()` and
inside nested maps, as the README promises for everything under a prefixed key.

`variants({ variants: { size: { lg: { md: size } } } })`, a `base: { md: size }`, a
compound `class: { md: size }`, a slot's `{ md: size }` and `ss({ dark: { md: size } })`
were all silent: the recipe helper had no case in the diagnostics, and a value that was
itself a map was skipped rather than walked. Each built a prefixed class with no rule.
An unprefixed value — `base: size`, a slot or option set to a variable — stays quiet, as
in `ss`.
