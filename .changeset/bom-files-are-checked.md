---
"tailess": patch
---

A source file saved with a UTF-8 byte order mark gets its build-time checks. The BOM sat in
front of the first-line import the checks are anchored to, so every check in the file —
the renamed-import one included — went quiet. Common with Windows editors.
