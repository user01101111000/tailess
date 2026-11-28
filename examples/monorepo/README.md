# tailess — a design system in a monorepo

[`packages/ui`](./packages/ui) is a design system built with tailess: a `Button` and its
recipe in [`button.styles.ts`](./packages/ui/src/button.styles.ts). Two apps use it, the two
ways a design system gets used.

**[`apps/web`](./apps/web) compiles it from its source**, as most monorepos do. Two lines
make that work, and both are needed:

- `content` in [`vite.config.ts`](./apps/web/vite.config.ts) makes the plugin scan the
  package, so Tailwind gets the classes tailess builds there;
- `@source` in [`src/app.css`](./apps/web/src/app.css) makes Tailwind scan it for the
  literal ones.

Leave out the `@source` and `tailess check` still passes, while every `base` class of the
button is unstyled.

**[`apps/consumer`](./apps/consumer) uses it from its build**, the way npm would serve it. It
has no tailess plugin and does not scan the package. One line in
[`src/app.css`](./apps/consumer/src/app.css) — `@import "@acme/ui/styles.css";` — and the
package's [`styles.css`](./packages/ui/styles.css) brings both halves: its bundle as an
`@source`, and the file `tailess emit` writes at the package's build.

The example installs tailess from the repository, and `dist/` is not committed, so build
the package at the repository root first:

```bash
npm ci && npm run build      # at the repository root
cd examples/monorepo
npm install                  # every workspace
npm run verify               # builds ui, then both apps; checks both stylesheets
npm run smoke                # web's dev server, edited in packages/ui until the stylesheet follows
```
