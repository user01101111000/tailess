# tailess — Nuxt

A Nuxt app whose every class is built by tailess: rendered on the server, built again in
the browser. The plugin in [`nuxt.config.ts`](./nuxt.config.ts) is what puts them in the
stylesheet.

The example installs tailess from `../..`, and `dist/` is not committed, so build the
package at the repository root first — then install here:

```bash
npm ci && npm run build      # at the repository root
cd examples/nuxt
npm install
npm run verify               # nuxt build, then tailess check
npm run smoke                # a dev server, edited until the stylesheet follows
```

`npm run dev` for the page itself.

## configure() on both sides

[`app/tailess.setup.ts`](./app/tailess.setup.ts) declares the `3xl` breakpoint that
[`app/assets/css/main.css`](./app/assets/css/main.css) adds. A page rendered on the server
needs that call on the server and again in the browser, before the app renders — and Nuxt
runs a plugin on both, so [`app/plugins/tailess.ts`](./app/plugins/tailess.ts) importing it
is the whole of it. Name the plugin `tailess.server.ts` and it runs on the server alone;
in development, the browser console says so.

Every class lives in [`app/page.styles.ts`](./app/page.styles.ts); the page hands it state,
never a class.
