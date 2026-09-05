# tailess — Vite + React

A real app, not a snippet. Every class on the page is built at runtime, so Tailwind never
sees one of them in the source; the plugin in [`vite.config.ts`](./vite.config.ts) is what
puts them in the stylesheet.

```bash
npm install
npm run verify   # vite build, then tailess check
```

`npm run dev` for the page itself.

## What to try

Delete `tailess()` from `vite.config.ts` and run `npm run verify` again. The build still
succeeds and the page still renders exactly the right `class` attributes — with no styles
behind any of them. That is the failure this package exists to prevent, and
`npm run check` is what turns it into a red build.

Two more, both of which should fail the build:

- Add `import { ss as tw } from "tailess"` to `src/App.tsx` and call `tw({ md: "p-4" })`.
  The scanner finds calls by identifier, so the rename removes every class in the file.
- Change `src/app.css` to `@import "tailwindcss" prefix(tw);`. Every runtime-built class
  becomes the wrong name at once.

The plugin is configured with `diagnostics: "error"` here, so anything the scanner can
prove wrong fails the build rather than scrolling past.
