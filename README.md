<p align="center">
  <img src="./assets/logo.svg" alt="tailess logo" width="120" height="120">
</p>

<h1 align="center">tailess</h1>

<p align="center"><strong>Type-safe Tailwind CSS utility functions driven by your own config file.</strong></p>

<p align="center">
  <a href="https://www.npmjs.com/package/tailess"><img src="https://img.shields.io/npm/v/tailess.svg" alt="npm version"></a>
  <a href="https://bundlejs.com/?q=tailess"><img src="https://img.shields.io/bundlejs/size/tailess" alt="bundle size"></a>
  <a href="https://github.com/user01101111000/tailess/actions/workflows/ci.yml"><img src="https://github.com/user01101111000/tailess/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="license"></a>
</p>

Tailwind v4 dropped the JS `tailwind.config` in favor of CSS-first `@theme`. `tailess`
gives you back a tiny, framework-agnostic config (`tailess.config.ts`) whose values —
custom breakpoints, state variants, base tokens — **flow automatically into fully-typed
helpers**. Declare a breakpoint once; get autocomplete and typo-checking at every call site.

- 🎯 **Type-safe** — every custom breakpoint/state key you declare is autocompleted and validated at the call site.
- 🪶 **Tiny** — ESM + CJS, tree-shakeable, `sideEffects: false`. Only `clsx` + `tailwind-merge`.
- ⚙️ **Config-driven** — one config object powers every helper.
- 🧩 **Zero-config too** — sensible Tailwind defaults out of the box, no setup required.
- 🧠 **Readable markup** — group classes by breakpoint/state instead of interleaving prefixes.

## Contents

