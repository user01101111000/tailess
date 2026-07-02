# tailess

**Type-safe Tailwind CSS utility functions driven by your own config file.**

[![npm version](https://img.shields.io/npm/v/tailess.svg)](https://www.npmjs.com/package/tailess)
[![minzipped size](https://img.shields.io/bundlephobia/minzip/tailess)](https://bundlephobia.com/package/tailess)
[![CI](https://github.com/user01101111000/tailess/actions/workflows/ci.yml/badge.svg)](https://github.com/user01101111000/tailess/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/tailess.svg)](./LICENSE)

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
- [Quick start](#quick-start)
- [Config-driven type safety](#config-driven-type-safety)
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

## Config-driven type safety

Create a `tailess.config.ts` and register your custom keys with `defineConfig`:

```ts
// tailess.config.ts
import { defineConfig } from "tailess";

export default defineConfig({
  screens: { xs: "480px", "3xl": "1600px" }, // additive to sm/md/lg/xl/2xl
  states: { groupHover: "group-hover" },     // additive to hover/focus/dark/...
  base: "antialiased",                        // always prepended by cn()
});
```

Build a configured instance with `createTailess` — the keys you declared become
**type-safe, autocompleted arguments**, and typos fail at compile time:

```ts
// lib/st.ts
import { createTailess } from "tailess";
import config from "../tailess.config";

export const st = createTailess(config);
```

```ts
import { st } from "@/lib/st";

st.ss({ base: "text-sm", "3xl": "text-2xl", groupHover: "underline" });
// => "antialiased text-sm 3xl:text-2xl group-hover:underline"
//    ✅ "3xl" / "groupHover" autocompleted — st.ss({ "4xl": ... }) is a type error

st.cn("text-black");
// => "antialiased text-black"   (config.base is prepended)
```

## API

All examples below use the top-level (default-config) helpers. A `createTailess(config)`
instance exposes the same functions with your custom keys typed in.

### `cn` — compose & merge

`clsx` for conditional joining + `tailwind-merge` for conflict resolution (last utility wins).

```ts
import { cn } from "tailess";

cn("px-2 py-1", isActive && "bg-blue-500", "px-4");
// => "py-1 bg-blue-500 px-4"   (px-2 dropped in favor of px-4)
```

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

// defineConfig is an identity helper that preserves literal keys for a config file
const config = defineConfig({ states: { groupHover: "group-hover" } });
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
| `defineConfig`             | `(config) => config`                                 | Type-safe identity helper for `tailess.config.ts`.                          |
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
