import { scanProject } from "../extract/node.js";

/**
 * Options for the tailess PostCSS plugin.
 */
export interface TailessPostcssOptions {
  /** Files or directories to scan. Defaults to the current working directory. */
  content?: string[];
  /** Path to your tailess config. Auto-detected (`tailess.config.*`) when omitted. */
  config?: string;
  /** Extra directory names to skip while scanning. */
  ignore?: string[];
}

// Minimal structural types for the slice of the PostCSS API we use, so tailess
// needs no dependency on `postcss` itself (the host build always provides it).
interface AtRule {
  name: string;
  params: string;
}
interface Root {
  prepend(node: AtRule): void;
}
interface Helpers {
  result: { messages: Array<Record<string, unknown>> };
  postcss: { atRule(defaults: { name: string; params: string }): AtRule };
}
interface Plugin {
  postcssPlugin: string;
  Once(root: Root, helpers: Helpers): Promise<void>;
}

/**
 * PostCSS plugin that bridges tailess to Tailwind v4.
 *
 * tailess builds variant prefixes (`md:`, `hover:`, …) at runtime, so the full
 * class names never appear literally in source and Tailwind's scanner misses
 * them. This plugin scans your source, enumerates those classes, and injects a
 * single `@source inline(...)` directive so Tailwind generates their CSS — with
 * no `@source` line, no generated file, and no separate scan step.
 *
 * Register it **before** `@tailwindcss/postcss`:
 *
 * ```js
 * // postcss.config.mjs
 * export default {
 *   plugins: {
 *     "tailess/postcss": {},
 *     "@tailwindcss/postcss": {},
 *   },
 * };
 * ```
 */
const tailessPostcss = Object.assign(
  (options: TailessPostcssOptions = {}): Plugin => ({
    postcssPlugin: "tailess",
    async Once(root, helpers) {
      const { classes, dirs } = await scanProject({
        paths: options.content,
        config: options.config,
        ignore: options.ignore,
      });

      if (classes.length > 0) {
        root.prepend(
          helpers.postcss.atRule({
            name: "source",
            params: `inline(${JSON.stringify(classes.join(" "))})`,
          }),
        );
      }

      // Let the bundler watch source dirs so a new class in a `.tsx` retriggers
      // this plugin (and Tailwind) during development.
      for (const dir of new Set(dirs)) {
        helpers.result.messages.push({
          type: "dir-dependency",
          dir,
          glob: "**/*",
          plugin: "tailess",
          parent: "",
        });
      }
    },
  }),
  { postcss: true as const },
);

export default tailessPostcss;
