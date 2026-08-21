---
"tailess": patch
---

Drop the `clsx` runtime dependency. A fresh install now pulls `tailess` and
`tailwind-merge`, nothing else.

`src/internal/join.ts` does the same job in about forty lines. The point is not really
the bytes — `clsx` is 237 gzipped — but it does not cost any either: the code compresses
better next to the rest of the package than `clsx`'s standalone bundle does, so the swap
came out 35 gzipped bytes *smaller* (135 more minified characters, which is the number
the size budget tracks). It is also no slower; on arrays and nested dictionaries it
measures slightly faster, and `cn` and `ss` are unchanged end to end.

A drop-in replacement is only worth having if it is genuinely identical, so `clsx` stays
a devDependency and serves as the test oracle rather than being removed outright.
`test/internal/join.test.ts` asserts the two produce byte-identical output across every
shape — strings, numbers, `bigint` (which `clsx` types but drops at runtime), nested
arrays, dictionaries, inherited enumerable keys — plus two thousand generated cases from
a seeded PRNG, so a failure can be reproduced.

`ClassValue` is now declared by tailess instead of re-exported from `clsx`, with the same
structure, so importing the type from `tailess` keeps working. `ClassArray` and
`ClassDictionary` are exported alongside it. `ClassDictionary` stays `Record<string, any>`
rather than tightening to `unknown`: TypeScript lets any object type flow into
`Record<string, any>` but rejects an interface with no index signature for
`Record<string, unknown>`, so the stricter type would have failed code that used to
compile.

`tailwind-merge` is deliberately kept. Roughly two thirds of Tailwind installs already
have it, so for most projects it is a shared copy rather than an addition — and 77% of its
size is the utility-conflict taxonomy, which is large because Tailwind is. Reimplementing
that lands at the same size or gets merges quietly wrong, which is the exact failure this
package exists to prevent.
