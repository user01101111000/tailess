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
- 🪶 **Tiny** — 2.4 kB min+gzip, ESM + CJS, tree-shakeable. Only `clsx` and `tailwind-merge`.
- ⚡ **Fast** — `ss()` with three groups costs ~385 ns.

## Contents

- [Requirements](#requirements)
- [Install](#install)
- [Setup](#setup) · [Vite](#vite) · [Next.js](#nextjs) · [Other PostCSS setups](#other-postcss-setups)
- [How it works](#how-it-works)
- [What the scanner can and cannot see](#what-the-scanner-can-and-cannot-see)
- [API](#api)
- [Framework examples](#framework-examples)
- [Keys](#keys)
- [Plugin options](#plugin-options)
- [Performance](#performance)
- [Troubleshooting](#troubleshooting)
- [Verified on](#verified-on)
- [FAQ](#faq)
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
runs before Tailwind wherever you put it.

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
ss({ md: { "text-lg": cond } })                     // clsx object form
ss({ md: "text-lg", /* both survive */ lg: "xl" })  // comments anywhere
on(["dark", "hover"], "bg-black")                   // compound variants
data("state", open ? "open" : "closed", "p-2")      // both values
```

❌ **Not seen** — the value isn't in the source to read:

```tsx
const size = "text-2xl";
ss({ md: size });                    // a variable
ss({ md: `text-${scale}` });         // an interpolated template
ss({ ...spread });                   // a spread
withPrefix(dynamicPrefix, "grid");   // a computed prefix
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

### `ss` — group by breakpoint and state

The main event. `base` holds unprefixed classes; every other key is a breakpoint, a
`max-*` range, or a state variant.

```ts
ss({ base: "text-xl flex", sm: "block", md: "text-2xl" });
// → "text-xl flex sm:block md:text-2xl"

ss({ base: "grid", "max-md": "gap-2", "group-hover": "underline" });
// → "grid max-md:gap-2 group-hover:underline"
```

Output order is always `base` → breakpoints mobile-first → `max-*` largest-first →
states, **whatever order you wrote the keys in**, and the result runs through
[`cn`](#cn--compose-and-merge). Stable order is what keeps `tailwind-merge`'s
"last one wins" predictable.

Values are `clsx`-style, so conditions go inline. A falsy value drops the whole group,
prefix included:

```ts
ss({ base: "text-sm", md: isActive && "text-2xl" });
// isActive === false → "text-sm"
```

### `cn` — compose and merge

`clsx` for conditional joining, `tailwind-merge` for conflict resolution.

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

Types: `SsInput`, `SsKey`, `ScreenKey`, `MaxScreenKey`, `StateKey`, `ResponsiveMap`,
`ClassValue`.

## Framework examples

<details open>
<summary><strong>React</strong></summary>

```tsx
import { cn, ss, match, on } from "tailess";

export function Card({ tone, wide }: { tone: "info" | "danger"; wide: boolean }) {
  return (
    <div
      className={cn(
        ss({
          base: "rounded-lg border p-4",
          md: wide && "p-6",
          dark: "border-neutral-800",
          hover: "shadow-md",
        }),
        match(tone, { info: "bg-blue-50", danger: "bg-red-50" }),
        on("focus-visible", "ring-2 ring-offset-2"),
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
  <div :class="ss({ base: 'rounded p-4', md: 'p-6', hover: 'shadow-md' })">
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

<div class={ss({ base: "rounded p-4", md: "p-6", hover: "shadow-md" })}>
  Let's go — apostrophes in markup are fine.
</div>
```

</details>

## Keys

`ss` accepts `base` plus Tailwind's own keys — **149 in total**, and nothing else, so
autocomplete is exhaustive and a typo can't compile.

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
| Runtime entry, min+gzip | **2.4 kB** (excl. `clsx` + `tailwind-merge`) |
| Cold scan, 2,000-file project | ~98 ms |
| Warm rescan, same project | ~17 ms |

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
| Tests | 241, across 22 files |
| Coverage | 95% statements, 90% branches |
| Tailwind | 4.3.3 |
| Manually verified | `create-vite` + `@tailwindcss/vite`, `create-next-app` (Turbopack and webpack) |

CI additionally runs lint, typecheck, [`publint`](https://publint.dev) and
[`arethetypeswrong`](https://arethetypeswrong.github.io) on every push, and the release
workflow cannot publish unless all of them pass.

## FAQ

**Does this replace `clsx` / `tailwind-merge`?** No — it uses both. `cn` is exactly
`twMerge(clsx(...))`, so you can drop tailess into a codebase that already has one.

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
