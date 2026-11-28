# tailess — SvelteKit

A SvelteKit app whose every class is built by tailess: rendered on the server, built again
in the browser. The plugin in [`vite.config.ts`](./vite.config.ts) is what puts them in the
stylesheet.

The example installs tailess from `../..`, and `dist/` is not committed, so build the
package at the repository root first — then install here:

```bash
npm ci && npm run build      # at the repository root
cd examples/sveltekit
npm install
npm run verify               # vite build, then tailess check
npm run smoke                # a dev server, edited until the stylesheet follows
```

`npm run dev` for the page itself.

## configure() on both sides

[`src/lib/tailess.setup.ts`](./src/lib/tailess.setup.ts) declares the `3xl` breakpoint that
[`src/app.css`](./src/app.css) adds. A page rendered on the server needs that call on the
server and again in the browser, before any route builds a class — so
[`src/hooks.server.ts`](./src/hooks.server.ts) and
[`src/hooks.client.ts`](./src/hooks.client.ts) each import it. Leave the client one out and,
in development, the browser console says so.

Every class lives in [`src/lib/page.styles.ts`](./src/lib/page.styles.ts); the page hands
it state, never a class.
