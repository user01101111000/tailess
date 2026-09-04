<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./assets/hero-dark.svg">
  <img src="./assets/hero.svg" alt="tailess — write Tailwind classes as a readable object" width="840">
</picture>

<br>

<a href="https://www.npmjs.com/package/tailess"><img alt="npm version" src="https://img.shields.io/npm/v/tailess?style=flat-square&labelColor=0A0A0A&color=CB3837&logo=npm&logoColor=white&label=npm"></a>
<a href="https://www.npmjs.com/package/tailess"><img alt="downloads per month" src="https://img.shields.io/npm/dm/tailess?style=flat-square&labelColor=0A0A0A&color=F59E0B&label=downloads"></a>
<a href="https://bundlejs.com/?q=tailess"><img alt="bundle size" src="https://img.shields.io/bundlejs/size/tailess?style=flat-square&labelColor=0A0A0A&color=10B981&label=min%2Bgzip"></a>
<a href="https://github.com/user01101111000/tailess/actions/workflows/ci.yml"><img alt="CI status" src="https://img.shields.io/github/actions/workflow/status/user01101111000/tailess/ci.yml?style=flat-square&labelColor=0A0A0A&color=22C55E&logo=githubactions&logoColor=white&label=CI"></a>

<a href="#requirements"><img alt="Tailwind CSS v4" src="https://img.shields.io/badge/Tailwind_CSS-v4-38BDF8?style=flat-square&labelColor=0A0A0A&logo=tailwindcss&logoColor=white"></a>
<a href="#api"><img alt="TypeScript strict" src="https://img.shields.io/badge/TypeScript-strict-3178C6?style=flat-square&labelColor=0A0A0A&logo=typescript&logoColor=white"></a>
<a href="#keys"><img alt="233 typed keys" src="https://img.shields.io/badge/typed_keys-233-EC4899?style=flat-square&labelColor=0A0A0A"></a>
<a href="./LICENSE"><img alt="MIT license" src="https://img.shields.io/badge/license-MIT-8B5CF6?style=flat-square&labelColor=0A0A0A"></a>

</div>

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

## Contents

