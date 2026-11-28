// The consumer has no tailess plugin and scans none of @acme/ui, so the design system's
// classes reach its stylesheet only through `@import "@acme/ui/styles.css"`. Both halves
// have to arrive: what `tailess emit` wrote for the classes built at runtime, and what
// `@source "./dist"` finds as literals. Ship only the first, and the second is unstyled
// here with nothing in either build saying so.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dir = join("dist", "assets");
const css = readdirSync(dir)
  .filter((name) => name.endsWith(".css"))
  .map((name) => readFileSync(join(dir, name), "utf8"))
  .join("\n");

/** How Tailwind escapes a class name inside a selector. */
const selectorFor = (cls) =>
  `.${[...cls].map((ch) => (/[a-zA-Z0-9_-]/.test(ch) ? ch : `\\${ch}`)).join("")}`;

const built = ["hover:bg-violet-800", "dark:hover:bg-gray-800", "md:px-4", "md:gap-4"];
const literal = ["inline-flex", "rounded-md", "bg-violet-700", "border-gray-300", "gap-3"];
const missing = [...built, ...literal].filter((cls) => !css.includes(selectorFor(cls)));
if (missing.length > 0) {
  console.error(`::error::the consumer's stylesheet has no rule for ${missing.join(", ")}`);
  process.exit(1);
}
console.log(
  `all ${built.length} built and ${literal.length} literal classes of @acme/ui have a rule here`,
);
