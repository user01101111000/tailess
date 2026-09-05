---
"tailess": minor
---

Close the gaps in the library itself: slots, `extend`, `configure`, and keys you declare.

**`variants()` grew the four things that sent teams to `tailwind-variants` instead.**

`slots` builds a multi-part component. A Dialog is root, overlay, panel, title and close;
before this it was one `variants()` call per part, with the shared variants written out
five times. Declare the parts instead of `base`, and every option says what it adds to
each one:

```ts
const card = variants({
  slots: { root: "rounded-lg border", title: "font-semibold", body: "text-sm" },
  variants: { size: { lg: { root: { base: "p-5", md: "p-8" }, title: "text-xl" } } },
});
const { root, title, body } = card({ size: "lg" });
```

Each part merges on its own, so an override on `root` cannot disturb `title`, and a
slot's value is an `SsArg` like anywhere else — a part can carry its own breakpoints.

`extend` builds on another recipe, merging **per option** rather than per group, so a
product package adding one `tone` keeps the ones it inherited rather than replacing the
group. Types merge too. Slotted recipes extend the same way, gaining parts.

A boolean variant takes a `boolean` — `<Button disabled={isDisabled}>` — which is what a
component already has and what `cva` and `tv` hand back. The string spellings still work,
since `"true"` and `"false"` really are the option keys.

A compound rule matches a list: `{ tone: ["danger", "warning"], size: ["md", "lg"] }`.
That was four rules kept in step by hand, and the count is multiplicative.

`compoundVariants`, `defaultVariants` and `className` are accepted as aliases, so a `cva`
recipe ports by changing the function name and nothing else.

The scanner learned slots, which is the half that matters. An option's value is a slot
map, not a class value, and reading it as an `ss` map emitted `root:md:p-8` — junk — while
missing the `md:p-8` the runtime builds.

**`configure({ merge, onWarn, keys })`.** `cn` called a bare `twMerge`, with no way to
reach `extendTailwindMerge` — so in a project with its own `@utility` or theme scale,
`cn("text-sm", "text-hero")` emitted both and the winner was decided by CSS source order
rather than by argument order, which is the one guarantee `cn` makes. `onWarn` is where a
development warning goes: throw to make it fatal in CI, collect it in a test, or silence
it, because a warning nobody can silence is one everybody learns to scroll past.

**Keys your own CSS adds.** The built-in keys are closed on purpose — that is what makes
a typo a compile error. But a `@theme` adding `--breakpoint-3xl`, or a `@custom-variant`,
creates a variant that genuinely works and that tailess cannot know about; the build check
already reported it and the only answer was `withPrefix`. Augment `CustomKeys` and it
joins the union, and name it in `configure({ keys })` so the runtime — which cannot see a
type — stops calling it unknown on every render.

**A ninth build-time check: an `ss` map handed to a helper that takes a flat class value.**
Composition runs one way — a helper nests inside an `ss` bucket, never the reverse — and
every helper's class argument is a `ClassValue`, where an object is a `clsx` dictionary.
So `on("hover", { base: "underline", md: "font-bold" })` builds `"hover:base hover:md"`.
The types refuse it; this catches the cast and the untyped boundary that get past them.

**The six warning memos are bounded.** They were sets of every value ever seen, and a dev
server or an SSR process in development sees a fresh one on every request — `has(userInput)`
is enough. They clear rather than stop accepting, so the worst case is a warning printing
twice, not a real one never printing.

Runtime cost: `ss` + `cn` is **unchanged at 5,170 characters** — a project not importing
`variants` pays nothing for any of the above. `variants` itself goes 497 → 1,733. The size
budget moved deliberately, with both numbers written into the test that pins it.

Four things were considered and deliberately not built, each for a reason now in the
README: responsive variant selection at the call site (the scanner reads your recipe,
never the call sites of the component it builds, so it would enumerate every option under
all thirteen breakpoints or let the class land with no CSS); memoizing `ss` (React builds
the object fresh on every render, and `tailwind-merge` already caches the expensive half);
exporting the whole theme as JS (a second copy of your theme is a copy that drifts —
`var(--color-brand)` is the answer); and folding a static call into a literal at build
time (it means rewriting your JavaScript, which is a much larger promise than adding CSS).
