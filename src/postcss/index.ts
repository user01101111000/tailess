import type { TailessConfig } from "../config/types.js";
import { scanProject } from "../extract/node.js";

/**
 * Options for the tailess PostCSS plugin.
 */
export interface TailessPostcssOptions {
  /** Files or directories to scan. Defaults to the current working directory. */
  content?: string[];
  /**
   * Path to your tailess config, or an inline config object. Auto-detected
   * (`tailess.config.*`) when omitted.
   */
  config?: string | TailessConfig;
  /** Extra directory names to skip while scanning. */
  ignore?: string[];
}

// Minimal structural types for the slice of the PostCSS API we use, so tailess
// needs no dependency on `postcss` itself (the host build always provides it).
interface Declaration {
  prop: string;
  value: string;
}
interface AtRule {
  name: string;
  params: string;
  append(node: Declaration): void;
}
interface Root {
  prepend(node: AtRule): void;
}
interface Helpers {
  result: { messages: Array<Record<string, unknown>> };
  postcss: {
    atRule(defaults: { name: string; params: string }): AtRule;
    decl(defaults: { prop: string; value: string }): Declaration;
  };
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
 * It also mirrors any custom breakpoints from your tailess config into a
 * `@theme` block (`--breakpoint-<key>`), so overriding a default (e.g.
 * `md: "867px"`) or adding a new key (e.g. `3xl: "1600px"`) actually changes
 * Tailwind's generated media queries. Breakpoints you don't set keep Tailwind's
 * own defaults.
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
      const { classes, dirs, screens } = await scanProject({
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

      // Mirror config breakpoints into Tailwind's theme so overrides and custom
      // keys take effect. Only user-set keys are emitted; the rest fall back to
      // Tailwind's defaults.
      const screenEntries = Object.entries(screens);
      if (screenEntries.length > 0) {
        const theme = helpers.postcss.atRule({ name: "theme", params: "" });
        for (const [key, value] of screenEntries) {
          theme.append(helpers.postcss.decl({ prop: `--breakpoint-${key}`, value }));
        }
        root.prepend(theme);
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
