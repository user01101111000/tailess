---
"tailess": patch
---

A `variants` compound rule that names a group the recipe does not declare never applies
— as in cva and tailwind-variants — and says so once in development.

Only the declared groups were checked against a rule, so a typo (`sizee: "lg"`) or a
group renamed since the rule was written counted as met, and the rule's classes landed on
every instance meeting its other conditions. The types refuse such a key in a literal
config; this is for plain JavaScript, casts and configs built at runtime.
