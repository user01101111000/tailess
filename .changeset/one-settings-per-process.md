---
"tailess": patch
---

`configure()` reaches every copy of tailess in the process. The ES module and CommonJS
builds each kept their own settings, so an ESM app rendering a CommonJS component library
configured only its own copy: the library's `cn` ran the default merge, a declared key
warned as unknown, and warnings skipped the configured `onWarn`. The scanner's cache and the
build-time warning memo are shared the same way between the CommonJS entries, so
`clearCache()` from `tailess/build` reaches the plugins' cache.
