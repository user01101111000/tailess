<p align="center">
  <img src="./assets/logo.svg" alt="tailess logo" width="120" height="120">
</p>

<h1 align="center">tailess</h1>

<p align="center">
  <strong>Write Tailwind classes as a readable object — grouped by breakpoint and state,<br>fully typed, and wired into Tailwind so they actually get CSS.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/tailess"><img src="https://img.shields.io/npm/v/tailess.svg" alt="npm version"></a>
  <a href="https://bundlejs.com/?q=tailess"><img src="https://img.shields.io/bundlejs/size/tailess" alt="bundle size"></a>
  <a href="https://github.com/user01101111000/tailess/actions/workflows/ci.yml"><img src="https://github.com/user01101111000/tailess/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="license"></a>
</p>

---

A long Tailwind `className` is one flat string with base classes, breakpoints and states
all interleaved. `tailess` lets you write the same thing as an object — every key
autocompleted, every typo a compile error.

```tsx
// ❌ one string, everything jumbled together
<div className="text-xl flex sm:block md:text-2xl hover:opacity-100 dark:bg-black" />

// ✅ grouped, readable, typed
<div className={ss({
  base:  "text-xl flex",
  sm:    "block",
  md:    "text-2xl",
  hover: "opacity-100",
  dark:  "bg-black",
})} />
```

Same output, same runtime cost profile as any `clsx` + `tailwind-merge` setup — but the
structure is visible, and the compiler checks it.

And one call is the whole `className`. Conditions, a caller's `className`, and compound
variants all go **inside** it — no wrapper helper, no second `ss()`:

```tsx
// ❌ a wrapper, and ss() again for every condition
className={cn(
  ss({ base: "rounded-lg border p-4", md: "p-6" }),
  ss({ dark: "border-neutral-800" }),
  isDisabled && ss({ base: "opacity-50", sm: "bg-red-500" }),
  className,
)}

// ✅ one call
className={ss(
  {
    base: "rounded-lg border p-4",
    md:   "p-6",
    dark: { base: "border-neutral-800", hover: "border-neutral-700" },
  },
  isDisabled && { base: "opacity-50", sm: "bg-red-500" },
  className,
)}
```

`ss` is a strict superset of a `cn()` helper: hand it plain strings and it *is* `cn`.

## Why this isn't just a formatting trick

Building `md:` at runtime is easy. Making Tailwind **emit CSS** for it is the hard part,
and it's where every hand-rolled version of this idea quietly fails.

Tailwind v4 generates CSS by scanning your source for *literal* class strings. It never
runs your code. So `"md:" + "text-2xl"` is invisible to it: the class lands on the
element, and there is no rule behind it. Your element is simply unstyled, with nothing in
the console and nothing in the build log.

`tailess` ships a one-line build plugin that closes that gap — it reads your source,
enumerates every class your `ss()` calls can produce, and hands the list to Tailwind
through its own `@source inline(...)` safelist. And if you ever forget to install it,
you get a console message naming the fix instead of a silently broken page.

