# tailess — React Router

A React Router app (framework mode) whose every class is built by tailess: rendered on the
server, built again in the browser. The plugin in [`vite.config.ts`](./vite.config.ts) is
what puts them in the stylesheet.

The example installs tailess from `../..`, and `dist/` is not committed, so build the
package at the repository root first — then install here:

```bash
npm ci && npm run build      # at the repository root
cd examples/react-router
npm install
npm run verify               # react-router build, the types, then tailess check
npm run smoke                # a dev server, edited until the stylesheet follows
```

`npm run dev` for the page itself.

## configure() on both sides

[`app/tailess.setup.ts`](./app/tailess.setup.ts) declares the `3xl` breakpoint that
[`app/app.css`](./app/app.css) adds. A page rendered on the server needs that call on the
server and again in the browser, before any route builds a class. The root route is loaded
on both sides before the others, so importing it first in [`app/root.tsx`](./app/root.tsx)
covers both. Leave it out and, in development, the browser console says so.

Every class lives in [`app/page.styles.ts`](./app/page.styles.ts); the route hands it state,
never a class.
