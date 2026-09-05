---
name: A class has no styles
about: The class is on the element and nothing applies
labels: unstyled
---

<!--
This is the failure the package exists to prevent, so it is worth reporting. Two
commands answer most of it before you write anything:

    npx tailess doctor        # is the plugin actually wired up?
    npx tailess check         # which classes have no rule, and in which file?

If `check` names the class, paste its output and stop there — that is the whole report.
-->

**The class:**  <!-- e.g. md:p-6 -->

**The call that builds it:**

```tsx

```

**`npx tailess check --content src` says:**

```

```

**Setup:** <!-- Vite / Next.js / other; Tailwind version; tailess version -->

<!--
Known cases that are not bugs, all listed under "What the scanner can and cannot see":
a bucket value that is a variable or an interpolated template, a spread, a computed key,
`import { ss as tw }`, and Tailwind imported with `prefix(...)`. `tailess check` reports
every one of them by name.
-->
