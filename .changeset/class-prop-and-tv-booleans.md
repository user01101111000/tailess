---
"tailess": patch
---

A `variants` component says so, in development, when `class` or `className` arrives in its
props — cva and tailwind-variants read them there, and here they were dropped without a
word; extra classes are the second argument. The migration table names this and the one
other call-site difference: tailwind-variants applies a boolean's `false` option when the
prop is omitted, tailess (like cva) does not — add `defaults: { disabled: false }` to keep
it. It used to say a port was the rename "and nothing else".