- 🎯 **Typed against Tailwind itself** — 149 keys, every one verified against the real Tailwind compiler in CI.
- 🔌 **One line of setup** — a Vite or PostCSS plugin. No config file, no CSS changes, nothing to commit.
- 🧯 **No silent failures** — the whole reason this package exists.
- ♻️ **Instant in dev** — add a class and it appears without restarting; delete it and it stops being emitted.
- 🪶 **Small** — 2.6 kB of its own code, ESM + CJS, tree-shakeable. [See what the badge counts](#bundle-size).
- ⚡ **Fast** — `ss()` with three groups costs ~385 ns, one `tailwind-merge` pass whatever the shape.

## Contents

- [Requirements](#requirements) · [Install](#install)
- [Setup](#setup) — [Vite](#vite) · [Next.js](#nextjs) · [Other PostCSS setups](#other-postcss-setups)
- [How it works](#how-it-works)
- [What the scanner can and cannot see](#what-the-scanner-can-and-cannot-see)
- [API](#api) — [`ss`](#ss--group-by-breakpoint-and-state) · [composing](#many-arguments-one-call) · [nesting](#nested-groups-for-compound-variants) · [the other helpers](#cn--compose-and-merge)
- [Upgrading from 0.6](#upgrading-from-06)
- [Framework examples](#framework-examples) · [Keys](#keys) · [Plugin options](#plugin-options)
- [Performance](#performance) · [Bundle size](#bundle-size)
- [Troubleshooting](#troubleshooting) · [Verified on](#verified-on) · [FAQ](#faq)
- [Contributing](#contributing) · [License](#license)

## Requirements

| | |
| --- | --- |
| **Tailwind CSS** | v4 — v3 is not supported |
| **Node** | 18+ (build plugin only; the runtime has no Node dependency) |
| **Bundler** | anything using `@tailwindcss/vite` or `@tailwindcss/postcss` |

## Install

```bash
npm install tailess
```

## Setup

Add one line to the config file you already have for Tailwind. There is no
`tailess.config`, nothing to add to your CSS, and no generated file to commit.

### Vite

React, Vue, Svelte, Solid, Qwik, Astro — anything on Vite.

```ts
// vite.config.ts
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import tailess from "tailess/vite";

export default defineConfig({
  plugins: [tailwindcss(), tailess()],
});
```

Order in the array doesn't matter — the hook is registered `order: "pre"`, so it always
runs before Tailwind wherever you put it. A CommonJS config works the same way:
`require("tailess/vite")` is the plugin itself.

### Next.js

Add it to the `postcss.config.mjs` that `create-next-app` already generated, **before**
`@tailwindcss/postcss`:

```js
// postcss.config.mjs
const config = {
  plugins: {
    "tailess/postcss": {},
    "@tailwindcss/postcss": {},
  },
};

export default config;
```

Works with Turbopack and webpack, in `dev` and `build`.

### Other PostCSS setups

The same `postcss.config.*` works for Remix, Astro-with-PostCSS, Nuxt, the PostCSS CLI,
and anything else in that family — including the array form:

```js
module.exports = {
  plugins: [require("tailess/postcss")(), require("@tailwindcss/postcss")()],
};
```

> [!IMPORTANT]
> **On Vite, use `tailess/vite` — not `tailess/postcss`.** `@tailwindcss/vite` compiles
> CSS in a `pre` transform, which runs *before* Vite's PostCSS stage, so a PostCSS plugin
> can never reach it. (If your Vite project gets Tailwind through `postcss.config.*`
> rather than `@tailwindcss/vite`, then the PostCSS plugin is the right one.)

That's the whole setup:

```tsx
import { ss } from "tailess";
```

## How it works

```text
your source                  tailess plugin                    Tailwind
───────────                  ──────────────                    ────────
ss({ md: "text-2xl" })  ──▶  scan + enumerate           
                             "md:text-2xl"              
                                   │
                                   ▼
                             node_modules/.cache/…/tailess.css
                             @source inline("md:text-2xl")  ──▶  .md\:text-2xl { … }
                                   │
       your app.css  ──▶  @import "…/tailess.css"  (injected)
```

Three details make this reliable rather than merely clever:

**The list goes in a separate file, not inline.** Tailwind re-reads `@source inline(...)`
only when it rebuilds its compiler, and it only rebuilds when one of its own build
dependencies changes. Your `.tsx` files aren't dependencies — but an `@import`ed
stylesheet is. Writing the list to a sidecar file makes every change a guaranteed
rebuild trigger, which is what lets a brand-new class work without restarting the dev
server. A class you delete loses its CSS too, instead of lingering forever.

**Injection is scoped to real Tailwind entries.** The plugin only touches a stylesheet
that Tailwind actually emits utilities into — directly, or through a chain of relative
`@import`s. Every other CSS file in your build comes out byte-identical.

**A marker proves it's wired up.** The plugin declares `:root { --tailess: 1 }`. In dev,
the first time you build a prefixed class the runtime checks for it and — if it's missing
— prints exactly which line of config you're missing. No marker check runs in production.

## What the scanner can and cannot see

The scanner reads *literal* strings at your call sites. It over-approximates on purpose:
both branches of a ternary, every key of an object, every element of an array. Extra
candidates cost nothing — Tailwind ignores ones that don't resolve — while a missing one
costs you the style.

✅ **Seen**

```tsx
ss({ md: "text-2xl", hover: "underline" })          // literals
ss({ md: isWide ? "grid-cols-3" : "grid-cols-1" })  // both branches
ss({ md: ["flex", cond && "gap-4"] })               // arrays
ss({ md: [{ "text-lg": cond }] })                   // clsx object form, in an array
ss({ md: "text-lg", /* both survive */ lg: "xl" })  // comments anywhere
ss({ dark: { hover: "bg-black" } })                 // nested — dark:hover:bg-black
ss(a, cond && { sm: "bg-red-500" })                 // a map behind a condition
ss(a, open ? { md: "p-6" } : { md: "p-2" })         // both branches, as maps
on(["dark", "hover"], "bg-black")                   // compound variants
data("state", open ? "open" : "closed", "p-2")      // both values
```

❌ **Not seen** — the value isn't in the source to read:

```tsx
const size = "text-2xl";
ss({ md: size });                    // a variable
ss({ md: `text-${scale}` });         // an interpolated template
ss({ ...spread });                   // a spread
ss({ md: { [key]: "grid" } });       // a computed key
withPrefix(dynamicPrefix, "grid");   // a computed prefix
```

The scanner also finds helpers by **name**, so a renamed import hides them:

```tsx
import { ss as tw } from "tailess";
tw({ md: "p-6" });                   // ✗ not found — nothing supplies md:p-6

import * as t from "tailess";
t.ss({ md: "p-6" });                 // ✓ a namespace import is fine
```

If you need one of those, put the literal somewhere the scanner can reach it — usually by
writing the full class in a `match()` lookup, which needs no build integration at all
because every class in it is already a literal:

```tsx
const size = match(scale, { sm: "text-sm", lg: "text-2xl" });
```

Scanned by default: `tsx ts mts cts jsx js mjs cjs mdx md html vue svelte astro`.
Markup files work the same as JS ones — an apostrophe in your prose or a `:class="…"`
attribute won't throw the scanner off.

## API

Every helper is a plain function. No factory, no instance, no config object.

```ts
import { ss, cn, responsive, on, until, between, data, aria, match, withPrefix } from "tailess";
```

| | | needs the plugin |
| --- | --- | :---: |
| [`ss`](#ss--group-by-breakpoint-and-state) | groups, composition, nesting — the whole `className` | ✅ |
| [`cn`](#cn--compose-and-merge) | join and merge, nothing else | — |
| [`responsive`](#responsive--mobile-first) | a base plus min-width overrides | ✅ |
| [`until`](#until--between--max-width-ranges) / [`between`](#until--between--max-width-ranges) | max-width ranges | ✅ |
| [`on`](#on--state-variants) | one state variant, or a stack of them | ✅ |
| [`data`](#data--aria--attribute-variants) / [`aria`](#data--aria--attribute-variants) | attribute variants, for headless UI | ✅ |
| [`match`](#match--exhaustive-variant-selection) | exhaustive lookup by a discriminant | — |
| [`withPrefix`](#withprefix--the-escape-hatch) | any variant tailess doesn't model | ✅ |

"Needs the plugin" means the helper builds a variant prefix at runtime, so Tailwind never
sees the finished class in your source. `cn` and `match` only ever pass through classes
you already wrote as literals.

### `ss` — group by breakpoint and state

The main event. `base` holds classes with no further prefix; every other key is a
breakpoint, a `max-*` range, or a state variant.

```ts
ss({ base: "text-xl flex", sm: "block", md: "text-2xl" });
// → "text-xl flex sm:block md:text-2xl"

ss({ base: "grid", "max-md": "gap-2", "group-hover": "underline" });
// → "grid max-md:gap-2 group-hover:underline"
```

Keys are emitted `base` → breakpoints mobile-first → `max-*` largest-first → states,
**whatever order you wrote them in**, and the result runs through
[`cn`](#cn--compose-and-merge). Stable order is what keeps `tailwind-merge`'s
"last one wins" predictable.

Values are `clsx`-style, so conditions go inline. A falsy value drops the whole group,
prefix included:

```ts
ss({ base: "text-sm", md: isActive && "text-2xl" });
// isActive === false → "text-sm"
```

#### Many arguments, one call

`ss` is variadic, and an argument is anything a bucket accepts: another map, a class
string, a `clsx` array, or a condition that produces one. This is what a `className`
looks like in practice — and why nothing needs to wrap it:

```ts
ss(
  { base: "rounded-lg border p-4", md: "p-6" },
  isDisabled && { base: "opacity-50", sm: "bg-red-500" },
  match(tone, { info: "bg-blue-50", danger: "bg-red-50" }),
  className,
);
```

**Keys are sorted inside each map; the arguments themselves are never reordered.**
That is what makes the last argument win, exactly as it does in `cn`:

```ts
ss({ base: "p-4", md: "p-6" }, "md:p-10");   // → "p-4 md:p-10"
ss({ base: "p-4" }, { base: "p-8" });        // → "p-8"
```

Sorting a bare string into the `base` bucket instead would put a caller's
`className="md:p-10"` *ahead* of your own `md:p-6` and quietly lose to it. It doesn't.

Given only class values, `ss` is `cn`:

```ts
ss("px-2 py-1", isActive && "bg-blue-500", "px-4");  // → "py-1 bg-blue-500 px-4"
```

#### Nested groups, for compound variants

A bucket's value can be another map, which stacks the prefixes. Each breakpoint gets its
own group, with the same keys and the same rules:

```ts
ss({
  base: "text-black p-4",
  md: {
    base:     "p-6",     // → md:p-6
    hover:    "p-8",     // → md:hover:p-8
    "max-lg": "grid",    // → md:max-lg:grid
  },
  dark: {
    base:  "text-white",       // → dark:text-white
    hover: "text-blue-300",    // → dark:hover:text-blue-300
  },
});
```

`md: "p-6"` and `md: { base: "p-6" }` mean the same thing, so nothing has to change to
start nesting. A falsy nested bucket drops, prefix included, like any other.

> [!NOTE]
> A plain object is *always* a nested map, and an array is *always* `clsx` classes.
> Nothing is decided by looking at your key names, so the same source always means the
> same thing. Put a `clsx` dictionary inside an array — `md: [{ "text-lg": cond }]` —
> where there is nothing to confuse it with.

### `cn` — compose and merge

`clsx` for conditional joining, `tailwind-merge` for conflict resolution. `ss` is a
strict superset of it, so reach for `cn` when there are no breakpoints or states in
sight and you'd rather say so.

```ts
cn("px-2 py-1", isActive && "bg-blue-500", "px-4");
// → "py-1 bg-blue-500 px-4"   (px-2 dropped in favour of px-4)
```

### `responsive` — mobile-first

```ts
responsive("text-sm", { md: "text-lg", xl: "text-2xl" });
// → "text-sm md:text-lg xl:text-2xl"
```

### `until` / `between` — max-width ranges

```ts
until("md", "hidden");          // → "max-md:hidden"      (below md)
between("sm", "lg", "block");   // → "sm:max-lg:block"    (sm up to, not incl., lg)
```

### `on` — state variants

```ts
on("hover", "bg-blue-600 text-white");  // → "hover:bg-blue-600 hover:text-white"
on(["dark", "hover"], "bg-black");      // → "dark:hover:bg-black"
```

#### Each of these is a shape of `ss`

Now that `ss` is variadic and nests, every helper above is one of its forms. They are
staying — each reads better on its own, and an unused one costs nothing — but if you'd
rather write everything one way, here is the translation:

| helper | the `ss` form |
| --- | --- |
| `responsive("text-sm", { md: "text-lg" })` | `ss({ base: "text-sm", md: "text-lg" })` |
| `on("hover", x)` | `ss({ hover: x })` |
| `on(["dark", "hover"], x)` | `ss({ dark: { hover: x } })` |
| `until("md", x)` | `ss({ "max-md": x })` |
| `between("sm", "lg", x)` | `ss({ sm: { "max-lg": x } })` |
| `cn(a, cond && b)` | `ss(a, cond && b)` |

### `data` / `aria` — attribute variants

For headless UI libraries (Radix, Ark, React Aria).

```ts
data("state", "open", "opacity-100");           // → "data-[state=open]:opacity-100"
data("disabled", null, "pointer-events-none");  // → "data-[disabled]:pointer-events-none"
aria("expanded", "rotate-180");                 // → "aria-expanded:rotate-180"
```

A value containing a space can't appear in a class name, so write it Tailwind's way —
with `_`, which Tailwind reads back as a space:

```ts
data("state", "half_open", "opacity-50");  // matches data-state="half open"
```

Passing a literal space warns in development rather than silently producing a class that
matches nothing.

### `match` — exhaustive variant selection

Map a discriminant to a class value. Every case must be covered, so a missing one is a
compile error; extra cases are allowed.

```tsx
function Button({ size }: { size: "sm" | "md" | "lg" }) {
  const sizing = match(size, {
    sm: "px-2 py-1 text-sm",
    md: "px-3 py-2 text-base",
    lg: "px-4 py-3 text-lg",   // omit one and it won't compile
  });
}

match(tone, { primary: "bg-blue-600", danger: "bg-red-600" }, "bg-gray-200");
// unknown tone at runtime → the fallback
```

Every class here is already a literal, so `match` needs no build integration.

### `withPrefix` — the escape hatch

For variants tailess doesn't model as keys.

```ts
withPrefix("supports-[display:grid]", "grid");  // → "supports-[display:grid]:grid"
withPrefix("has-[:checked]", "bg-blue-50");     // → "has-[:checked]:bg-blue-50"
withPrefix("group-[.open]", "rotate-90");       // → "group-[.open]:rotate-90"
```

### Also exported

```ts
import { screens, screenKeys, maxScreenKeys, stateKeys } from "tailess";

window.matchMedia(`(min-width: ${screens.md})`).matches;  // "48rem"
```

Types: `SsInput`, `SsValue`, `SsArg`, `SsKey`, `ScreenKey`, `MaxScreenKey`, `StateKey`,
`ResponsiveMap`, `ClassValue`.

## Upgrading from 0.6

Two things changed, and **TypeScript catches both** — neither can turn into a style that
quietly stops appearing. Everything else is untouched: every existing `ss({ … })` call,
`cn`, and all seven other helpers behave exactly as before.

**1. A `clsx` dictionary as a bucket value now goes in an array,** because a bare object
is a nested map:

```ts
ss({ md: { "text-lg": cond } })      // 0.6
ss({ md: [{ "text-lg": cond }] })    // 0.7
```

**2. `tailess/vite` is exported only as a default,** matching `tailess/postcss`:

```js
import tailess from "tailess/vite";      // ✅ unchanged — the only documented form
const tailess = require("tailess/vite"); // ✅ now the plugin itself, so a .cjs config works

import { tailess } from "tailess/vite";  // ✗ removed
require("tailess/vite").default;         // ✗ removed
```

Both plugin entries now have one shape: `require()` hands you the plugin creator. Before
this, a `vite.config.cjs` got a namespace object that Vite rejects.

## Framework examples

<details open>
<summary><strong>React</strong></summary>

```tsx
import { ss, match } from "tailess";

export function Card({
  tone,
  wide,
  disabled,
  className,
}: {
  tone: "info" | "danger";
  wide: boolean;
  disabled: boolean;
  className?: string;
}) {
  return (
    <div
      className={ss(
        {
          base: "rounded-lg border p-4",
          md: wide && "p-6",
          dark: { base: "border-neutral-800", hover: "border-neutral-700" },
          hover: "shadow-md",
          "focus-visible": "ring-2 ring-offset-2",
        },
        disabled && { base: "opacity-50 pointer-events-none" },
        match(tone, { info: "bg-blue-50", danger: "bg-red-50" }),
        className,
      )}
    />
  );
}
```

</details>

<details>
<summary><strong>Vue</strong></summary>

```vue
<script setup lang="ts">
import { ss } from "tailess";
const props = defineProps<{ active: boolean }>();
</script>

<template>
  <div
    :class="ss(
      { base: 'rounded p-4', md: 'p-6', dark: { hover: 'bg-neutral-800' } },
      props.active && { base: 'ring-2' },
    )"
  >
    It's fine to write prose with apostrophes here.
  </div>
</template>
```

</details>

<details>
<summary><strong>Svelte</strong></summary>

```svelte
<script lang="ts">
  import { ss } from "tailess";
  let { active = false } = $props();
</script>

<div
  class={ss(
    { base: "rounded p-4", md: "p-6", dark: { hover: "bg-neutral-800" } },
    active && { base: "ring-2" },
  )}
>
  Let's go — apostrophes in markup are fine.
</div>
```

</details>

## Keys

`ss` accepts `base` plus Tailwind's own keys — **149 in total**, and nothing else, so
autocomplete is exhaustive and a typo can't compile. The same 149 are available inside a
nested group, which is how a compound variant is spelled.

| Group | Count | Keys |
| ----- | ----- | ---- |
| `base` | 1 | unprefixed classes |
| Breakpoints | 5 | `sm` `md` `lg` `xl` `2xl` |
| Max-width ranges | 5 | `max-sm` `max-md` `max-lg` `max-xl` `max-2xl` |
| Pseudo-classes | 34 | `hover` `focus` `focus-within` `focus-visible` `active` `visited` `target` `first` `last` `only` `odd` `even` `first-of-type` `last-of-type` `only-of-type` `empty` `disabled` `enabled` `checked` `indeterminate` `default` `optional` `required` `valid` `invalid` `user-valid` `user-invalid` `in-range` `out-of-range` `placeholder-shown` `autofill` `read-only` `open` `inert` |
| Pseudo-elements | 10 | `before` `after` `first-letter` `first-line` `marker` `selection` `file` `backdrop` `placeholder` `details-content` |
| Media & feature queries | 17 | `dark` `motion-safe` `motion-reduce` `contrast-more` `contrast-less` `forced-colors` `inverted-colors` `portrait` `landscape` `print` `noscript` `pointer-fine` `pointer-coarse` `pointer-none` `any-pointer-fine` `any-pointer-coarse` `any-pointer-none` |
| Direction & transition | 3 | `rtl` `ltr` `starting` |
| Descendants | 2 | `*` (direct children) `**` (all descendants) |
| `group-*` | 36 | parent state — `group-hover` `group-focus` `group-checked` `group-open` … |
| `peer-*` | 36 | sibling state — `peer-hover` `peer-checked` `peer-invalid` … |

Anything with a value of its own (`data-*`, `aria-*`, `supports-*`, `has-*`, `not-*`,
arbitrary `min-[…]`) is deliberately absent — use [`data`/`aria`](#data--aria--attribute-variants)
or [`withPrefix`](#withprefix--the-escape-hatch). The exact list is exported as
`stateKeys` and is regenerated and re-verified against the Tailwind compiler in CI.

## Plugin options

Both plugins take the same options (`cacheDir` is PostCSS-only).

```ts
tailess({
  content: ["src", "../ui/src"],   // files or dirs to scan
  ignore: ["fixtures"],            // extra dir names to skip
  extensions: ["tsx", "vue"],      // replaces the default list
  cacheDir: "node_modules/.cache", // PostCSS only
});
```

On Vite, a relative `content` path resolves against Vite's `root` — not the directory you
happened to run the command from — so `vite build apps/web` and monorepo task runners
behave the same as a plain `vite build`. On PostCSS there is no root, so paths resolve
against the working directory. A `content` that matches no files warns rather than
quietly producing a stylesheet with nothing in it.

| Option | Default |
| ------ | ------- |
| `content` | Vite's `root` / `process.cwd()` |
| `ignore` | added on top of the built-in list |
| `extensions` | `tsx ts mts cts jsx js mjs cjs mdx md html vue svelte astro` |
| `cacheDir` | `node_modules/.cache` (Vite uses its own `cacheDir`) |

By default the whole project is scanned, skipping dependencies, build output (`dist`,
`build`, `.next`, `.output`, …) and caches. Dot-directories are *not* skipped wholesale,
so `.storybook/preview.tsx` is still found.

## Performance

Measured on the built package, Node 22. Runtime numbers are per call, warm:

| | |
| --- | --- |
| `cn("px-2 py-1", …, "px-4")` | ~123 ns |
| `ss()` with 3 groups | ~385 ns |
| `ss()` with 8 groups | ~970 ns |
| Cold scan, 2,000-file project | ~98 ms |
| Warm rescan, same project | ~17 ms |

A single-map `ss({ … })` call takes a dedicated path with no argument loop, so it costs
what it did before variadic arguments existed — re-measured after that change and within
noise of the number above. Each further argument is one more map walk, a nested group
costs the same as a top-level one, and there is exactly one `tailwind-merge` pass per
call whatever the shape. Passing only class strings costs about what `cn` does.

### Bundle size

The badge at the top reads ~11.1 kB because it measures the whole dependency tree.
That number is real, but almost none of it is tailess:

| | min+gzip |
| --- | --- |
| `tailwind-merge` | ~8.3 kB |
| tailess itself | **~2.6 kB** |
| `clsx` | ~0.2 kB |
| **Total** | **~11.1 kB** |

`clsx` + `tailwind-merge` is what a `cn()` helper is in essentially every Tailwind
codebase, so if you already have one, adding tailess costs the 2.6 kB — not the 11.1.
If you don't, you're getting `cn()` in the same install.

About a fifth of tailess' own 2.6 kB is the text of its development-time warnings.
That text can't be dead-code-eliminated without either risking a crash when the package
is loaded unbundled or putting a `process.env` read on the render path; both were
measured and rejected, and the reasoning is in `src/internal/env.ts`.

The build plugin caches extraction per file by mtime and size, coalesces concurrent scans,
and only rewrites the sidecar when the class list actually changed — so an unrelated
keystroke costs a stat, not a re-parse.

## Troubleshooting

<details>
<summary><strong>My prefixed classes have no styles</strong></summary>

The plugin isn't running. In dev you'll see a console message naming the exact fix.
Check that `tailess/vite` is in `vite.config.ts`, or that `tailess/postcss` is listed
**before** `@tailwindcss/postcss` in `postcss.config.*` — listing it after means Tailwind
has already compiled, and the plugin says so in the build output.

On Vite with `@tailwindcss/vite`, `tailess/postcss` cannot work — use `tailess/vite`.

</details>

<details>
<summary><strong>One specific class has no styles</strong></summary>

It's almost certainly not a literal at the call site — see
[what the scanner can and cannot see](#what-the-scanner-can-and-cannot-see).

</details>

<details>
<summary><strong>I get the warning but my styles work</strong></summary>

Something else supplies the CSS (your own safelist, say). Declare the marker to silence it:

```css
:root { --tailess: 1; }
```

</details>

<details>
<summary><strong>My classes live outside the scanned root</strong></summary>

A monorepo package or shared UI folder — point `content` at it.

</details>

<details>
<summary><strong>How do I check for myself?</strong></summary>

Build, then search the output CSS with a fixed-string match, because Tailwind escapes `:`
in selectors — `md:text-2xl` is written `.md\:text-2xl`:

```bash
grep -rF 'md\:text-2xl' dist
```

A class starting with a digit is escaped further: `2xl:flex` becomes `.\32 xl\:flex`
(note the space).

</details>

## Verified on

The test suite runs the **real Tailwind compiler** over real fixture directories and
asserts the generated rules exist — the only assertion that actually fails when the
bridge breaks. It covers both plugins, the split-CSS-entry `@import` chain, the
add-a-class / delete-a-class dev cycle, the inline fallback path, and every one of the
149 keys.

| | |
| --- | --- |
| Tests | 298, across 23 files |
| Coverage | 95% statements, 90% branches |
| Tailwind | 4.3.3 |
| Manually verified | Vite 8 + `@tailwindcss/vite` 4, Next.js 16 (Turbopack and webpack) |

One suite is worth calling out. `test/extract/runtime-parity.test.ts` hands the scanner a
source string, then *evaluates that same string* with the real helpers, and asserts every
prefixed class the runtime produced is in the candidates the scanner found. The two halves
of the bridge are checked against each other rather than each against a hand-written list,
so they cannot drift apart in the one direction that matters.

CI additionally runs lint, typecheck, [`publint`](https://publint.dev) and
[`arethetypeswrong`](https://arethetypeswrong.github.io) on every push, and the release
workflow cannot publish unless all of them pass.

## FAQ

**Does this replace `clsx` / `tailwind-merge`?** No — it uses both. `cn` is exactly
`twMerge(clsx(...))`, so you can drop tailess into a codebase that already has one, and
those two make up most of the [bundle-size badge](#bundle-size).

**`ss` or `cn`?** `ss` does everything `cn` does, so either works. The habit worth having
is `cn` while a `className` is only plain strings, and `ss` the moment a breakpoint or a
state shows up — at which point everything, conditions included, moves inside the one
call.

**Do I have to migrate to nested groups?** No. `md: "p-6"` and `md: { base: "p-6" }` are
the same thing. Nesting is there for compound variants like `dark:hover:` and for
grouping a breakpoint's own states; a flat object stays perfectly idiomatic.

**Does it work without the plugin?** The unprefixed `base` classes and `match()` do,
because those are literals Tailwind finds by itself. Anything with a variant prefix
needs the plugin.

**Is there a runtime cost in production?** Only the string building above. The
integration check and every warning are dev-only and drop out of a production bundle.

**Tailwind v3?** No. v4's `@source inline(...)` is what makes the bridge possible.

**Does it work with a custom `@theme`?** Yes. Candidates go through Tailwind's own
pipeline, so your theme values resolve exactly as they do for classes written by hand.

## Contributing

Issues and PRs welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md).

```bash
npm install
npm test
npm run build
```

## License

[MIT](./LICENSE) © [user01101111000](https://github.com/user01101111000)
