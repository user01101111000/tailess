---
"tailess": minor
---

`ss` is now variadic and its buckets nest, so `cn(ss(…), cond && ss(…))` collapses into
one `ss(…)` — with a small breaking change to the `clsx` dictionary form.

**`ss` takes as many arguments as you like.** An argument is anything a bucket accepts:
another map, a class string, a `clsx` array, or a condition producing one. That removes
the wrapper that every non-trivial call site needed, and with it the second and third
`ss()` inside it:

```tsx
// before
className={cn(
  ss({ base: "rounded-lg border p-4", md: "p-6" }),
  isDisabled && ss({ base: "opacity-50", sm: "bg-red-500" }),
  className,
)}

// after
className={ss(
  { base: "rounded-lg border p-4", md: "p-6" },
  isDisabled && { base: "opacity-50", sm: "bg-red-500" },
  className,
)}
```

Keys are sorted inside each map; the arguments themselves are never reordered, so the
last one wins exactly as it does in `cn`. That ordering is the point rather than a
detail: sorting a bare string into the `base` bucket would place a caller's
`className="md:p-10"` ahead of the component's own `md:p-6` and silently lose to it.
Given only class values `ss` is `cn`, of which it is now a strict superset. `cn` itself
is unchanged and still exported.

**A bucket's value can be another map,** which stacks the prefixes. Each breakpoint gets
its own group with the same keys and the same rules, which is how a compound variant is
written without reaching for `on` or `between`:

```ts
ss({
  md:   { base: "p-6", hover: "p-8", "max-lg": "grid" },
  dark: { base: "text-white", hover: "text-blue-300" },
});
// → "md:p-6 md:max-lg:grid md:hover:p-8 dark:text-white dark:hover:text-blue-300"
```

`md: "p-6"` and `md: { base: "p-6" }` are the same thing, so existing calls need no
change to start nesting. Nesting is bounded at ten levels, which stops an object that
reaches itself from taking the render down with a stack overflow.

**Breaking: a `clsx` dictionary written as a bucket value now goes in an array.**

```ts
ss({ md: { "text-lg": cond } })      // before
ss({ md: [{ "text-lg": cond }] })    // after
```

A bare object is now always a nested map, and an array is always classes. The shape
decides, never the key names — telling the two apart by guessing whether `hover` is a
variant or a class name would make the same source mean different things depending on
what someone named a utility, which is the failure mode this package exists to rule out.
TypeScript rejects the old form, so this surfaces as a compile error rather than a style
that quietly stops appearing.

**The scanner understands both shapes, and one bug it already had is fixed along the
way.** Only `ss`' first argument was ever read, and an object had to *start* its
argument to be parsed at all — so `ss(base, isDisabled && { sm: "bg-red-500" })` produced
no CSS for `sm:bg-red-500`, the exact silent failure this package is built to prevent.
Every argument is now swept for object literals wherever they sit, both branches of a
ternary included, and nested keys are followed to the same depth the runtime allows.
`responsive`'s second argument got the same fix. The end-to-end suite compiles the new
shapes through the real Tailwind compiler on both the Vite and PostCSS paths.

A new suite pins the invariant behind all of this. It hands the scanner a source string,
evaluates *that same string* with the real helpers, and asserts every prefixed class the
runtime produced is among the candidates the scanner found — so the two halves are checked
against each other instead of each against a list that can drift.

**`responsive`, `on`, `until` and `between` are unchanged and staying.** Each is now
expressible as an `ss` shape — `between("sm", "lg", x)` is `ss({ sm: { "max-lg": x } })` —
and the README says so, but they read well on their own and cost nothing when unused.

New exported types: `SsValue`, `SsArg`. `SsInput` keeps its name and is now recursive.

**Breaking: `tailess/vite` is exported only as a default, matching `tailess/postcss`.**
Its CJS build is now `module.exports = tailess`, so `require("tailess/vite")` *is* the
plugin creator — previously it was a namespace object, which a `vite.config.cjs` would
hand to Vite as something Vite rejects. `import tailess from "tailess/vite"`, the only
form the docs have ever shown, is unaffected in both module systems; the undocumented
`import { tailess } from "tailess/vite"` and `require("tailess/vite").default` are gone,
and TypeScript flags both. The `.d.cts` is corrected to `export =` by the same post-build
step that already did it for the PostCSS entry.

That also removes the last warning from the build. Rollup's CJS writer warns on any entry
with both a default and a named export, because it has to guess the shape; tsup exposes
Rollup's input options but not `output.exports`, so there was nowhere to state the intent.
The alternatives were measured and are worse: `silent` hides real warnings, dropping the
tree-shaking pass turns the PostCSS plugin back into `{ default: fn }` and breaks every
string-named config, and splitting the Vite entry into its own tsup config races `clean`
and costs `dist/postcss/index.js` its shared chunk (3.4 kB to 22.1 kB).

**Cost.** The single-map call keeps a dedicated path with no argument loop and measures
within noise of before. The runtime grew 634 minified characters, 270 gzipped — 2.4 kB to
2.6 kB — and the bundle-size budget was raised deliberately to match.
