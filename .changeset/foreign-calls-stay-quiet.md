---
"tailess": patch
---

Event handlers, jQuery and inline lookup objects no longer fail `tailess check` or draw
build-time warnings.

- `stream.on("end", …)`, `socket.on("message", …)` and `$(el).on("click", …)` were read
  as tailess's `on()`, so the strings inside the handler became `end:animate-spin` and
  `click:hidden` — and `check` exited 1 on healthy code, saying the classes had no rule.
  Through a receiver, `on()` now enumerates only stacks of the Tailwind states it
  accepts, so `t.on("hover", …)` through a namespace import still works.
- `ss("rounded", { primary: "bg-blue-600", danger: "bg-red-600" }[tone])` is a lookup
  that picks one value, but its keys were read as variants (`primary:bg-blue-600`) and,
  inside `on()`, as a clsx dictionary with a bucket key.
- A call through an expression — `$(el).on(…)`, `getSocket().on(…)` — had no identifier
  before its dot and was checked as a bare call.
- In a file that imports tailess, every bare call with a helper's name was checked, so
  Solid's `on(accessor, (c) => ({ open: c > 0 }))` beside `import { ss }` was reported.
  A bare call is now checked only under a name the file imports from `"tailess"`.