- [Install](#install)
- [Tailwind v4 setup (required)](#tailwind-v4-setup-required)
- [Quick start](#quick-start)
- [Custom breakpoints & states](#custom-breakpoints--states)
- [API](#api)
  - [`cn` — compose & merge](#cn--compose--merge)
  - [`ss` — group by breakpoint/state](#ss--group-by-breakpointstate)
    - [Conditional classes](#conditional-classes)
  - [`responsive` — mobile-first](#responsive--mobile-first)
  - [`until` / `between` — max-width ranges](#until--between--max-width-ranges)
  - [`on` — state variants](#on--state-variants)
  - [`data` / `aria` — attribute variants](#data--aria--attribute-variants)
  - [`match` — variant selection](#match--variant-selection)
  - [`createTailess` / `defineConfig`](#createtailess--defineconfig)
- [API reference](#api-reference)
- [TypeScript](#typescript)
- [License](#license)

## Install

```bash
npm install tailess
# pnpm add tailess · yarn add tailess · bun add tailess
```

## Tailwind v4 setup (required)

> [!IMPORTANT]
> On Tailwind v4 you **must** add the one-line integration below, or your prefixed
> classes won't get any CSS. Skip it and `md:text-2xl`, `hover:opacity-100`, etc.
> silently produce no styles.

**Why.** Tailwind v4 generates CSS by scanning your source for **literal** class
strings. `tailess` builds variant prefixes at runtime by concatenation, so
`ss({ md: "text-2xl" })` becomes `"md:text-2xl"` only *when the code runs* — the
full class `md:text-2xl` never appears literally in any file, so Tailwind never
sees it and emits no CSS. (Unprefixed classes like `text-xl` still work, because
those *do* appear literally.)

**Fix.** Add the tailess PostCSS plugin to the `postcss.config.mjs` you already use
for Tailwind, **before** `@tailwindcss/postcss`:

```js
// postcss.config.mjs
export default {
  plugins: {
    "tailess/postcss": {},
    "@tailwindcss/postcss": {},
  },
};
```

That's it — no CSS changes, no generated file, no scan command. On every build the
plugin scans your source, enumerates the classes `tailess` produces, and injects
them into Tailwind via `@source inline(...)`. It registers your source directories
as watch dependencies, so new classes appear in dev without a restart.

**Custom breakpoints, too.** The plugin also mirrors your config's `screens` into
an injected `@theme` block as `--breakpoint-<key>` values. So a **new** breakpoint
(`3xl: "1600px"`) actually generates its `3xl:` / `max-3xl:` utilities, and
**overriding** a default (`md: "867px"`) changes the media query Tailwind emits for
every `md:` class. Breakpoints you don't set keep Tailwind's built-in defaults.

```js
// Options (all optional):
"tailess/postcss": {
  content: ["./src", "./app"], // dirs/files to scan (default: cwd)
  config: "./tailess.config.ts", // auto-detected otherwise
  ignore: ["fixtures"],          // extra dir names to skip
}
```

The plugin auto-detects a `tailess.config.{ts,js,mjs}` so custom state aliases
(e.g. `groupHover → group-hover`) resolve correctly. Loading a **TypeScript** config
needs [`jiti`](https://github.com/unjs/jiti) (`npm i -D jiti`); a `.js`/`.mjs`
config needs nothing extra.

> [!NOTE]
> The scanner reads *literal* strings, so it deliberately over-approximates
> ternaries and conditional objects (it emits every branch). It cannot recover
> classes hidden behind a variable or an interpolated template
> (`` ss({ md: `text-${size}` }) ``); for those, keep the class literal or add it to
> a Tailwind [`@source inline(...)`](https://tailwindcss.com/docs/functions-and-directives#source-inline)
> safelist.

## Quick start

Zero config required — import a helper and go. Instead of interleaving prefixes into one
hard-to-scan string, group classes by breakpoint/state with **`ss`**:

```tsx
// ❌ conventional Tailwind — everything jumbled together
<div className="text-xl flex sm:block md:text-2xl hover:opacity-100" />

// ✅ tailess — grouped and readable
import { ss } from "tailess";

<div
  className={ss({
    base: "text-xl flex",
    sm: "block",
    md: "text-2xl",
    hover: "opacity-100",
  })}
/>
// => "text-xl flex sm:block md:text-2xl hover:opacity-100"
```

Every helper is available at the top level, bound to a zero-config default instance:

```ts
import { cn, responsive, on, until, between, match, data, aria } from "tailess";
```

## Custom breakpoints & states

Need keys beyond Tailwind's defaults? Write a `tailess.config.ts` with `defineConfig`
and **re-export its helpers**. That one file is the whole setup — no generated files,
no global wiring, no `declare module`:

```ts
// tailess.config.ts — the entire setup you write
import { defineConfig } from "tailess";

const t = defineConfig({
  screens: { xs: "480px", "3xl": "1600px" }, // add to sm/md/lg/xl/2xl (a matching key overrides)
  states: { groupHover: "group-hover" },     // additive to hover/focus/dark/...
  base: "antialiased",                        // always prepended by cn()
});

export default t;                       // the PostCSS plugin reads this for @theme + scanning
export const { ss, on, cn, responsive, until, between } = t; // fully-typed helpers
```

```tsx
// page.tsx — import your helpers from the config file
import { ss } from "@/tailess.config";

ss({ base: "text-sm", xs: "block", "3xl": "text-2xl", groupHover: "underline" });
//    ✅ "xs" / "3xl" / "groupHover" autocompleted — ss({ "4xl": ... }) is a type error
//       "base", ordering, and state aliases are all handled by the instance
```

`defineConfig` returns your config **and** a fully-typed tailess instance in one
value: the raw `screens`/`states`/`base` sit on top level (so the PostCSS plugin can
read the default export), while `.ss`, `.on`, … are bound to the resolved config —
custom keys typed in, `base` applied, aliases resolved. There is nothing else to wire.

- The [PostCSS plugin](#tailwind-v4-setup-required) auto-detects `tailess.config.{ts,js,mjs}`
  to mirror your custom breakpoints into `@theme` and resolve state aliases while scanning.
  Reading a **TypeScript** config needs [`jiti`](https://github.com/unjs/jiti) (`npm i -D jiti`);
  a `.js`/`.mjs` config needs nothing extra.
- Prefer not to keep helpers in the config file? Call `createTailess(config)` wherever
  you like — it returns the same typed instance.

> The bare `import { ss } from "tailess"` always stays available for the zero-config
> defaults (`sm`…`2xl`, `hover`, `dark`, …). It is intentionally typed to the defaults
> only; custom keys live on your `defineConfig`/`createTailess` instance.

## API

All examples below use the top-level (default-config) helpers — these autocomplete
the standard breakpoint/state keys (`sm`…`2xl`, `hover`, `dark`, …). A
`createTailess(config)` instance exposes the same functions with your custom keys
typed in on top.

### `cn` — compose & merge

`clsx` for conditional joining + `tailwind-merge` for conflict resolution (last utility wins).

```ts
import { cn } from "tailess";

cn("px-2 py-1", isActive && "bg-blue-500", "px-4");
// => "py-1 bg-blue-500 px-4"   (px-2 dropped in favor of px-4)
```

Set a `base` on a `defineConfig`/`createTailess` instance and it is prepended to every
`cn` (and `ss`) call on that instance — the place to inject shared design-system tokens.
The bare top-level `cn` has no `base` (it is the zero-config instance).

### `ss` — group by breakpoint/state

The flagship helper. Pass an object with a `base` bucket plus one entry per breakpoint or
state key. Output is emitted in a stable, mobile-first order and run through `cn`.

```ts
import { ss } from "tailess";

ss({
  base: "text-xl flex",
  sm: "block",
  md: "text-2xl",
});
// => "text-xl flex sm:block md:text-2xl"

// breakpoints and states can be mixed freely
ss({ base: "opacity-0", hover: "opacity-100", dark: "bg-black" });
// => "opacity-0 hover:opacity-100 dark:bg-black"
```

#### Conditional classes

Every bucket accepts a `clsx`-style `ClassValue` — a string, an array, an object, or a
falsy value — so conditions go inline, no separate syntax. A bucket whose value resolves to
falsy (`false` / `null` / `undefined`) is skipped entirely, prefix and all.

```ts
const isActive = true;
const disabled = false;

// 1) `&&` — drop the whole bucket (prefix included) when the condition is false
ss({ base: "text-sm", md: isActive && "text-2xl", lg: disabled && "hidden" });
// => "text-sm md:text-2xl"

// 2) ternary — choose between two values
ss({ base: "flex", hover: isActive ? "opacity-100" : "opacity-50" });
// => "flex hover:opacity-100"

// 3) array with conditions inside a single bucket
ss({ base: ["flex", isActive && "bg-blue-500", disabled && "opacity-50"] });
// => "flex bg-blue-500"

// 4) object form — { "class": condition }
ss({ base: "p-2", md: { "text-2xl": isActive, "text-xs": disabled } });
// => "p-2 md:text-2xl"

// 5) mix static + conditional tokens in a breakpoint bucket
ss({ base: "grid", lg: ["gap-4", isActive && "grid-cols-3"] });
// => "grid lg:gap-4 lg:grid-cols-3"
```

The same `ClassValue` rules apply to every helper argument (`cn`, `responsive` variants,
`on`, …), since each one ultimately runs through `cn`.

### `responsive` — mobile-first

A `base` value plus per-breakpoint (min-width) overrides. Breakpoints are emitted in config
order, not argument order.

```ts
import { responsive } from "tailess";

responsive("text-sm", { md: "text-lg", xl: "text-2xl" });
// => "text-sm md:text-lg xl:text-2xl"
```

### `until` / `between` — max-width ranges

The complement of `responsive`. `until` applies classes *below* a breakpoint (`max-*`);
`between` applies them within a range (inclusive of `min`, exclusive of `max`).

```ts
import { until, between } from "tailess";

until("md", "hidden");
// => "max-md:hidden"       (applies below the md breakpoint)

between("sm", "lg", "block");
// => "sm:max-lg:block"     (applies from sm up to, but not including, lg)
```

### `on` — state variants

Prefix classes with one or more state variants from `config.states`. Pass an array to stack
compound variants like `dark:hover:`.

```ts
import { on } from "tailess";

on("hover", "bg-blue-600 text-white");
// => "hover:bg-blue-600 hover:text-white"

on(["dark", "hover"], "bg-black");
// => "dark:hover:bg-black"
```

### `data` / `aria` — attribute variants

Perfect for headless UI libraries (Radix, Ark, React Aria). `data` builds a
`data-[name=value]:` variant — or the attribute-presence form `data-[name]:` when the value
is `null`/`undefined`. `aria` builds an `aria-*:` variant.

```ts
import { data, aria } from "tailess";

data("state", "open", "opacity-100");
// => "data-[state=open]:opacity-100"

data("disabled", null, "pointer-events-none");
// => "data-[disabled]:pointer-events-none"

aria("expanded", "rotate-180");
// => "aria-expanded:rotate-180"
```

### `match` — variant selection

Map a discriminant (a variant prop, size, tone…) to a class value. The lookup must cover
every possible value of the key, so the mapping is exhaustive at compile time. An optional
`fallback` handles values with no entry at runtime.

```ts
import { match } from "tailess";

function Button({ size }: { size: "sm" | "md" | "lg" }) {
  const sizing = match(size, {
    sm: "px-2 py-1 text-sm",
    md: "px-3 py-2 text-base",
    lg: "px-4 py-3 text-lg",
  });
  // size === "md" => "px-3 py-2 text-base"
  // omitting a size (e.g. only sm/md) is a compile-time error
}

match(tone, { primary: "bg-blue-600", danger: "bg-red-600" }, "bg-gray-200");
// unknown tone at runtime => "bg-gray-200"
```

### `createTailess` / `defineConfig`

```ts
import { createTailess, defineConfig } from "tailess";

const st = createTailess({ screens: { "3xl": "1600px" } });
st.responsive("text-sm", { "3xl": "text-2xl" }); // "3xl" fully typed

// defineConfig returns the config AND a typed instance in one value, so a single
// tailess.config.ts is the whole setup: default-export it for the PostCSS plugin,
// and re-export its helpers for your app.
const t = defineConfig({ states: { groupHover: "group-hover" } });
t.on("groupHover", "underline"); // => "group-hover:underline"  ("groupHover" typed)
export const { ss, on, cn } = t;
```

## API reference

| Export                     | Signature                                            | Description                                                                 |
| -------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------- |
| `cn`                       | `(...inputs: ClassValue[]) => string`                | Join classes (`clsx`) and resolve Tailwind conflicts (`tailwind-merge`).    |
| `ss`                       | `(input: { base?, ...keys }) => string`              | Group classes by breakpoint/state in a readable object.                     |
| `responsive`               | `(base, variants?) => string`                        | Mobile-first responsive string from a breakpoint→classes map.               |
| `until`                    | `(key, classes) => string`                           | Apply classes below a breakpoint (`max-*`).                                 |
| `between`                  | `(min, max, classes) => string`                      | Apply classes between two breakpoints (inclusive min, exclusive max).       |
| `on`                       | `(state \| state[], classes) => string`              | Prefix classes with one or more state variants (`hover`, `dark`, custom…).  |
| `data`                     | `(name, value \| null, classes) => string`           | Prefix classes with a `data-*` attribute variant.                           |
| `aria`                     | `(name, classes) => string`                          | Prefix classes with an `aria-*` attribute variant.                          |
| `match`                    | `(key, options, fallback?) => string`                | Pick a class from a lookup keyed by a variant prop. Exhaustive at compile time. |
| `createTailess`            | `(config?) => Tailess`                               | Factory returning all helpers bound to your config, plus `.config`.         |
| `defineConfig`             | `(config) => config & Tailess`                       | Config for `tailess.config.ts` that doubles as a fully-typed instance.      |
| `resolveConfig`            | `(config?) => ResolvedConfig`                        | Merge a user config onto the defaults (used internally).                    |
| `withPrefix`               | `(prefix, value) => string`                          | Low-level: apply an arbitrary variant prefix to every token.                |
| `st`                       | `Tailess`                                            | Default zero-config instance backing the top-level helpers.                 |

Also exported: `defaultConfig`, `defaultScreens`, `defaultStates`, and the types
`Tailess`, `TailessConfig`, `ResolvedConfig`, `Screens`, `States`, `ResponsiveMap`, `SsInput`.

## TypeScript

`tailess` ships its own type declarations for both ESM and CJS consumers (verified in CI with
[`publint`](https://publint.dev) and [`arethetypeswrong`](https://arethetypeswrong.github.io)).
Custom keys are preserved via `const` type parameters, so an instance created from your config
knows exactly which breakpoint and state keys are valid:

```ts
const st = createTailess({ screens: { "3xl": "1600px" } });

st.ss({ "3xl": "text-2xl" }); // ✅ ok
st.ss({ "4xl": "text-2xl" }); // ✗ Type error: "4xl" is not a valid key
```

## License

[MIT](./LICENSE) © [user01101111000](https://github.com/user01101111000)
