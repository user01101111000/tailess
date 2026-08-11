<p align="center">
  <img src="./assets/logo.svg" alt="tailess logo" width="120" height="120">
</p>

<h1 align="center">tailess</h1>

<p align="center"><strong>Write Tailwind classes as a readable object, grouped by breakpoint and state.</strong></p>

<p align="center">
  <a href="https://www.npmjs.com/package/tailess"><img src="https://img.shields.io/npm/v/tailess.svg" alt="npm version"></a>
  <a href="https://bundlejs.com/?q=tailess"><img src="https://img.shields.io/bundlejs/size/tailess" alt="bundle size"></a>
  <a href="https://github.com/user01101111000/tailess/actions/workflows/ci.yml"><img src="https://github.com/user01101111000/tailess/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="license"></a>
</p>

A long Tailwind `className` is hard to read: base classes, breakpoints and states all
interleaved in one string. `tailess` lets you group them in an object instead — every
key autocompleted, every typo a compile error.

```tsx
// ❌ everything jumbled together
<div className="text-xl flex sm:block md:text-2xl hover:opacity-100 dark:bg-black" />

// ✅ grouped and readable
<div className={ss({
  base: "text-xl flex",
  sm: "block",
  md: "text-2xl",
  hover: "opacity-100",
  dark: "bg-black",
})} />
```

