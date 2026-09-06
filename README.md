<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./assets/hero-dark.svg">
  <img src="./assets/hero.svg" alt="tailess — write Tailwind classes as a readable object" width="840">
</picture>

<br>

<a href="https://www.npmjs.com/package/tailess"><img alt="npm version" src="https://img.shields.io/npm/v/tailess?style=flat-square&labelColor=0A0A0A&color=CB3837&logo=npm&logoColor=white&label=npm"></a>
<a href="https://www.npmjs.com/package/tailess"><img alt="downloads per month" src="https://img.shields.io/npm/dm/tailess?style=flat-square&labelColor=0A0A0A&color=F59E0B&label=downloads"></a>
<a href="https://github.com/user01101111000/tailess/actions/workflows/ci.yml"><img alt="CI status" src="https://img.shields.io/github/actions/workflow/status/user01101111000/tailess/ci.yml?style=flat-square&labelColor=0A0A0A&color=22C55E&logo=githubactions&logoColor=white&label=CI"></a>

<a href="#requirements"><img alt="Tailwind CSS v4" src="https://img.shields.io/badge/Tailwind_CSS-v4-38BDF8?style=flat-square&labelColor=0A0A0A&logo=tailwindcss&logoColor=white"></a>
<a href="#api"><img alt="TypeScript strict" src="https://img.shields.io/badge/TypeScript-strict-3178C6?style=flat-square&labelColor=0A0A0A&logo=typescript&logoColor=white"></a>
<a href="#keys"><img alt="305 typed keys" src="https://img.shields.io/badge/typed_keys-305-EC4899?style=flat-square&labelColor=0A0A0A"></a>
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
- [Editor setup](#editor-setup)
- [API](#api)
  - [`ss` — group by breakpoint and state](#ss--group-by-breakpoint-and-state)
  - [`cn` — compose and merge](#cn--compose-and-merge)
  - [`responsive` — mobile-first](#responsive--mobile-first)
  - [`until` / `between` — max-width ranges](#until--between--max-width-ranges)
  - [`on` — state variants](#on--state-variants)
  - [`data` / `aria` — attribute variants](#data--aria--attribute-variants)
  - [`supports` / `notSupports` — feature queries](#supports--notsupports--feature-queries)
  - [`group` / `peer` / `container` — named variants](#group--peer--container--named-variants)
  - [`has` / `notHas` / `inside` — selector variants](#has--nothas--inside--selector-variants)
  - [`nth` — position variants](#nth--position-variants)
  - [`match` — exhaustive variant selection](#match--exhaustive-variant-selection)
  - [`variants` — component recipes](#variants--component-recipes)
    - [`slots` — a component with named parts](#slots--a-component-with-named-parts)
    - [`extend` — building on another recipe](#extend--building-on-another-recipe)
    - [Coming from cva or tailwind-variants](#coming-from-cva-or-tailwind-variants)
  - [`withPrefix` — the escape hatch](#withprefix--the-escape-hatch)
  - [`vars` — values a class cannot carry](#vars--values-a-class-cannot-carry)
  - [`configure` — the two things that depend on your project](#configure--the-two-things-that-depend-on-your-project)
  - [Keys your own CSS adds](#keys-your-own-css-adds)
  - [Also exported](#also-exported)
- [Keys](#keys)
- [Framework examples](#framework-examples)
- [What the scanner can and cannot see](#what-the-scanner-can-and-cannot-see)
- [Build-time checks](#build-time-checks)
- [Checking your build](#checking-your-build)
- [`tailess/build` — the scanner, as a library](#tailessbuild--the-scanner-as-a-library)
- [`tailess emit` — the stylesheet, as a file](#tailess-emit--the-stylesheet-as-a-file)
- [Plugin options](#plugin-options)
- [Performance](#performance)
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

305 keys, every one verified against the real Tailwind compiler in CI.

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

🔍 &nbsp;**Provable**

`tailess check` compiles your project and fails the build if a class has no CSS behind it.

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
| **Bundler** | anything using `@tailwindcss/vite` or `@tailwindcss/postcss` — anything else via [`tailess emit`](#tailess-emit--the-stylesheet-as-a-file) |
| **Dependencies** | one — `tailwind-merge` |

## Install

```bash
npm install tailess
```

A runnable app is in [`examples/vite-react`](./examples/vite-react) — Vite + React, every
class built at runtime, with `npm run verify` wired to the gate. CI builds it on every
push, and asserts the gate goes red when the plugin is removed.

> [!TIP]
> Already have a `cn()` helper? `ss` is a strict superset of it — the same call with plain
> strings behaves identically, so you can swap one file at a time.

## Setup

Add one line to the config file you already have for Tailwind. There is no
`tailess.config`, nothing to add to your CSS, and no generated file to commit.

```bash
npx tailess init          # shows the edit it would make
npx tailess init --write  # makes it
npx tailess doctor        # says whether the plugin is wired up, and exits 1 if not
```

`init` reads your project, picks the right integration, and writes the edit — after
printing it. `doctor` is the same reading without the edit, and is worth a CI step: a
missing plugin is the one failure nothing else reports, because the build succeeds and
the class attributes are correct while nothing on the page has styles.

Or do it by hand — it is one line either way.

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
    "ss", "cn", "variants", "responsive", "match",
    "on", "until", "between", "data", "aria",
    "group", "peer", "container", "withPrefix"
  ]
}
```

`tailwindStylesheet` is the CSS entry holding your `@import "tailwindcss"` — on Next.js
usually `./app/globals.css`. Leave it out and anything from your own `@theme` or
`@utility` is treated as an unknown class and sorted to the front.

> [!WARNING]
> Do **not** add `supports`, `notSupports`, `has`, `notHas`, `inside` or the `nth*`
> helpers to that list. The plugin sorts *every* string argument of a listed function,
> and the first argument of those is a selector or a feature query, not a class list.
> It reorders that too: `has("table [data-open]", …)` is rewritten to
> `has("[data-open] table", …)` — Tailwind knows `table` as a utility and `[data-open]`
> as unknown, so it moves them — and the selector now means the opposite of what it
> said. Format-on-save does it silently. Their class arguments go unsorted; that is the
> trade, and it is the right way round.

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

## Editor setup

Tailwind's VS Code extension recognises `class` and `className` out of the box — not the
strings inside `ss({ … })`. Without this, moving a `className` into a bucket costs you
class-name completion, colour swatches, hover previews and the unknown-class warning,
which is the only thing catching a typo *inside* a class string. tailess types the keys;
this is what types the values.

`.vscode/settings.json`:

```json
{
  "tailwindCSS.classFunctions": [
    "ss", "cn", "variants", "responsive", "match",
    "on", "until", "between", "data", "aria",
    "group", "peer", "container", "withPrefix",
    "supports", "notSupports", "has", "notHas", "inside",
    "nth", "nthLast", "nthOfType", "nthLastOfType"
  ]
}
```

Unlike the prettier list above, this one is safe to give *every* helper: the extension
reads, it never rewrites. Commit the file so the whole team gets it.

If completions do not appear in some shape, `tailwindCSS.experimental.classRegex` is the
escape hatch — it matches on surrounding text where `classFunctions` matches only on the
function name.

---

## API

Every helper is a plain function. No factory, no instance, no config object.

```ts
import {
  ss, cn, responsive, on, until, between,
  data, aria, supports, notSupports, match, withPrefix, vars,
  group, peer, container, has, notHas, inside,
  nth, nthLast, nthOfType, nthLastOfType, variants,
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
| [`has`](#has--nothas--inside--selector-variants) / [`notHas`](#has--nothas--inside--selector-variants) / [`inside`](#has--nothas--inside--selector-variants) | `has-[…]` and `in-[…]` from a selector | ✅ |
| [`nth`](#nth--position-variants) and its three siblings | `:nth-child()` and friends, by position or expression | ✅ |
| [`match`](#match--exhaustive-variant-selection) | exhaustive lookup by a discriminant | — |
| [`variants`](#variants--component-recipes) | a component recipe, with `ss` maps as options | ✅ |
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

### `has` / `notHas` / `inside` — selector variants

For a plain state these are **keys**, not calls: `has-checked` and `in-focus` cover the
same 36 states `group-*` and `peer-*` do, so write those in `ss` directly. These helpers
are for the other form — an arbitrary selector.

```ts
has(":checked", "bg-blue-50");        // → "has-[:checked]:bg-blue-50"
has("> img", "p-0");                  // → "has-[>_img]:p-0"
has("input[type=text]", "ring-2");    // → "has-[input[type=text]]:ring-2"
notHas(":checked", "opacity-50");     // → "not-has-[:checked]:opacity-50"
inside(".dark", "text-white");        // → "in-[.dark]:text-white"
```

Write the selector the way CSS spells it; the space is escaped for you. `inside` is named
that way because `in` is a reserved word.

Mind which negation you want. `notHas(":checked", …)` builds `not-has-[:checked]:`, which
is `:not(:has(…))` — *no* checked descendant. Tailwind also accepts `has-not-[:checked]`,
which is `:has(:not(…))` — a descendant that is *not* checked. Both compile and they mean
different things; for the second, write `has(":not(:checked)", …)`.

### `nth` — position variants

A number is a position, counting from 1. A string is an `An+B` expression or a keyword,
and goes in brackets — spaces and all, since they are escaped for you.

```ts
nth(3, "bg-neutral-50");        // → "nth-3:bg-neutral-50"
nth("3n + 1", "border-t");      // → "nth-[3n_+_1]:border-t"
nth("-n+3", "font-bold");       // → "nth-[-n+3]:font-bold"
nthLast(1, "border-b-0");       // → "nth-last-1:border-b-0"
nthOfType("odd", "bg-white");   // → "nth-of-type-[odd]:bg-white"
nthLastOfType(1, "mb-0");       // → "nth-last-of-type-1:mb-0"
```

`odd` and `even` are their own variants and already keys, so reach for those directly:
`ss({ odd: "bg-neutral-50" })`.

`:nth-child()` counts from 1, so `nth(0, …)` builds a class that can never match — that,
a fraction, and a negative number all warn in development.

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

### `variants` — component recipes

A component's `className` built from typed variants, with `defaults` and compound rules.
The familiar shape, with one difference: every value is an `ss` argument, so **a variant
option can be an `ss` map** and carry breakpoints and states of its own.

```ts
const button = variants({
  base: { base: "rounded font-medium", hover: "brightness-110" },
  variants: {
    tone: { primary: "bg-blue-600", danger: "bg-red-600" },
    size: { sm: "text-sm px-2", lg: { base: "text-lg px-4", md: "px-6" } },
  },
  compound: [{ tone: "danger", size: "lg", class: "ring-2" }],
  defaults: { tone: "primary", size: "sm" },
});

button();                              // → the defaults
button({ size: "lg" });                // → "… text-lg px-4 md:px-6"
button({ tone: "danger" }, className); // extra arguments, exactly like cn
```

Both halves of `{ size: "lg" }` are checked: a variant you did not declare and an option
that variant does not have are each a compile error.

Emission is `base`, then each variant in the order you declared it, then the compound
rules, then whatever the caller passed — so a trailing `className` still wins, and the
same props always produce the same string. The whole thing ends in `ss`, so conflicts
merge once, across all of it.

`{ size: undefined }` leaves the default in place, which is what a component writes when
it forwards an optional prop it did not receive.

`VariantProps` reads the prop type back off the component, so a component declares its
own props against the recipe rather than restating it:

```tsx
type ButtonProps = VariantProps<typeof button> & { children: ReactNode };

const Button = ({ tone, size, children }: ButtonProps) => (
  <button className={button({ tone, size })}>{children}</button>
);
```

#### `slots` — a component with named parts

A Dialog is root, overlay, panel, title and close. Declare the parts instead of `base`,
and every option says what it adds to each one. The call returns a class string per part:

```tsx
const card = variants({
  slots: {
    root:  { base: "rounded-lg border", dark: "border-neutral-800" },
    title: "font-semibold",
    body:  "text-sm",
  },
  variants: {
    size: {
      sm: { root: "p-3", title: "text-base" },
      lg: { root: { base: "p-5", md: "p-8" }, title: "text-xl" },
    },
    tone: { danger: { root: "border-red-500", title: "text-red-700" } },
  },
  compound: [{ size: "lg", tone: "danger", class: { root: "ring-2" } }],
  defaults: { size: "sm" },
});

const { root, title, body } = card({ size: "lg" });
```

A slot's value is an `SsArg` like anywhere else, so a part can carry its own breakpoints.
Each part merges **on its own**, so an override on `root` cannot disturb `title`. Extra
classes come in as a second argument, keyed by part:

```tsx
card({ size: "lg" }, { root: className })
```

#### `extend` — building on another recipe

```ts
const brand = variants({
  extend: button,
  base: "font-medium",
  variants: { tone: { brand: "bg-violet-600" } },
  defaults: { tone: "brand" },
});

brand({ tone: "danger" });   // still there — merging is per *option*, not per group
```

The parent's base, variants, compounds and defaults come first; anything declared here
wins. Merging per option is what lets a product package add one `tone` to a design
system's button without forking it. Types merge too, so `VariantProps<typeof brand>`
includes the inherited options. Slotted recipes extend the same way, gaining parts.

#### Coming from `cva` or `tailwind-variants`

Same shape, and the renamed keys are accepted as aliases — so a port is `cva(` ->
`variants(` and nothing else. Every line below is verified against the current build.

| `cva` / `tv` | tailess | |
| --- | --- | --- |
| `variants` | `variants` | unchanged |
| `defaultVariants` | `defaults` | |
| `compoundVariants` | `compound` | |
| `class` / `className` in a compound rule | `class` | no `className` alias |
| `cva("base", { … })` | `variants("base", { … })` | the same call shape; `base` also works as a config key |
| `button({ tone: "danger", class: "mt-2" })` | `button({ tone: "danger" }, "mt-2")` | extra classes are a second argument, like `cn` |
| `VariantProps<typeof button>` | `VariantProps<typeof button>` | unchanged |
| `slots` | `slots` | returns a record of strings, not slot functions |
| `extend` | `extend` | merges per option, so an inherited one is not dropped |
| `{ intent: ["a", "b"] }` in a compound | same | |
| `disabled?: boolean` | same | |

```diff
- import { cva } from "class-variance-authority";
+ import { variants } from "tailess";

- const button = cva("rounded", {
+ const button = variants("rounded", {
    variants: { tone: { … }, size: { … } },
    compoundVariants: [{ tone: "danger", className: "ring-2" }],
    defaultVariants: { tone: "primary" },
  });
```

That is the whole port — the renamed keys are accepted as written and the call shape is
the same, which is why there is no codemod to run.

**What you gain.** A variant option can be an `ss` map, so it carries its own breakpoints
and states — `lg: { base: "text-lg px-4", md: "px-6" }`, which a flat string cannot say.
Everything ends in one `ss` call, so `tailwind-merge` runs once across base, variants,
compounds and the caller's `className` together.

**What is deliberately absent.** Responsive variant selection at the call site —
`size={{ base: "sm", md: "lg" }}` — is not supported and will not be: the scanner reads
your *recipe*, never the call sites of the component it builds, so it would have to
enumerate every option under all thirteen breakpoints or let the class land with no CSS.
Put the breakpoints inside the option instead (`lg: { base: "text-lg", md: "px-6" }`),
which is statically knowable and is the shape this is built around.

**Boolean variants take a boolean**, the same as in `cva` and `tv` — the option keys are
the strings `"true"`/`"false"`, and both spellings are accepted:

```tsx
const box = variants({ variants: { disabled: { true: "opacity-50", false: "opacity-100" } } });
box({ disabled: isDisabled });   // forward the prop you already have
```

### `withPrefix` — the escape hatch

For variants tailess doesn't model as keys: an arbitrary variant, an arbitrary
`group-*`/`peer-*` modifier, or one a plugin or your own `@custom-variant` defines.

```ts
withPrefix("[&>li]", "border-b");               // → "[&>li]:border-b"
withPrefix("group-[.open]", "rotate-90");       // → "group-[.open]:rotate-90"
withPrefix("peer-[.is-invalid]", "text-red-600");
withPrefix("sidebar-open", "translate-x-0");    // a @custom-variant of your own
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

### `configure` — the two things that depend on your project

```ts
// entry.ts, before anything renders
import { configure } from "tailess";
import { extendTailwindMerge } from "tailwind-merge";

configure({
  merge: extendTailwindMerge({ extend: { classGroups: { "font-size": ["text-hero"] } } }),
  onWarn: process.env.CI ? (m) => { throw new Error(m); } : undefined,
  keys: ["3xl", "sidebar-open"],
});
```

**`merge`** is how conflicting classes are resolved, `twMerge` by default.
`tailwind-merge` only knows Tailwind's own utilities, so a project with its own
`@utility` or theme scale needs `extendTailwindMerge` — without it `cn("text-sm",
"text-hero")` emits both and the winner is decided by CSS source order rather than by
argument order, which is the one guarantee `cn` makes. Pass `(classes) => classes` to
skip merging entirely.

**`onWarn`** is where a development warning goes, `console.warn` by default. Throw to
make them fatal in CI, collect to assert on them in a test, or pass `() => {}` to
silence them. Each warning is reported once per process, so passing `onWarn` also clears
that history — otherwise a collector set up after the code under test had already warned
would stay empty and the assertion would pass without asserting anything.

**`keys`** is the runtime half of the next section.

The settings are **process-global**: one of each per module instance, and the last call
wins for every render already in flight. That is why it belongs at module scope of your
entry. Calling it per request — or per tenant in a shared SSR process — is not supported;
two requests configuring different `merge` functions produce wrong output for one of
them, with no error.

### Keys your own CSS adds

The built-in keys are a closed union on purpose — that is what makes a typo a compile
error rather than an unstyled element. But a `@theme` that adds `--breakpoint-3xl`, or a
`@custom-variant sidebar-open`, creates a variant that genuinely works and that tailess
cannot know about. [Declare it](#build-time-checks) and it joins the union:

```ts
// tailess.d.ts, anywhere your tsconfig includes
declare module "tailess" {
  interface CustomKeys {
    "3xl": true;
    "sidebar-open": true;
  }
}
```

```ts
ss({ md: "p-6", "3xl": "p-12", "sidebar-open": "translate-x-0" });
```

Name them in `configure({ keys: [...] })` too, or the runtime — which cannot see a type —
goes on calling them unknown on every render. Declared keys are emitted after the
built-in ones, in the order given: Tailwind's ordering has no place for them, and a
stable position is what `tailwind-merge` needs.

### Also exported

```ts
import { screens, screenKeys, maxScreenKeys, containerKeys, maxContainerKeys, stateKeys } from "tailess";

screens.md;                                               // "48rem"
window.matchMedia(`(min-width: ${screens.md})`).matches;  // true above 768px
```

Every exported type, grouped by what it is for. A test holds this list to what
`src/index.ts` actually exports, so it cannot fall behind.

| | |
| --- | --- |
| **`ss` itself** | `SsInput` `SsValue` `SsArg` `SsKey` `ClassValue` `ResponsiveMap` |
| **Key families** — for a `Record<…>` keyed by one | `ScreenKey` `MaxScreenKey` `ContainerKey` `MaxContainerKey` `AnyContainerKey` `StateKey` `ElementStateKey` `StandaloneStateKey` `GroupStateKey` `PeerStateKey` `HasStateKey` `InStateKey` `NotStateKey` `NegatableStateKey` |
| **Recipes** | `VariantProps` `VariantsConfig` `VariantComponent` `VariantGroups` `VariantOptions` `CompoundRule` `SlotDefaults` `SlotValue` `SlottedConfig` `SlottedComponent` `SlottedGroups` |
| **The rest** | `NthValue` `CssVars` `CssVarInput` `CssVarName` `CustomKeys` `TailessSettings` `ConfigureOptions` |

The plugin option types are on their own entries: `TailessViteOptions` from
`tailess/vite`, `TailessPostcssOptions` from `tailess/postcss`, and `CollectOptions`,
`CollectResult`, `FileDiagnostic`, `Diagnostic`, `DiagnosticMode`, `BreakpointDecl` and
`CollectedTheme` from [`tailess/build`](#tailessbuild--the-scanner-as-a-library).

## Keys

`ss` accepts `base` plus Tailwind's own keys — **305 in total**, and nothing else, so
autocomplete is exhaustive and a typo can't compile. The same 305 are available inside a
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
| `has-*` | 36 | the same 36, matched on a **descendant**: `has-checked`, `has-focus`, … |
| `in-*` | 36 | the same 36, matched on an **ancestor**: `in-focus`, `in-hover`, … |
| `not-*` | 58 | those same 36, plus every media query and breakpoint: `not-hover`, `not-dark`, `not-md`, … |

Anything with a value of its own (`data-*`, `aria-*`, `supports-[…]`, `has-[…]`,
`in-[…]`, arbitrary `min-[…]`) is deliberately absent — use
[`data`/`aria`](#data--aria--attribute-variants),
[`supports`](#supports--notsupports--feature-queries),
[`has`/`notHas`/`inside`](#has--nothas--inside--selector-variants),
[`group`/`peer`/`container`](#group--peer--container--named-variants) for the named
forms, [`nth`](#nth--position-variants) for positions, or
[`withPrefix`](#withprefix--the-escape-hatch). The exact list is exported as
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
ss({ md: "p-4", /* both survive */ lg: "p-6" })     // comments anywhere
ss({ dark: { hover: "bg-black" } })                 // nesting — dark:hover:bg-black
ss(a, cond && { sm: "bg-red-500" })                 // a map behind a condition
ss(a, open ? { md: "p-6" } : { md: "p-2" })         // both branches, as maps
ss({ md: withPrefix("has-[:x]", "underline") })     // a helper inside a group stacks
on(["dark", "hover"], "bg-black")                   // compound variants
data("state", open ? "open" : "closed", "p-2")      // both values
data("level", 2, "p-2")                             // numbers and booleans
supports("display: grid", "grid")                   // the space is escaped for you
group("row", "hover", "underline")                  // group-hover/row:underline
has("> img", "p-0")                                 // the space is escaped for you
nth(open ? 3 : 4, "bg-neutral-50")                  // a number, or an expression
variants({ variants: { s: { lg: { md: "p-6" } } } }) // only the leaves are classes
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

Eleven things are checked: two conflicting utilities in **one** string, a `between` range
no viewport can satisfy, an empty prefix, whitespace inside a variant, an arbitrary value
no class name can carry — a `supports` query, a `has`/`inside` selector, an `nth`
position — a helper imported under another name, an `ss` map handed to a helper
that takes a flat class value, a prefixed bucket whose value the scanner cannot read, CSS
that moves the variants out from under the keys, and CSS that imports Tailwind with a
`prefix(…)`.
Each is a class that cannot work — nothing is reported for code that merely looks
unusual, and a later argument overriding an earlier one is never flagged, since that is
the point of passing `className` last.

**A renamed import** is the widest of them. The scanner finds calls by identifier, so
`import { ss as tw } from "tailess"` is one line that removes every class in that file
from the candidate list — while the file compiles, type-checks and renders exactly the
`class` attribute you wrote. Renaming `cn` or `match` is free; renaming a helper that
builds a variant prefix is not, and that is what this reports.

**A bucket the scanner cannot read** is the package's most common support case, and the
type system cannot express any of it — `ss({ md: size })` is perfectly well typed and
completely unstyled. Everything the
[scanner cannot see](#what-the-scanner-can-and-cannot-see) under a *prefixed* key is
reported by name:

```ts
ss({ md: size })                 // ❌ reported
ss({ md: `text-${scale}` })      // ❌ reported
ss({ base: size })               // ✅ no prefix, so Tailwind finds the literal itself
ss({ md: cond && "p-4" })        // ✅ the sweep reads both halves
```

**An `ss` map in the wrong place.** Composition runs one way — a helper nests *inside*
an `ss` bucket, never the reverse. Every helper's class argument is a `ClassValue`, where
an object is a `clsx` dictionary (`until("md", { hidden: !open })` is the documented
shape), so an `ss` map handed to one is read as a dictionary and its **keys** become the
classes: `on("hover", { base: "underline", md: "font-bold" })` builds
`"hover:base hover:md"`. The types refuse it, so this only fires where a cast or an
untyped boundary let it through — and there it is completely silent.

```ts
ss({ md: on("hover", "underline") })      // ✅ this way round — "md:hover:underline"
on("hover", { base: "underline" })        // ❌ "hover:base"
```

**A Tailwind `prefix(…)`** is the one failure that is total rather than local.
`@import "tailwindcss" prefix(tw)` makes the working class `tw:hover:underline`, and
tailess builds `hover:underline` — so nothing on the page has styles. tailess does not
support a Tailwind prefix; the check exists so you find that out from your build rather
than from a blank screen.

The last one is the only check that reads your **CSS** rather than your source, and the
only one with cases that are *informational* rather than broken. The breakpoint keys are
compiled into the package, so `--breakpoint-sm: initial` leaves `ss({ sm: … })` compiling
and emitting a class nothing generates a rule for, `--breakpoint-md: 50rem` leaves
`screens.md` returning the old width to your JS, and the resets `--breakpoint-*: initial`
and `--*: initial` do the first of those to every breakpoint at once. Adding one is
reported too — that CSS works, so this is the exception to the rule above, and it is
there because the compile error you get from `ss({ "3xl": … })` says nothing about
`withPrefix("3xl", …)`, which does — or [declare the key](#keys-your-own-css-adds) and
use it like any other.

`@custom-variant` is read the same way. Defining one gives you a variant that works —
`midnight:bg-black` — but no key, so `ss({ midnight: … })` will not compile; the warning
names `withPrefix("midnight", …)`, which does — [declaring it](#keys-your-own-css-adds)
is the other answer. Redefining a name that *is* a key is not
reported: Tailwind just replaces the variant and the key still resolves.

A `@config` pointing at a v3-style JS config can set `theme.screens` and add variants of
its own. That is a JavaScript file this never opens, so one anywhere in your stylesheet
chain silences this check entirely — no answer rather than a wrong one.

The runtime warns about most of these too, but only once the line renders, in a browser,
with the console open. A branch that did not run during development ships either way —
these run on every build, for every call site, and show up in CI. They warn; they never
fail the build — [`tailess check`](#checking-your-build) is the one that does.

## Checking your build

The plugin guarantees the *bridge*: it enumerates the classes tailess builds at runtime
and hands them to Tailwind. It cannot guarantee the far end — that Tailwind generated a
rule for each one. A `@theme` that dropped a breakpoint, a `@config` this deliberately
stays quiet about, or an arbitrary value Tailwind rejects all leave the bridge intact and
the element unstyled.

`tailess check` compiles your project for real and looks:

```bash
npx tailess check
```

```
[tailess] 1 of 3 runtime-built classes reach the element with no rule behind them:

  md:p-4
    "p-4" resolves on its own, so the variant is what fails.
```

It exits `1` when something is wrong, so it can gate a build:

```yaml
- run: npx tailess check
```

| | |
| --- | --- |
| `--content <dir>` | where your source lives. Repeatable, or comma-separated. Defaults to the working directory. |
| `--css <file>` | your Tailwind entry stylesheet. Found automatically when it sits inside a `--content` root. |
| `--extensions <list>` | file extensions to scan, **replacing** the default list. |
| `--ignore <list>` | extra directory names to skip. |
| `--strict` | also fail on the [build-time checks](#build-time-checks), which are otherwise printed without affecting the exit code. |
| `--max <n>` | how many broken classes to name before summarising. Default `20`; `0` lists them all. |
| `--json` | print one JSON object instead of prose. |
| `--version` | |

> [!IMPORTANT]
> Give `--extensions` and `--ignore` the same values as the [plugin](#plugin-options), or
> the gate reads a different set of files than your build does — a project scanning
> `["tsx", "vue"]` has a build enumerating two extensions and a gate reading thirteen.
> Wrong in both directions, and silently.

Every finding names the file it came from, and `--json` gives a CI job something to read:

```json
{
  "tailess": 1, "command": "check", "ok": false, "code": 1,
  "checked": 312, "files": 84, "stylesheets": ["src/app.css"],
  "broken": [{ "class": "md:p-4", "utility": "p-4", "files": ["src/Card.tsx"] }],
  "diagnostics": [{ "kind": "dead-class", "file": "src/Row.tsx", "message": "…" }]
}
```

| Exit | Meaning |
| ---: | --- |
| `0` | every runtime-built class has a rule — or the scan ran and found no tailess calls |
| `1` | a class reaches the element with no rule behind it |
| `2` | nothing could be checked: no entry stylesheet, no files scanned, or a bad option |

`2` is the one worth wiring an alert to. It means the gate did not run, which in CI looks
nothing like a failure but proves exactly as much: a `--content` typo, a task runner in
the wrong directory, or a glob where a directory was expected all land here rather than
passing quietly. When the scan does find files but no tailess calls, the exit is `0` and
the line says how many files it read, so the two are distinguishable in a log.

It also prints the build-time checks it computes on the way past. Those are the failures
compiling *cannot* find — a class carrying an unusable value never reaches Tailwind to be
found missing — so `--strict` is what makes one gate cover both.

The scanner over-approximates on purpose, so most of what it produces is not a class at
all. Rather than demand a rule for every candidate — which would report all of that — the
check asks whether the *utility inside* each class resolves on its own first. `p-4` works
and `md:p-4` does not, so something between the two is broken; `md:state` has no working
half, so it was never a class and is not reported.

It uses your Tailwind, resolved from your tree, and loads your `@plugin`s and `@config`
the way Tailwind itself does — so a variant or utility that only exists because of a
plugin counts as generated rather than missing.

## `tailess/build` — the scanner, as a library

Everything here that is not the runtime rests on one question — *which classes can this
source build at runtime?* — and the two plugins and the binary were the only ways to ask.
A webpack or rspack loader, an esbuild plugin, an Astro or Nuxt module, an editor
extension, a lint rule, your own CI script: all of them need the same answer.

```ts
import { collect, buildPrelude, diagnose, themeDiagnostics } from "tailess/build";

const { classes, files, diagnostics } = await collect({ roots: ["src"] });
const css = buildPrelude(classes);   // the @source inline(...) Tailwind needs
```

It is Node-only — it walks the file system — which is why it is a subpath rather than
part of `tailess` itself: the runtime pulls in no Node types at all, and that stays true.
Also exported: `extractClasses`, `isTailwindEntry`, `tailwindPrefixIn`, `collectTheme`,
`reportDiagnostics`, `hasRule`, `selectorFor`, `defaultExtensions`, `defaultIgnore`.

## `tailess emit` — the stylesheet, as a file

The plugins hand Tailwind the class list in memory. `tailess emit` writes exactly the
same thing to a file you `@import` yourself:

```bash
npx tailess emit --content src --out src/tailess.css
```

```css
/* src/app.css */
@import "tailwindcss";
@import "./tailess.css";     /* the classes tailess builds at runtime */
```

It takes the same `--content`, `--extensions` and `--ignore` as the check, and writes to
stdout when given no `--out`. Two things need it.

**A host with no PostCSS chain.** The plugins cover Vite and anything with a
`postcss.config`. Tailwind's own CLI, Rspack's native CSS pipeline, Bun's bundler and the
standalone binary compile Tailwind without ever running one — so run `emit` in the same
script that builds your CSS:

```json
{
  "scripts": {
    "css": "tailess emit --content src --out src/tailess.css && tailwindcss -i src/app.css -o dist/app.css"
  }
}
```

**Publishing a component library.** A consumer's scan skips `node_modules`, and even
pointed at your package it would be reading a bundled `dist` where the helper names are
gone. So enumerate the classes at *your* build time and ship the result:

```json
{
  "scripts": { "build": "tsup && tailess emit --content src --out dist/tailess.css" },
  "files": ["dist"],
  "exports": { ".": "./dist/index.js", "./styles.css": "./dist/tailess.css" }
}
```

Your consumer adds one line, and needs neither the plugin nor a scan of your source:

```css
@import "tailwindcss";
@import "@acme/ui/styles.css";
```

The file is deterministic — same source, same bytes — so it diffs cleanly and caches.

## Plugin options

Both plugins take the same four options:

```ts
tailess({
  content: ["src", "../ui/src"],  // files or dirs to scan
  ignore: ["fixtures"],           // extra dir names to skip
  extensions: ["tsx", "vue"],     // replaces the default list
  diagnostics: "error",           // "warn" (default) | "error" | "off"
});
```

`diagnostics` is what the build does about the [checks](#build-time-checks) the scanner
can prove from your source. `"warn"` prints and keeps going, which is right in dev — a
dead class should not stop you seeing the rest of the page. `"error"` prints the whole
list and then fails, which is right in CI, where a warning about an unstyled element is
an unstyled element that ships:

```ts
tailess({ diagnostics: process.env.CI ? "error" : "warn" })
```

The PostCSS plugin takes one more, `cacheDir`, since it has no host to borrow one
from — on Vite it is not an option at all, and Vite's own `cacheDir` is used.

```js
// postcss.config.mjs
export default {
  plugins: { "tailess/postcss": { cacheDir: "node_modules/.cache" }, "@tailwindcss/postcss": {} },
};
```

On Vite, a relative `content` path resolves against Vite's `root` — not the directory you
happened to run the command from — so `vite build apps/web` and monorepo task runners
behave the same as a plain `vite build`. On PostCSS there is no root, so paths resolve
against the working directory.

Note which way round those two go. `ignore` **adds** to the built-in list and matches a
bare directory *name* wherever it appears in the tree, so it cannot un-ignore
`node_modules` and cannot be scoped to one path. `extensions` **replaces** the default
list, so "the defaults plus one" means writing the whole list out — it is in the table
above, and `tailess check --extensions` takes the same one:

```ts
tailess({
  extensions: "tsx ts mts cts jsx js mjs cjs mdx md html vue svelte astro erb".split(" "),
})
```

`content` takes directories and files — **not globs**. `"src"` scans everything under
it, so `"src/**/*.tsx"` is both unnecessary and inert. A `content` that matches no files
warns rather than quietly producing a stylesheet with nothing in it.

| Option | Default |
| ------ | ------- |
| `content` | Vite's `root` / `process.cwd()` |
| `ignore` | **added to** the built-in list — a directory name, matched anywhere in the tree |
| `extensions` | **replaces** `tsx ts mts cts jsx js mjs cjs mdx md html vue svelte astro` |
| `diagnostics` | `"warn"` |
| `cacheDir` | `node_modules/.cache` (Vite uses its own `cacheDir`) — PostCSS only |

By default the whole project is scanned, skipping dependencies, build output (`dist`,
`build`, `.next`, `.output`, …) and caches. Dot-directories are *not* skipped wholesale,
so `.storybook/preview.tsx` is still found.

---

## Performance

Reproduce these yourself — they come from a script in the repository, not from memory:

```bash
npm run build && npm run bench
```

| | |
| --- | --- |
| `cn("px-2 py-1", …, "px-4")` | ~53 ns |
| `ss()` with 3 groups | ~244 ns |
| `ss()` with 8 groups | ~592 ns |
| Cold scan, 2,000-file project | ~287 ms |
| Warm rescan, same project | ~52 ms |

Measured on the **built** package — `src/` through a transform is a different program —
on Node 24, Windows, one middling laptop. The absolute numbers will differ on yours; the
two worth reading are the shapes. Runtime cost is per call and warm, because
`tailwind-merge` keeps its own cache and a rendering app never pays the cold price twice.
The scanner's warm rescan is what a dev server does on every keystroke, and it is ~5×
faster than the cold one because the per-file cache is keyed on mtime and size.

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

**Is there a runtime cost in production?** Only the string building above. Every
warning and the integration check sit behind `process.env.NODE_ENV !== "production"`,
so none of them runs. The message *text* still ships: the guard is written to survive
a bundler that leaves `process` undefined, and that is what keeps a minifier from
folding it away.

**Is `ss()` memoized?** No, and it would not help. `tailwind-merge` keeps its own LRU
cache, so the expensive half is already cached across calls. What is left is the object
walk — and in React the object is built fresh on every render, so nothing an identity or
string key could match survives to the next one. A cache there would cost a key and never
hit.

**Can it export my theme's colours and spacing the way it exports `screens`?** No.
`screens` is compiled in because the breakpoint *keys* are a closed union the compiler
checks and `matchMedia` needs the widths — nothing else has that justification, and a
second copy of your theme in JS is a copy that drifts from your CSS. Read a theme value
the way CSS does: `var(--color-brand)`, with [`vars`](#vars--values-a-class-cannot-carry)
when the value comes from data. Tailwind's own defaults are in
`tailwindcss/defaultTheme` if you want them.

**Could the plugin fold a static call into a literal at build time?** In principle yes —
for a call site with no conditions the answer is already known while the project builds,
and a large list would stop re-running `ss` per row. It is not built: it means rewriting
your JavaScript rather than only adding CSS, which is a much larger promise than the one
this package makes today.

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
