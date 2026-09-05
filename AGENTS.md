# AGENTS.md

Rules for anything writing code in this repository. Copy the **Using tailess** section
into your own project's `AGENTS.md` or `CLAUDE.md` if you use tailess there — it is the
part that keeps generated code from being silently unstyled.

## Using tailess

**Every Tailwind class must be a literal at the call site.** The runtime builds
`md:p-6` while the page renders; Tailwind never sees that string in the source, so a
build plugin predicts it from the call site. When it cannot, the class lands on the
element with no rule behind it — no error anywhere, just an unstyled element.

Never do these, however natural they look:

- Hoist a class into a `const` and pass the variable: `ss({ md: size })`
- Build one by interpolation: `` ss({ md: `text-${scale}` }) ``
- Spread into a bucket map, or use a computed key
- Rename the import: `import { ss as tw }` removes every class in that file

Do these instead:

- `match(value, { a: "p-2", b: "p-8" })` for a lookup — every branch stays literal
- `ss({ md: cond ? "p-4" : "p-2" })` — both branches are read
- `vars({ "--w": `${n}%` })` with `w-[var(--w)]` for a value that comes from data

`base` is exempt: it adds no prefix, so Tailwind finds the literal wherever it lives.

Run `npx tailess check` after generating class-building code. It compiles the project
and exits 1 if a class has no CSS. `npx tailess doctor` answers whether the plugin is
wired up at all.

## Working on this repository

Read `CONTRIBUTING.md` first — in particular **The one invariant** and the
**Adding a helper** checklist. The short version:

- A helper touches **seven** places. Miss the scanner's name list in
  `src/extract/scan.ts` and everything stays green while every class it builds is
  unstyled.
- `test/extract/runtime-parity.test.ts` is what holds the runtime and the scanner
  together. A new helper needs a case there.
- Build **before** you test: `test/integration/plugin-shape.test.ts` asserts on `dist/`
  and skips itself when there is none.

```sh
npm run lint && npm run typecheck && npm run build && npm test
```

### House rules

- **Verify, do not assert.** Every claim about Tailwind's behaviour in this repository
  was established by compiling something. If you are about to write "Tailwind does X",
  compile it first.
- **A warning that fires on working code is a bug.** The diagnostics have a deliberately
  high bar: report only what *cannot* work. The silent half of each test suite — the
  cases that must stay quiet — matters more than the loud half.
- **Do not widen the runtime.** It has one dependency and no Node imports. Anything that
  walks the file system belongs in `src/extract`, `src/integration` or `src/check`.
- Add a changeset for anything that changes published behaviour.