- [Features](#features)
- [Requirements](#requirements)
- [Install](#install)
- [Setup](#setup)
  - [Vite](#vite)
  - [Next.js](#nextjs)
  - [Other PostCSS setups](#other-postcss-setups)
- [Sorting classes](#sorting-classes)
- [API](#api)
  - [`ss` — group by breakpoint and state](#ss--group-by-breakpoint-and-state)
  - [`cn` — compose and merge](#cn--compose-and-merge)
  - [`responsive` — mobile-first](#responsive--mobile-first)
  - [`until` / `between` — max-width ranges](#until--between--max-width-ranges)
  - [`on` — state variants](#on--state-variants)
  - [`data` / `aria` — attribute variants](#data--aria--attribute-variants)
  - [`supports` / `notSupports` — feature queries](#supports--notsupports--feature-queries)
  - [`group` / `peer` / `container` — named variants](#group--peer--container--named-variants)
  - [`match` — exhaustive variant selection](#match--exhaustive-variant-selection)
  - [`withPrefix` — the escape hatch](#withprefix--the-escape-hatch)
  - [`vars` — values a class cannot carry](#vars--values-a-class-cannot-carry)
  - [Also exported](#also-exported)
- [Keys](#keys)
- [Framework examples](#framework-examples)
- [What the scanner can and cannot see](#what-the-scanner-can-and-cannot-see)
- [Build-time checks](#build-time-checks)
- [Plugin options](#plugin-options)
- [Performance](#performance)
  - [Bundle size](#bundle-size)
- [Troubleshooting](#troubleshooting)
- [FAQ](#faq)
- [Upgrading from 0.8](#upgrading-from-08)
- [Contributing](#contributing)
- [License](#license)

---

## Features

<table>
<tr>
<td width="50%" valign="top">

🎯 &nbsp;**Typed against Tailwind itself**

233 keys, every one verified against the real Tailwind compiler in CI.

</td>
<td width="50%" valign="top">

🔌 &nbsp;**One line of setup**

A Vite or PostCSS plugin. No config file, no CSS changes, nothing to commit.

</td>
</tr>
<tr>
<td valign="top">

🧯 &nbsp;**Tells you when it isn't wired up**

A dev-time check warns if the build plugin is missing, naming the line of config to add.

</td>
<td valign="top">

♻️ &nbsp;**Instant in dev**

Add a class and it appears without restarting; delete it and it stops being emitted.

</td>
</tr>
<tr>
<td valign="top">

🪶 &nbsp;**Small**

4.0 kB of its own code, one dependency, ESM + CJS, tree-shakeable.
[What the badge counts →](#bundle-size)

</td>
<td valign="top">

⚡ &nbsp;**Fast**

`ss()` with three groups costs ~385 ns, one `tailwind-merge` pass whatever the shape.

</td>
</tr>
</table>

---

## Requirements

| | |
| --- | --- |
| **Tailwind CSS** | v4 — v3 is not supported |
| **Node** | 18+ (build plugin only; the runtime has no Node dependency) |
| **Bundler** | anything using `@tailwindcss/vite` or `@tailwindcss/postcss` |
| **Dependencies** | one — `tailwind-merge`. [Why that one and no others](#bundle-size) |

## Install

```bash
npm install tailess
```

> [!TIP]
> Already have a `cn()` helper? `ss` is a strict superset of it — the same call with plain
> strings behaves identically, so you can swap one file at a time.

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

## Sorting classes

tailess sorts your *keys* — `base`, then breakpoints, then `max-*`, then states — but not
the classes inside them. For that, point Tailwind's own formatter at the helpers — in
`.prettierrc.json`:

```json
{
  "plugins": ["prettier-plugin-tailwindcss"],
  "tailwindStylesheet": "./src/index.css",
  "tailwindFunctions": [
    "ss", "cn", "responsive", "on", "until", "between",
    "data", "aria", "supports", "notSupports", "match", "withPrefix",
    "group", "peer", "container"
  ]
}
```

`tailwindStylesheet` is the CSS entry holding your `@import "tailwindcss"` — on Next.js
usually `./app/globals.css`. Leave it out and anything from your own `@theme` or
`@utility` is treated as an unknown class and sorted to the front.

```tsx
// before
ss({ base: "text-sm p-4 flex items-center", md: "gap-2 p-8 grid" })

// after
ss({ base: "flex items-center p-4 text-sm", md: "grid gap-2 p-8" })
```

Each string is sorted on its own. Separate arguments are never reordered, so a trailing
`className` still wins.

> [!NOTE]
> Two conflicting utilities in **one** string can be reordered — `"p-4 p-2"` becomes
> `"p-2 p-4"`, and `tailwind-merge` then keeps `p-4` where it kept `p-2`. Write the
> override as its own argument instead, which nothing reorders: `ss({ base: "p-4" }, "p-2")`.

---

## API

Every helper is a plain function. No factory, no instance, no config object.

```ts
import {
  ss, cn, responsive, on, until, between,
  data, aria, supports, notSupports, match, withPrefix, vars,
  group, peer, container,
} from "tailess";
```

| | | needs the plugin |
| --- | --- | :---: |
| [`ss`](#ss--group-by-breakpoint-and-state) | groups, composition, nesting — the whole `className` | ✅ |
| [`cn`](#cn--compose-and-merge) | join and merge, nothing else | — |
| [`responsive`](#responsive--mobile-first) | a base plus min-width overrides | ✅ |
| [`until`](#until--between--max-width-ranges) / [`between`](#until--between--max-width-ranges) | max-width ranges | ✅ |
| [`on`](#on--state-variants) | one state variant, or a stack of them | ✅ |
| [`data`](#data--aria--attribute-variants) / [`aria`](#data--aria--attribute-variants) | attribute variants, for headless UI | ✅ |
| [`supports`](#supports--notsupports--feature-queries) / [`notSupports`](#supports--notsupports--feature-queries) | feature queries, spaces escaped for you | ✅ |
| [`group`](#group--peer--container--named-variants) / [`peer`](#group--peer--container--named-variants) / [`container`](#group--peer--container--named-variants) | the *named* group, peer and container variants | ✅ |
| [`match`](#match--exhaustive-variant-selection) | exhaustive lookup by a discriminant | — |
| [`withPrefix`](#withprefix--the-escape-hatch) | any variant tailess doesn't model | ✅ |
| [`vars`](#vars--values-a-class-cannot-carry) | custom properties, for values no class can hold | — |

"Needs the plugin" means the helper builds a variant prefix at runtime, so Tailwind never
sees the finished class in your source. `cn` and `match` only ever pass through classes
you already wrote as literals, and `vars` produces no class at all.

### `ss` — group by breakpoint and state

The main event. `base` holds classes with no further prefix; every other key is a
breakpoint, a `max-*` range, a container query, or a state variant.

```ts
ss({ base: "text-xl flex", sm: "block", md: "text-2xl" });
// → "text-xl flex sm:block md:text-2xl"

ss({ base: "grid", "max-md": "gap-2", "group-hover": "underline" });
// → "grid max-md:gap-2 group-hover:underline"

// Sized by the nearest `@container` ancestor rather than the viewport:
ss({ base: "grid", "@md": "grid-cols-2", "@max-sm": "hidden" });
// → "grid @md:grid-cols-2 @max-sm:hidden"

ss({ base: "opacity-100", "not-hover": "opacity-70", "not-dark": "text-black" });
// → "opacity-100 not-hover:opacity-70 not-dark:text-black"
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

`clsx`-style conditional joining, then `tailwind-merge` for conflict resolution. `ss` is
a strict superset of it, so reach for `cn` when there are no breakpoints or states in
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

### `supports` / `notSupports` — feature queries

Apply classes only when the browser understands a CSS feature. Write the query the way
CSS spells it; the space is escaped for you.

```ts
supports("display: grid", "grid");     // → "supports-[display:_grid]:grid"
supports("gap", "gap-4");              // → "supports-[gap]:gap-4"
notSupports("display: grid", "flex");  // → "not-supports-[display:_grid]:flex"
```

A query with no `:` tests the property itself, so `supports("gap", …)` asks whether `gap`
is understood at all.

Combining queries needs every term in its own parentheses — `supports("(display:grid) and
(gap:1rem)", …)`. Without them the whole string becomes a single condition that is false
in every browser, so a missing pair warns in development. A *combined* query cannot be
negated, because `@supports not (a) and (b)` is not valid CSS; write
`supports("not ((a) and (b))", …)` instead.

### `group` / `peer` / `container` — named variants

The unnamed forms are already keys: `group-hover` and `peer-checked` are state variants,
`@md` and `@max-md` are container queries. They reach the *nearest* group, peer or
container — which stops being enough the moment those nest. Name the parent and these
target that one.

```ts
group("row", "hover", "underline");          // → "group-hover/row:underline"
peer("email", "invalid", "text-red-600");    // → "peer-invalid/email:text-red-600"
container("sidebar", "@md", "grid-cols-2");  // → "@md/sidebar:grid-cols-2"
container("main", "@max-lg", "hidden");      // → "@max-lg/main:hidden"
```

The name goes on the element you are naming, with the same `/` spelling:

```tsx
<li className="group/row">
  <span className={group("row", "hover", "underline")} />
</li>

<aside className="@container/sidebar">
  <div className={container("sidebar", "@md", "grid-cols-2")} />
</aside>
```

A `group` or `peer` name may contain letters, digits, `-` and `_`. Anything else — a
space, a `/`, a `:`, or an empty name — produces a class Tailwind generates no rule for.

A **container** name is stricter, because Tailwind also writes it into `container-name:`
and the `@container` prelude, where CSS requires an identifier: it cannot start with a
digit, and cannot be `none`, `and`, `or`, `not` or a CSS-wide keyword.
`container("2xl-panel", …)` compiles to CSS the browser then discards entirely.

Both are checked in development, so a name that cannot work says so.

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
withPrefix("nth-[3n+1]", "bg-neutral-50");      // → "nth-[3n+1]:bg-neutral-50"
withPrefix("has-[:checked]", "bg-blue-50");     // → "has-[:checked]:bg-blue-50"
withPrefix("group-[.open]", "rotate-90");       // → "group-[.open]:rotate-90"
withPrefix("in-[.dark]", "text-white");         // → "in-[.dark]:text-white"
```

### `vars` — values a class cannot carry

Every class tailess produces has to be enumerable at build time, so the values inside it
are written literally in your source. A width that comes from data is not, and
``w-[`${percent}%`]`` has no CSS behind it however it is built. Keep the class literal and
put the value in a custom property:

```tsx
<div
  className={ss({ base: "w-[var(--w)]", md: "w-[var(--w-md)]" })}
  style={vars({ "--w": `${percent}%`, "--w-md": "50%" })}
/>
```

Numbers are stringified, and `null`, `undefined` or `""` drops the property rather than
writing an invalid declaration — so a conditional variable reads like a conditional class.

```ts
vars({ "--w": "42%", "--gap": 8 });        // → { "--w": "42%", "--gap": "8" }
vars({ "--w": "42%", "--h": undefined });  // → { "--w": "42%" }
```

### Also exported

```ts
import { screens, screenKeys, maxScreenKeys, stateKeys } from "tailess";

window.matchMedia(`(min-width: ${screens.md})`).matches;  // "48rem"
```

Types: `SsInput`, `SsValue`, `SsArg`, `SsKey`, `ScreenKey`, `MaxScreenKey`, `StateKey`,
`ResponsiveMap`, `ClassValue`, `CssVars`, `CssVarInput`, `CssVarName`,
`AnyContainerKey`.

## Keys

`ss` accepts `base` plus Tailwind's own keys — **233 in total**, and nothing else, so
autocomplete is exhaustive and a typo can't compile. The same 233 are available inside a
nested group, which is how a compound variant is spelled.

| Group | # | Keys |
| :-- | --: | :-- |
| `base` | 1 | unprefixed classes |
| Breakpoints | 5 | `sm` `md` `lg` `xl` `2xl` |
| Max-width ranges | 5 | `max-sm` `max-md` `max-lg` `max-xl` `max-2xl` |
| Container queries | 13 | `@3xs` `@2xs` `@xs` `@sm` `@md` `@lg` `@xl` `@2xl` `@3xl` `@4xl` `@5xl` `@6xl` `@7xl` — sized by the nearest `@container`, not the viewport |
| Container ranges | 13 | `@max-3xs` … `@max-7xl` |
| Interaction & links | 7 | `hover` `focus` `focus-within` `focus-visible` `active` `visited` `target` |
| Position among siblings | 9 | `first` `last` `only` `odd` `even` `first-of-type` `last-of-type` `only-of-type` `empty` |
| Form & input state | 16 | `disabled` `enabled` `checked` `indeterminate` `default` `optional` `required` `valid` `invalid` `user-valid` `user-invalid` `in-range` `out-of-range` `placeholder-shown` `autofill` `read-only` |
| Element state | 2 | `open` `inert` |
| Pseudo-elements | 10 | `before` `after` `first-letter` `first-line` `marker` `selection` `file` `backdrop` `placeholder` `details-content` |
| Media & feature queries | 17 | `dark` `motion-safe` `motion-reduce` `contrast-more` `contrast-less` `forced-colors` `inverted-colors` `portrait` `landscape` `print` `noscript` `pointer-fine` `pointer-coarse` `pointer-none` `any-pointer-fine` `any-pointer-coarse` `any-pointer-none` |
| Direction & transition | 3 | `rtl` `ltr` `starting` |
| Descendants | 2 | `*` direct children · `**` all descendants |
| `group-*` | 36 | the element's own state — the four state rows plus `rtl`/`ltr` — matched on the **parent**: `group-hover`, `group-checked`, … |
| `peer-*` | 36 | the same 36, matched on a **sibling**: `peer-hover`, `peer-checked`, … |
| `not-*` | 58 | those same 36, plus every media query and breakpoint: `not-hover`, `not-dark`, `not-md`, … |

Anything with a value of its own (`data-*`, `aria-*`, `supports-*`, `has-*`, `in-*`,
`nth-*`, arbitrary `min-[…]`) is deliberately absent — use
[`data`/`aria`](#data--aria--attribute-variants),
[`supports`](#supports--notsupports--feature-queries),
[`group`/`peer`/`container`](#group--peer--container--named-variants) for the named
forms, or [`withPrefix`](#withprefix--the-escape-hatch). The exact list is exported as
`stateKeys` and is regenerated and re-verified against the Tailwind compiler in CI.

The breakpoint keys are Tailwind's five defaults. A `@theme` of your own can add to them,
remove them or move them, and none of that reaches the type — so the plugin reads your CSS
and [says so at build time](#build-time-checks). A breakpoint you added is reachable as
`withPrefix("3xl", …)`.

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

---

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
ss({ md: [{ "text-lg": cond }] })                   // clsx dictionaries, quoted…
until("md", { hidden: !open })                      // …or not
ss({ md: "text-lg", /* both survive */ lg: "xl" })  // comments anywhere
ss({ dark: { hover: "bg-black" } })                 // nesting — dark:hover:bg-black
ss(a, cond && { sm: "bg-red-500" })                 // a map behind a condition
ss(a, open ? { md: "p-6" } : { md: "p-2" })         // both branches, as maps
ss({ md: withPrefix("has-[:x]", "underline") })     // a helper inside a group stacks
on(["dark", "hover"], "bg-black")                   // compound variants
data("state", open ? "open" : "closed", "p-2")      // both values
data("level", 2, "p-2")                             // numbers and booleans
supports("display: grid", "grid")                   // the space is escaped for you
group("row", "hover", "underline")                  // group-hover/row:underline
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

When the value is genuinely continuous — a percentage, a pixel count — there is no set of
literals to write. Keep the class literal and move the value into a custom property with
[`vars`](#vars--values-a-class-cannot-carry).

Scanned by default: `tsx ts mts cts jsx js mjs cjs mdx md html vue svelte astro`.
Markup files work the same as JS ones — an apostrophe in your prose or a `:class="…"`
attribute won't throw the scanner off.

## Build-time checks

The plugin reports what it can prove wrong from your source, while the project builds:

```
[tailess] src/Card.tsx: "p-4" never reaches the element — "p-2" replaces it in the same
  string. Drop the unused one, or move the override into its own argument.
[tailess] src/Card.tsx: between("lg", "sm", …) describes an empty range: "lg" is not
  narrower than "sm", so "lg:max-sm:" can never match a viewport.
[tailess] src/app.css: your theme removes the "sm" breakpoint, but tailess still offers
  it as a key — ss({ "sm": … }) compiles, emits "sm:", and no rule is generated for it.
```

Six things are checked: two conflicting utilities in **one** string, a `between` range no
viewport can satisfy, an empty prefix, whitespace inside a variant, a feature query no
class name can carry, and a `@theme` that moves the breakpoints out from under the keys.
Each is a class that cannot work — nothing is reported for code that merely looks
unusual, and a later argument overriding an earlier one is never flagged, since that is
the point of passing `className` last.

The last one is the only check that reads your **CSS** rather than your source, and the
only one with a case that is *informational* rather than broken. The breakpoint keys are
compiled into the package, so `--breakpoint-sm: initial` leaves `ss({ sm: … })` compiling
and emitting a class nothing generates a rule for, `--breakpoint-md: 50rem` leaves
`screens.md` returning the old width to your JS, and the resets `--breakpoint-*: initial`
and `--*: initial` do the first of those to every breakpoint at once. Adding one is
reported too — that CSS works, so this is the exception to the rule above, and it is
there because the compile error you get from `ss({ "3xl": … })` says nothing about
`withPrefix("3xl", …)`, which does.

A `@config` pointing at a v3-style JS config can set `theme.screens` as well. That is a
JavaScript file this never opens, so a project on `@config` gets no answer here rather
than a wrong one.

The runtime warns about most of these too, but only once the line renders, in a browser,
with the console open. A branch that did not run during development ships either way —
these run on every build, for every call site, and show up in CI. They warn; they never
fail the build.

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
against the working directory.

`content` takes directories and files — **not globs**. `"src"` scans everything under
it, so `"src/**/*.tsx"` is both unnecessary and inert. A `content` that matches no files
warns rather than quietly producing a stylesheet with nothing in it.

| Option | Default |
| ------ | ------- |
| `content` | Vite's `root` / `process.cwd()` |
| `ignore` | added on top of the built-in list |
| `extensions` | `tsx ts mts cts jsx js mjs cjs mdx md html vue svelte astro` |
| `cacheDir` | `node_modules/.cache` (Vite uses its own `cacheDir`) |

By default the whole project is scanned, skipping dependencies, build output (`dist`,
`build`, `.next`, `.output`, …) and caches. Dot-directories are *not* skipped wholesale,
so `.storybook/preview.tsx` is still found.

---

## Performance

Measured on the built package, Node 22. Runtime numbers are per call, warm:

| | |
| --- | --- |
| `cn("px-2 py-1", …, "px-4")` | ~123 ns |
| `ss()` with 3 groups | ~385 ns |
| `ss()` with 8 groups | ~970 ns |
| Cold scan, 2,000-file project | ~98 ms |
| Warm rescan, same project | ~17 ms |

### Bundle size

The badge at the top reads **12.4 kB** because it measures the whole dependency tree.
That number is real, but almost none of it is tailess:

| | min+gzip |
| --- | --- |
| `tailwind-merge` | ~8.4 kB |
| tailess itself | **~4.0 kB** |
| **Total** | **~12.4 kB** |

`tailwind-merge` is the one runtime dependency, and it is what a `cn()` helper is built
on in essentially every Tailwind codebase — roughly two thirds of Tailwind installs
already pull it in. If yours is one of them your bundler keeps the single shared copy,
and adding tailess costs the 4.0 kB, not the 12.4.

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
<summary><strong>Nothing is scanned, and <code>content</code> looks right</strong></summary>

`content` takes directories and files, not globs. `content: ["src/**/*.tsx"]` matches
nothing; `content: ["src"]` scans the whole tree, which is what the glob was reaching
for. The plugin warns when `content` matches no files and names the wildcard case.

</details>

<details>
<summary><strong>New classes only appear after I restart the dev server</strong></summary>

Update to the latest patch. An `extensions` list written with leading dots or in upper
case (`[".tsx"]`, `["TSX"]`) used to gate the watcher against a different spelling than
the scan itself used, so the first build was correct and nothing after it was.

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

## FAQ

**Does this replace `clsx` / `tailwind-merge`?** `cn` behaves exactly like the
`twMerge(clsx(...))` helper nearly every Tailwind codebase already has, so tailess drops
straight into one. `tailwind-merge` is a real dependency and does the merging;
the `clsx` half is tailess' own forty-line equivalent, so it is not one.

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

## Upgrading from 0.8

Two things changed, and **TypeScript catches both** — neither can turn into a style that
quietly stops appearing. Everything else is untouched: every existing `ss({ … })` call,
`cn`, and all seven other helpers behave exactly as before.

**1. A `clsx` dictionary as a bucket value now goes in an array,** because a bare object
is a nested map:

```ts
ss({ md: { "text-lg": cond } })      // 0.8
ss({ md: [{ "text-lg": cond }] })    // 0.9
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

---

## Contributing

Issues and PRs welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md).

```bash
npm install
npm test
npm run build
```

## License

[MIT](./LICENSE) © [user01101111000](https://github.com/user01101111000)

<br>

<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./assets/wordmark-dark.svg">
  <img src="./assets/wordmark.svg" alt="tailess" width="150">
</picture>

<br>

[npm](https://www.npmjs.com/package/tailess) · [Issues](https://github.com/user01101111000/tailess/issues) · [Contributing](./CONTRIBUTING.md) · [Changelog](./CHANGELOG.md)

</div>
