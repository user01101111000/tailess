---
"tailess": patch
---

The README's recipe for publishing a component library styles every class in the
consumer, not only the prefixed ones.

`tailess emit` writes the classes tailess *builds* — `md:p-4`, `dark:hover:bg-black`.
The literals — `base` classes, flat variant options, `match` values, plain `className`
strings — are left to Tailwind's scan, which in an app reads your source and in a
consumer never reads `node_modules`. Shipping only the emitted file, as the recipe said,
left every one of them unstyled in every consumer, with nothing warning in either build.
The recipe now ships a `styles.css` at the package root that also names the bundle as a
source (`@source "./dist"`), so the consumer's single `@import` covers both — built end
to end in a new test.
