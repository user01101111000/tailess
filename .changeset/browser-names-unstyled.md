---
"tailess": minor
---

In development, the browser now names a variant class that is on the page with no CSS rule
behind it:

```txt
[tailess] No CSS rule for "md:space-y-7", which the page uses. Either Tailwind does not
know the class, or the build never read it: it reads only classes written as literals at
the call site, not ones from a variable, a template, a spread or a computed key.
```

`tailess check` verifies the classes the scanner enumerates, and a spread, a computed key
or a computed prefix enumerates nothing. The gate exited 0 while the element was unstyled,
and the only way to find out was to notice. The browser can tell: the class is on the
page, and no stylesheet names it. The same check names a typo in a hand-written `md:`
class, and a Tailwind component library the build does not scan.

It speaks once a class has gone five seconds without a rule, because a save that adds one
re-renders before the rebuilt stylesheet arrives — up to two and a half seconds under
webpack, measured. Each class is named once, through `configure({ onWarn })`. Where it
cannot read Tailwind's stylesheet, one served from another origin, it stays quiet.

The check is a chunk of its own, loaded with `import()` only in development, once tailess
has found its marker in the page. A production page never requests it; what every page
loads grows by 100 characters, the `import()` itself. Verified in Chrome on Vite and on
Next.js 16 with Turbopack and webpack: quiet on working pages and through hot updates,
and a class hidden by a spread or a computed key named, in client and server components.
