# tailess — Vite + React

A real app, not a snippet. Every variant on the page is built at runtime, so Tailwind
never sees one of them in the source; the plugin in [`vite.config.ts`](./vite.config.ts) is
what puts them in the stylesheet.

The example installs tailess from `../..`, and `dist/` is not committed, so build the
package at the repository root first — then install here:

```bash
npm ci && npm run build                  # at the repository root
cd examples/vite-react
npm install
npm run verify                           # vite build, then tailess check
```

`npm run dev` for the page itself.

## Where the classes are

Not in the components. Each one has a `*.styles.ts` beside it, and what the component
hands that file is the state it is in — never a class.

```text
src/
  App.tsx              no classes: structure, state, and `s.` lookups
  App.styles.ts        the page's styles — strings, one recipe, one function
  ui/
    tokens.styles.ts   what more than one component shares (a focus ring, a border)
    Button.tsx
    Button.styles.ts   a recipe: a choice, a size with its own breakpoint, on/off, compound
    Tabs.tsx
    Tabs.styles.ts     state the markup carries (`aria-selected`), so no prop at all
    Card.tsx
    Card.styles.ts     a component with parts: one recipe, one class per part
    Meter.tsx
    Meter.styles.ts    a number from data, in a custom property rather than a class
```

Each file is a different answer to "what changes this element's look, and who knows it" —
the table in the [README](../../README.md#every-kind-of-state-and-where-it-is-written)
lists them all.

## What to try

Delete `tailess()` from `vite.config.ts` and run `npm run verify` again. The build still
succeeds and the page still renders exactly the right `class` attributes — with no styles
behind any of them. That is the failure this package exists to prevent, and
`npm run check` is what turns it into a red build.

Three more, the first two of which should fail the build:

- Add `import { ss as tw } from "tailess"` to `src/App.styles.ts` and call
  `tw({ md: "p-4" })`. The scanner finds calls by identifier, so the rename removes every
  class that call builds.
- Change `src/app.css` to `@import "tailwindcss" prefix(tw);`. Every runtime-built class
  becomes the wrong name at once.
- In `src/ui/Button.tsx`, hand the recipe a bucket map:
  `button({ tone, size }, { xl: "px-10" })`. TypeScript refuses it, which is the point —
  the class would be built at a call site the scanner has no reason to look at, and land
  with no rule. Cast past the error and the console says so instead. Wrap the map in
  `ss(…)`, or better, make it a variant in `Button.styles.ts`.

The plugin is configured with `diagnostics: "error"` here, so anything the scanner can
prove wrong fails the build rather than scrolling past.
