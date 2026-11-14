---
"tailess": minor
---

**Breaking, in a minor as the stability table allows: a variant nobody passed is now
`false`.** A recipe with a `false` option and no default used to add nothing when the prop
was omitted; it now adds the `false` option's classes, and a compound rule asking for
`false` applies. To keep the old output for one variant, give its third state a name of
its own — `state: { on: …, off: … }` instead of `{ true: …, false: … }` — since an option
that is not `false` is never chosen for you. A recipe that already sets
`defaults: { disabled: false }` reads exactly as before.

```ts
const tab = variants({
  variants: { active: { true: "text-blue-700", false: "text-neutral-500" } },
  compound: [{ active: false, class: { hover: "text-neutral-900" } }],
});

tab();                     // 0.13: ""    now: "text-neutral-500 hover:text-neutral-900"
tab({ active: isActive }); // isActive may be undefined, and the tab is still styled
```

For something that is on or off, "not passed" means off everywhere else — `<Tab />` is
not active — and a component forwards an optional prop as `undefined` far more often than
as `false`. Read as *nothing*, the `false` half of a boolean variant, and every compound
rule written against `false`, silently did not apply until someone remembered
`defaults: { active: false }`. No error and no warning could say so: the element was just
missing the classes written for exactly that state, which is the one failure this package
exists to rule out.

This is what `tailwind-variants` does, and it was listed in the migration table as a
difference from it. It is now a difference from `cva` instead, which applies nothing —
measured against `class-variance-authority` 0.7.1 and `tailwind-variants` 4.0.2. `cva`'s
own documentation sets `defaultVariants: { disabled: false }` on its boolean example, and
a recipe written that way is unaffected.

A variant that is a choice between options — `size`, `tone` — has no `false` option to
fall to, so one nobody passed still adds nothing.

Two things reported as open in the same review are deliberately unchanged:

- `class` / `className` in a recipe's props is still not applied, and still warns. Extra
  classes are the argument after the props, which keeps the props a statement of state
  alone — and unlike the boolean case this one is loud: a compile error in TypeScript, a
  warning from JavaScript.
- `match(value, { true: …, false: … })` sends `null` and `undefined` to its fallback, not
  to `false`. It has a fallback argument for exactly that, and it is a lookup, not a
  state.
