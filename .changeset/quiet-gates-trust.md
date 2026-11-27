---
"tailess": patch
---

`tailess check` no longer fails a healthy build on the scanner's own junk. The build also
stops telling a project to declare keys it has already declared.

**`check`, and junk a stylesheet happens to name.** The scanner over-approximates on
purpose. `ss({ md: data("state", "open", …) })` hands it `md:open` beside the class that
is real. The check filters that out by asking whether the bare utility resolves on its
own. It asked the stylesheet holding *every* candidate, so a selector some other class
generated answered for a word it merely contains. `group-[.open]:` compiles to
`:is(.open)`, so `md:open` was reported as a class that lost its rule.

A rule the stylesheet writes by hand answered the same way. shadcn/ui's `.dark { … }`
turned `md:dark` into an exit 1; that junk comes from `on(["dark", "hover"], …)` inside an
`md` bucket. The check now reads one compile three times: nothing offered, then the bare
utilities, then every candidate. A utility counts as resolving only when Tailwind
generates it. Real breakage is reported as before.

**Theme notes for keys that are declared.** A breakpoint or `@custom-variant` the CSS adds
gets a note saying how to declare a key for it. A project that had already declared the
key, in `CustomKeys` or `configure({ keys })`, still saw the note on every build and every
dev start. The scanner now reads the declaration back, and the note goes quiet for that
key. `collect()` returns the declared keys as `keys`, and `themeDiagnostics` accepts them.

**`configure()` on Next.js.** The README now says where the call goes in a server-rendered
app: one setup module, imported first in the root layout and in
`instrumentation-client.ts`. Configured on the server alone, the browser merges with the
defaults. React then reports a hydration mismatch on every class a custom merge decides,
and every declared key warns as unknown in the browser console. `instrumentation.ts` is
not a substitute, because `next build` prerenders static pages without calling its
`register()`.

These were found by building two apps that use every helper and recipe feature. One is
Vite 8.4; the other is Next.js 16.4 on both Turbopack and webpack, in dev and production.
Chrome then confirmed that every class on every element has a rule.
