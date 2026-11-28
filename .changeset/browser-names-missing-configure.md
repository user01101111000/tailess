---
"tailess": minor
---

In development, the browser now says when the app's `configure()` never ran there:

```txt
[tailess] This project calls configure() with a merge or keys, but it has not run in this
browser, so ss() and cn() here merge with the defaults and do not know your keys. …
```

On a server-rendered app the call is needed on both sides. Made only in a root layout, it
ran on the server alone. The browser then merged with the defaults and computed a
different `className` from the one in the HTML. React reported a hydration mismatch that
named neither tailess nor the fix, and every declared key warned as unknown.

The build now marks an app that calls `configure()` with a merge or keys, beside the
marker it already injects. Once the page has loaded, the browser compares that with
whether its own copy was configured. The scanner reads the call off the top level of
`configure({ … })` itself, imported from `"tailess"` by name or through a namespace.
These do not count:

- a call with only `onWarn`, which no render depends on;
- a call in a test, a story or a test setup file;
- another library's `configure`, or a key it cannot name, such as a spread.

Each of these errs towards silence.

`buildPrelude()` from `tailess/build` takes the mark as an option,
`buildPrelude(classes, { configures })`, and `collect()` returns it as `configures`. The
check runs in the lazily loaded chunk added in the previous release, so what a page loads
up front grows by 99 characters.

Verified in Chrome on Next.js 16, with Turbopack and with webpack. It stayed quiet with the
setup module imported in both the root layout and `instrumentation-client.ts`, and named
the cause with the layout import alone. On a Vite SPA it stayed quiet with the setup
imported in `main.tsx`, and named it with the import removed.
