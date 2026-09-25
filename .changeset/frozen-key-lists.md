---
"tailess": patch
---

The exported key lists (`screenKeys`, `maxScreenKeys`, `containerKeys`, `maxContainerKeys`,
`stateKeys`) and `screens` are frozen. They are the lists the runtime itself reads, so a
JavaScript caller's in-place `screenKeys.reverse()` made `between("sm", "lg", …)` warn
that its range was empty and changed the order `responsive()` emits. The types already
said `readonly`; now the values agree.