- 🎯 **Typed against Tailwind itself** — its own breakpoints and state variants autocomplete inside `ss({ … })`, and every key is verified against the Tailwind compiler in CI.
- 🔌 **One line of setup** — a Vite or PostCSS plugin. It is **required**, and [there is a reason](#why-the-plugin-is-required) it can't be avoided.
- 🧯 **No silent failures** — forget the plugin and you get a console message naming the fix, not unstyled elements.
- ♻️ **Instant in dev** — a class you add shows up without restarting the dev server; a class you delete stops being emitted.
- 🪶 **Tiny** — ESM + CJS, tree-shakeable, `sideEffects: false`. Only `clsx` + `tailwind-merge`.

## Contents

- [Requirements](#requirements)
- [Install](#install)
- [Setup](#setup)
  - [Vite](#vite)
  - [Next.js](#nextjs)
  - [Why the plugin is required](#why-the-plugin-is-required)
  - [What the scanner can and cannot see](#what-the-scanner-can-and-cannot-see)
  - [Troubleshooting](#troubleshooting)
- [API](#api)
  - [`ss` — group by breakpoint/state](#ss--group-by-breakpointstate)
  - [`cn` — compose & merge](#cn--compose--merge)
  - [`responsive` — mobile-first](#responsive--mobile-first)
  - [`until` / `between` — max-width ranges](#until--between--max-width-ranges)
  - [`on` — state variants](#on--state-variants)
  - [`data` / `aria` — attribute variants](#data--aria--attribute-variants)
  - [`match` — variant selection](#match--variant-selection)
  - [`withPrefix` — anything else](#withprefix--anything-else)
- [Keys](#keys)
- [Plugin options](#plugin-options)
- [API reference](#api-reference)
- [Verified on](#verified-on)
- [License](#license)

## Requirements

- **Tailwind CSS v4** — v3 is not supported.
- **Node 18+** for the build plugin.
- A bundler with either the Tailwind Vite plugin (`@tailwindcss/vite`) or the Tailwind
  PostCSS plugin (`@tailwindcss/postcss`). Both are covered below.

## Install

```bash
npm install tailess
```

## Setup

Install, then add one line to the config file you already have for Tailwind. There is
no `tailess.config` file, nothing to add to your CSS, and no generated file to commit.

### Vite

React, Vue, Svelte, Solid, Astro — anything on Vite.

```ts
// vite.config.ts
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import tailess from "tailess/vite";

export default defineConfig({
  plugins: [tailwindcss(), tailess()],
});
```

Position in the array doesn't matter — the hook is registered `order: "pre"`, so it
always runs before Tailwind wherever you put it.

> **Using Tailwind through PostCSS in Vite?** If you have a `postcss.config.*` with
> `@tailwindcss/postcss` instead of `@tailwindcss/vite`, use the PostCSS plugin below.
> Don't use `tailess/postcss` together with `@tailwindcss/vite`: Tailwind compiles CSS
> before Vite's PostCSS stage, so a PostCSS plugin can never reach it.

### Next.js

Add the plugin to the `postcss.config.mjs` that `create-next-app` already generated,
**before** `@tailwindcss/postcss`:

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

Works with both Turbopack and webpack, in `dev` and `build`. The same file works for
any other PostCSS-based setup (Remix, Astro-with-PostCSS, plain PostCSS CLI, …).

That's the whole setup. Import a helper anywhere and go:

```tsx
import { ss } from "tailess";
```

### Why the plugin is required

Tailwind v4 generates CSS by scanning your source for **literal** class strings.
`tailess` builds variant prefixes by concatenation at runtime, so
`ss({ md: "text-2xl" })` only becomes `"md:text-2xl"` *when the code runs*. That full
class never appears in any file, so Tailwind never sees it and emits no CSS for it.
(Unprefixed classes like `text-xl` do appear literally, so those always work — which is
exactly why the failure is confusing: some of your classes work and some don't.)

So the choice is between the object syntax and zero setup; you can't have both. The
plugin is what buys the syntax: on every build it scans your source, enumerates the
classes `tailess` can produce, and hands them to Tailwind through its own
[`@source inline(...)`](https://tailwindcss.com/docs/functions-and-directives#source)
safelist — the same pipeline as classes found in your source, so variants and theme
values resolve identically.

The list is written to a small generated stylesheet under `node_modules` which your
entry `@import`s, and your source files are registered as build dependencies. Together
those are what make dev instant: Tailwind only re-reads a safelist when a file it
tracks changes, and that generated stylesheet is such a file.

Your entry is found automatically, including when Tailwind is imported one level down:

```css
/* app.css — this works too */
@import "./styles/tailwind.css";   /* which contains @import "tailwindcss"; */
```

Stylesheets Tailwind doesn't emit utilities into — plain CSS, partials, `@reference`d
CSS modules — are left completely untouched.

### What the scanner can and cannot see

The scanner reads *literal* strings, and deliberately over-approximates: it emits every
branch, since any of them may run.

```tsx
ss({ md: isActive ? "text-2xl" : "text-xs" })   // ✅ both emitted
ss({ md: isActive && "text-2xl" })              // ✅
ss({ md: { "text-2xl": a, "text-xs": b } })     // ✅ both
ss({ lg: ["gap-4", a && "grid-cols-3"] })       // ✅ both
```

It cannot recover a class that isn't written down anywhere:

```tsx
ss({ md: size })                 // ✗ a variable
ss({ md: `text-${size}` })       // ✗ an interpolated template
ss({ ...shared })                // ✗ a spread
import { ss as sx } from "tailess"; // ✗ renamed on import, so the call isn't recognised
```

This is the one case that still fails quietly, so prefer keeping classes literal —
[`match`](#match--variant-selection) exists for exactly this, since all of its classes
are literal:

```tsx
// ✗ invisible to the scanner        // ✅ visible
ss({ md: `text-${size}` })           match(size, { sm: "text-sm", lg: "text-lg" })
```

Otherwise, add the class to a Tailwind `@source inline(...)` safelist in your CSS
yourself.

### Troubleshooting

**None of my `md:` / `hover:` classes have any CSS.** The plugin isn't running. Check
that it's registered (above), that on PostCSS it comes **before**
`@tailwindcss/postcss`, and that you're using `tailess/vite` — not `tailess/postcss` —
with `@tailwindcss/vite`. In development the console also tells you this directly.

**One specific class has no CSS, the rest are fine.** Its value almost certainly isn't
a literal string — see [above](#what-the-scanner-can-and-cannot-see).

**I get the console warning but my styles do work.** Something else is supplying the
CSS (your own safelist, for instance). Declare the marker yourself to silence it:

```css
:root { --tailess: 1; }
```

**My classes live outside the scanned root** (a monorepo package, a shared UI folder).
Point `content` at them — see [Plugin options](#plugin-options).

**How do I check for myself?** Build, then look for the class in the output CSS. Use a
fixed-string search (`-F`), because Tailwind escapes `:` in selectors — `md:text-2xl` is
written `.md\:text-2xl`:

```bash
grep -rF 'md\:text-2xl' dist
```

A class starting with a digit is escaped further still: `2xl:flex` becomes
`.\32 xl\:flex` (note the space), so search for `\32 xl\:flex`.

## API

Every helper is a plain function import. No factory, no instance, no config object.

```ts
import { ss, cn, responsive, on, until, between, match, data, aria, withPrefix } from "tailess";
```

### `ss` — group by breakpoint/state

The main event. `base` holds unprefixed classes; every other key is a Tailwind
breakpoint, a `max-*` range, or a state variant.

```ts
ss({ base: "text-xl flex", sm: "block", md: "text-2xl" });
// => "text-xl flex sm:block md:text-2xl"

ss({ base: "opacity-0", hover: "opacity-100", dark: "bg-black" });
// => "opacity-0 hover:opacity-100 dark:bg-black"

ss({ base: "grid", "max-md": "gap-2", "group-hover": "underline" });
// => "grid max-md:gap-2 group-hover:underline"
```

Output order is always `base` → breakpoints mobile-first → `max-*` largest-first →
states, whatever order you wrote the keys in, and the result runs through
[`cn`](#cn--compose--merge).

Every value is a `clsx`-style `ClassValue`, so conditions go inline. A bucket whose
value is falsy is dropped entirely, prefix and all:

```ts
ss({ base: "text-sm", md: isActive && "text-2xl", lg: disabled && "hidden" });
// isActive => "text-sm md:text-2xl"

ss({ base: ["flex", isActive && "bg-blue-500"], md: { "text-2xl": isActive } });
// => "flex bg-blue-500 md:text-2xl"
```

### `cn` — compose & merge

`clsx` for conditional joining plus `tailwind-merge` for conflict resolution, so the
last utility in a conflicting group wins.

```ts
cn("px-2 py-1", isActive && "bg-blue-500", "px-4");
// => "py-1 bg-blue-500 px-4"   (px-2 dropped in favor of px-4)
```

### `responsive` — mobile-first

A base value plus per-breakpoint (min-width) overrides.

```ts
responsive("text-sm", { md: "text-lg", xl: "text-2xl" });
// => "text-sm md:text-lg xl:text-2xl"
```

### `until` / `between` — max-width ranges

The complement of `responsive`. `until` applies classes *below* a breakpoint;
`between` applies them within a range (inclusive `min`, exclusive `max`).

```ts
until("md", "hidden");           // => "max-md:hidden"
between("sm", "lg", "block");    // => "sm:max-lg:block"
```

### `on` — state variants

Prefix classes with one or more state variants. An array stacks them into a compound
variant.

```ts
on("hover", "bg-blue-600 text-white");   // => "hover:bg-blue-600 hover:text-white"
on(["dark", "hover"], "bg-black");       // => "dark:hover:bg-black"
```

### `data` / `aria` — attribute variants

For headless UI libraries (Radix, Ark, React Aria). `data` builds
`data-[name=value]:`, or the presence form `data-[name]:` when the value is
`null`/`undefined`.

```ts
data("state", "open", "opacity-100");              // => "data-[state=open]:opacity-100"
data("disabled", null, "pointer-events-none");     // => "data-[disabled]:pointer-events-none"
aria("expanded", "rotate-180");                    // => "aria-expanded:rotate-180"
```

### `match` — variant selection

Map a discriminant (a variant prop, size, tone…) to a class value. Every possible value
of the key must be covered, so a missing case is a compile error. Extra cases are fine.

```ts
function Button({ size }: { size: "sm" | "md" | "lg" }) {
  const sizing = match(size, {
    sm: "px-2 py-1 text-sm",
    md: "px-3 py-2 text-base",
    lg: "px-4 py-3 text-lg",
  });
  // omitting a size is a compile-time error
}

match(tone, { primary: "bg-blue-600", danger: "bg-red-600" }, "bg-gray-200");
// unknown tone at runtime => "bg-gray-200"
```

### `withPrefix` — anything else

The escape hatch for variants tailess doesn't model as keys — arbitrary selectors,
`supports-*`, `has-*`, compound `group-[...]`:

```ts
withPrefix("supports-[display:grid]", "grid");  // => "supports-[display:grid]:grid"
withPrefix("has-[:checked]", "bg-blue-50");     // => "has-[:checked]:bg-blue-50"
```

## Keys

`ss` accepts `base` plus Tailwind's built-in keys — nothing else, so autocomplete is
exhaustive and a typo can't compile:

| Group | Keys |
| ----- | ---- |
| Breakpoints | `sm` `md` `lg` `xl` `2xl` |
| Max-width ranges | `max-sm` `max-md` `max-lg` `max-xl` `max-2xl` |
| Pseudo-classes | `hover` `focus` `focus-within` `focus-visible` `active` `visited` `target` `first` `last` `only` `odd` `even` `first-of-type` `last-of-type` `only-of-type` `empty` `disabled` `enabled` `checked` `indeterminate` `default` `optional` `required` `valid` `invalid` `user-valid` `user-invalid` `in-range` `out-of-range` `placeholder-shown` `details-content` `autofill` `read-only` |
| Pseudo-elements | `before` `after` `first-letter` `first-line` `marker` `selection` `file` `backdrop` `placeholder` |
| Media & features | `dark` `motion-safe` `motion-reduce` `contrast-more` `contrast-less` `forced-colors` `inverted-colors` `portrait` `landscape` `print` `noscript` `pointer-fine` `pointer-coarse` `pointer-none` `any-pointer-fine` `any-pointer-coarse` `any-pointer-none` |
| Direction & state | `rtl` `ltr` `open` `inert` `starting` |
| `group-*` | `group-hover` `group-focus` `group-focus-within` `group-focus-visible` `group-active` `group-disabled` `group-checked` `group-open` `group-first` `group-last` `group-odd` `group-even` |
| `peer-*` | `peer-hover` `peer-focus` `peer-focus-within` `peer-focus-visible` `peer-active` `peer-disabled` `peer-checked` `peer-open` `peer-invalid` `peer-required` `peer-placeholder-shown` |

Every one of these is compiled by real Tailwind in the test suite, so an autocompleted
key always resolves to a real variant. Anything outside the list goes through
[`withPrefix`](#withprefix--anything-else).

> **Custom breakpoints and state aliases are not supported in this version.** For an
> extra breakpoint, define it in your CSS `@theme` and use
> `withPrefix("3xl", "text-2xl")` plus your own `@source inline(...)` entry.

## Plugin options

Everything is optional. Both plugins share `content`, `ignore` and `extensions`:

```ts
tailess({
  content: ["./src"],      // dirs/files to scan
  ignore: ["fixtures"],    // extra directory names to skip
  extensions: ["tsx"],     // file extensions to scan, without the dot
});
```

| Option | Default | Notes |
| ------ | ------- | ----- |
| `content` | Vite's `root` / `process.cwd()` | Narrow this in a monorepo, or point it at packages outside the project root. |
| `ignore` | — | Added on top of the built-in list. |
| `extensions` | `tsx ts mts cts jsx js mjs cjs mdx md html vue svelte astro` | Replaces the default list. |
| `cacheDir` | `node_modules/.cache` | **PostCSS plugin only.** Where the generated stylesheet goes. The Vite plugin uses Vite's own `cacheDir` (`node_modules/.vite`). |

By default the whole project is scanned, skipping dependencies, build output (`dist`,
`build`, `out`, `.next`, `.output`, …) and caches. Dot-directories are *not* skipped
wholesale, so classes in something like `.storybook/preview.tsx` are still found.
Scanning is cached per file by mtime — a warm rescan of a 2,000-file project takes
about 20 ms.

## API reference

| Export | Signature | Description |
| ------ | --------- | ----------- |
| `ss` | `(input: SsInput) => string` | Group classes by breakpoint/state in a readable object. |
| `cn` | `(...inputs: ClassValue[]) => string` | Join classes (`clsx`) and resolve Tailwind conflicts (`tailwind-merge`). |
| `responsive` | `(base, variants?) => string` | Mobile-first string from a breakpoint→classes map. |
| `until` | `(key, classes) => string` | Apply classes below a breakpoint (`max-*`). |
| `between` | `(min, max, classes) => string` | Apply classes between two breakpoints. |
| `on` | `(state \| state[], classes) => string` | Prefix classes with one or more state variants. |
| `data` | `(name, value \| null, classes) => string` | Prefix classes with a `data-*` variant. |
| `aria` | `(name, classes) => string` | Prefix classes with an `aria-*` variant. |
| `match` | `(key, options, fallback?) => string` | Pick a class from an exhaustive lookup. |
| `withPrefix` | `(prefix, classes) => string` | Apply an arbitrary variant prefix to every token. |
| `screens` | `Record<ScreenKey, string>` | Breakpoint → min-width, e.g. for `matchMedia`. |
| `screenKeys` / `maxScreenKeys` / `stateKeys` | `readonly string[]` | The key sets above, at runtime. |

Types: `SsInput`, `SsKey`, `ScreenKey`, `MaxScreenKey`, `StateKey`, `ResponsiveMap`,
`ClassValue`. Entry points: `tailess`, `tailess/vite`, `tailess/postcss`.

## Verified on

Every setup below is checked by building a real project from the official scaffolder
and asserting the generated CSS actually contains the rules — including adding and
removing a class while the dev server runs, from a cold start:

| Setup | Integration | Build | Dev + live edit |
| ----- | ----------- | ----- | --------------- |
| `create-vite` (react-ts, Vite 8) + `@tailwindcss/vite` | `tailess/vite` | ✅ | ✅ |
| `create-next-app` (TypeScript, Next 16) + Turbopack | `tailess/postcss` | ✅ | ✅ |
| `create-next-app` (TypeScript, Next 16) + webpack | `tailess/postcss` | ✅ | ✅ |
| Vite with a split CSS entry (`@import` chain) | `tailess/vite` | ✅ | ✅ |
| Vite via `@tailwindcss/postcss` | `tailess/postcss` | ✅ | ✅ |

Tested against Tailwind CSS 4.3.3. CI additionally runs lint, typecheck, the full test
suite, [`publint`](https://publint.dev) and
[`arethetypeswrong`](https://arethetypeswrong.github.io) on every push.

## License

[MIT](./LICENSE) © [user01101111000](https://github.com/user01101111000)
