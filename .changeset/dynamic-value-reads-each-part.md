---
"tailess": patch
---

The "a bucket the scanner cannot read" check reads each part of a value that becomes a
class. A literal anywhere in the value used to vouch for all of it, so
`ss({ md: cond ? size : "p-2" })`, `ss({ md: [size, "flex"] })`, `ss({ md: size ?? "p-2" })`
and a shorthand `ss({ base: "p-1", md })` each built a class nothing enumerated and said
nothing. The part that cannot be read is named in the message.
