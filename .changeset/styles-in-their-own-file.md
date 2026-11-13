---
"tailess": minor
---

Recipes as a design system's styles file — `Button.styles.ts` beside `Button.tsx`, with
the component passing **state, not classes** — and a README section on how to lay one out.

**A recipe no longer needs `variants`.** It was the test for "is this a config" at
runtime, and required by the types — but a component whose parts never change is
`{ slots }` and nothing else, and a child that only moves its parent's defaults is
`{ extend, defaults }`. The runtime read both as base classes, an `ss` map: the first
emitted `slots:root:p-2`, the second dropped the parent entirely. 0.13 closed that by
refusing the shape at compile time. This makes it work instead: a config is whatever has
a key only a config can have, and the types, the runtime and the scanner now ask that
one question of the same seven keys.

```ts
const field = variants({ slots: { root: "grid gap-1.5", label: "text-sm font-medium" } });
const destructive = variants({ extend: button, defaults: { tone: "danger" } });
```

So `variants({ extend: button, base: "font-medium" })` and
`variants({ base: "p-2", defaults: {} })`, both compile errors in 0.13, now build. A plain
`ss` map with none of those keys is still base classes — `cva`'s one-argument call.

A variant-less child does not have its groups inferred from `defaults` or `compound`:
with nothing else to infer them from TypeScript did, the result failed the constraint,
and the constraint — a string index signature — was used instead, so the child took any
prop at all.

**Docs and example.**

- New README section,
  [Styles in their own file](https://github.com/user01101111000/tailess#styles-in-their-own-file):
  which of a string, a recipe or a function a style should be; every kind of state and
  where it is written — a prop, the browser's own, an attribute the markup carries, a
  parent's, a number — sharing fragments between recipes; and why a `configure` call
  belongs in a module imported before any styles file.
- `examples/vite-react` is rebuilt around `*.styles.ts` files: there is not one class in
  its components.
- `test/integration/styles-file.test.ts` compiles that layout with the real Tailwind and
  drives every recipe through every state a component could pass.
