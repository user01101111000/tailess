---
"tailess": patch
---

A `variants` compound rule that names a group the recipe does not declare never applies,
and says so once in development. cva and tailwind-variants differ here: they match such a
rule against whatever props are passed, so a port that keys a rule on an undeclared prop
loses those classes — the warning names the rule.

Only the declared groups were checked against a rule, so a typo (`sizee: "lg"`) or a
group renamed since the rule was written counted as met, and the rule's classes landed on
every instance meeting its other conditions. The types refuse such a key in a literal
config; this is for plain JavaScript, casts and configs built at runtime.
