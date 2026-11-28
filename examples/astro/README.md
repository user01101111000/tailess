# tailess — Astro

An Astro page whose every class is built by tailess while it renders. The plugin in
[`astro.config.mjs`](./astro.config.mjs) is what puts them in the stylesheet.

The example installs tailess from `../..`, and `dist/` is not committed, so build the
package at the repository root first — then install here. Astro 7 needs Node 22.23.4 or
later:

```bash
npm ci && npm run build      # at the repository root
cd examples/astro
npm install
npm run verify               # astro build, then tailess check
npm run smoke                # a dev server, edited until the stylesheet follows
```

`npm run dev` for the page itself.

## configure() on one side

[`src/tailess.setup.ts`](./src/tailess.setup.ts) declares the `3xl` breakpoint that
[`src/styles/global.css`](./src/styles/global.css) adds. An Astro page ships no JavaScript,
so its classes are built on the server only, and importing the setup first in the page's
frontmatter is enough. A framework island that builds classes in the browser is a second
side: import the setup module in the island too.

Every class lives in [`src/page.styles.ts`](./src/page.styles.ts).
