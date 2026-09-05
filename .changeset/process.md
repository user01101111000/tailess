---
"tailess": minor
---

Hold the claims to the code: peer dependency, coverage floor, and CI that runs.

**`tailwindcss` is a peer dependency** at `^4.0.0`. The plugins and the CLI resolve it
from the consumer's tree, so it always was one in fact — but nothing declared it, and
nothing warned a project on Tailwind 3, or a future 5, until the CSS was quietly wrong.

**`engines` is now `>=20.19`**, and CI loads the built package on exactly that version.
It promised Node 18, which has been end-of-life since April 2025; 20.19 is what Vite 8
requires, so it is what a Tailwind v4 toolchain already needs. Nothing that could run
before is stranded — but this is a support-floor change, so it is called out here rather
than buried.

**CI runs on the branch the work happens on.** It triggered only on `main`, so every
failure was found at merge time. It now runs on `dev`, on any pull request, and on
demand. Windows runs on both ends of the Node range rather than one, since it is the
platform the path handling actually differs on.

**Next.js is built.** It is the first setup the README documents and the reason
`scripts/postbuild.mjs` exists — its `export =` correction is what makes a string-named
`"tailess/postcss"` resolve for Next — and nothing had ever built one. A new CI job
scaffolds a Next app, builds it, and asserts the runtime-built classes have rules in the
stylesheet Next emitted. Verified both ways: with the plugin removed the build still
succeeds and the check goes red, which is the whole point.

**A weekly job runs the suite against the *latest* Tailwind**, not the pinned one. The
305 keys are a contract with Tailwind's variant registry, and the lockfile meant a
release that renamed or dropped a variant would reach a consumer's project before it
reached this one.

**Coverage is enforced**, not merely collected. It ran on every CI job and was checked
nowhere, so a change could delete a suite's worth of it in silence.

**The binary is run as a process.** Every test imported `check/run.ts` directly, so
`src/cli.ts` — argv slicing, the subcommand alias, the shebang, the catch that returns
2 — was covered by nothing. CI now asserts six exit codes from the built binary.

**The scanner has a fuzz suite.** It reads every file in a consumer's project and it is
a tokeniser, not a parser, so the inputs that matter are minified bundles and half-saved
files. Two properties, over a deterministic 2,000-sample corpus: it never throws, and it
never emits a candidate that could not be a class name — one of those poisons the rest of
its `@source inline` chunk, measured at 60 lost classes.

**The README is held to the code.** Its key counts were hand-maintained in five places
with nothing checking them, which is exactly how the docs site came to say 149. A test
now sums the Keys table against the real key set, checks every count in the prose,
resolves every table-of-contents anchor, holds the exported-types list to what
`src/index.ts` actually exports — it had fallen eight names behind — and compiles every
code example through the real Tailwind.

**The performance table is reproducible.** `npm run bench` produces it. Writing that
script found that the old numbers were measured with a benchmark bug: taking the best of
three scans without clearing the cache measured one cold scan and two warm ones, then
reported the warm number as the cold one. The cache is fine — 287 ms cold, 52 ms warm on
the machine named in the README — but the number that was published was not the number
that was measured.

**Governance that was missing entirely:** `SECURITY.md` (including what `tailess check`
executes from your project, which is the part worth knowing), `CODE_OF_CONDUCT.md`,
`CODEOWNERS`, issue and pull-request templates, and a Dependabot config that watches the
Actions pinned by SHA. A stability policy in `CONTRIBUTING.md` says what `0.x` actually
promises per surface, how deprecation works, and how to publish a prerelease — with the
version-drift trap written down, since it has bitten this repository twice.

**`llms.txt` and `AGENTS.md`.** A large share of Tailwind classes are now written by
coding agents, and every default habit one has — hoisting a class into a `const`,
building `text-${size}`, aliasing an import — produces code that compiles, type-checks,
renders the right `class` attribute and has no styles. The one rule is now written where
a tool will read it.
