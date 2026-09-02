/// <reference types="node" />
import { join } from "node:path";
import { collect } from "../extract/collect.js";
import { isTailwindEntry, isTailwindSpecifier } from "../integration/entry.js";
import { sourceChunks } from "../integration/inject.js";
import { reportDiagnostics } from "../integration/report.js";
import { createSidecar, importSpecifier } from "../integration/sidecar.js";

/**
 * Options for the tailess PostCSS plugin.
 *
 * Each is `| undefined` so that passing one conditionally — `content: isCI ? […] :
 * undefined` — compiles under `exactOptionalPropertyTypes`, which is what the
 * implementation already accepts.
 */
export interface TailessPostcssOptions {
  /** Files or directories to scan. Defaults to the current working directory. */
  content?: string[] | undefined;
  /** Extra directory names to skip while scanning. */
  ignore?: string[] | undefined;
  /** File extensions to scan, without the dot. Defaults to the usual source types. */
  extensions?: string[] | undefined;
  /**
   * Where to write the generated stylesheet tailess `@import`s. Defaults to
   * `node_modules/.cache/tailess`.
   */
  cacheDir?: string | undefined;
}

// Minimal structural types for the slice of the PostCSS API we use, so tailess
// needs no dependency on `postcss` itself (the host build always provides it).
//
// Each mirrors the shape of the matching `*Props` type in PostCSS — notably
// `Rule.selector` and `Declaration.prop`/`value` — so the whole plugin object stays
// assignable to PostCSS's own `AcceptedPlugin`. Drop those fields and a typed
// `postcss.config.ts` stops compiling for every consumer.
interface Declaration {
  prop: string;
  value: string;
}
interface Rule {
  selector: string;
  append(node: Declaration): void;
}
interface AtRule {
  name: string;
  params: string;
}
interface Root {
  /** Only ever read to spot Tailwind's banner — see {@link ranAfterTailwind}. */
  first?: { type: string; text?: string } | undefined;
  prepend(...nodes: Array<Rule | AtRule>): void;
  walkAtRules(callback: (rule: AtRule) => false | undefined): void;
}
interface Helpers {
  result: {
    messages: Array<Record<string, unknown>>;
    // Spelled `| undefined` for the same reason the public options interfaces are:
    // under `exactOptionalPropertyTypes` a bare `from?: string` refuses a value that
    // may be *explicitly* undefined, which is exactly what PostCSS's own
    // `ResultOptions.from` is — and the whole point of these structural types is that
    // the plugin stays assignable to `AcceptedPlugin` in a typed `postcss.config.ts`.
    opts?: { from?: string | undefined } | undefined;
  };
  postcss: {
    atRule(defaults: { name: string; params: string }): AtRule;
    rule(defaults: { selector: string }): Rule;
    decl(defaults: { prop: string; value: string }): Declaration;
  };
}
interface Plugin {
  postcssPlugin: string;
  Once(root: Root, helpers: Helpers): Promise<void>;
}

/**
 * True if Tailwind will emit utilities into this stylesheet. Reads the AST rather
 * than stringifying it, then defers to {@link isTailwindEntry} to follow relative
 * `@import`s when Tailwind isn't imported here directly.
 */
async function isTailwindStylesheet(root: Root, from: string | undefined): Promise<boolean> {
  const imports: string[] = [];
  let direct = false;

  root.walkAtRules((rule) => {
    // PostCSS reports the name as written, and an at-rule name is ASCII
    // case-insensitive in CSS — `@Import "tailwindcss"` is the same rule.
    const name = rule.name.toLowerCase();
    if (name === "import") {
      const specifier = /["']([^"']+)["']/.exec(rule.params)?.[1];
      if (specifier) {
        if (isTailwindSpecifier(specifier)) direct = true;
        else imports.push(specifier);
      }
    } else if (name === "tailwind" && /^\s*(?:utilities|all)\b/i.test(rule.params)) {
      direct = true;
    }
    return direct ? false : undefined;
  });

  if (direct) return true;
  if (imports.length === 0) return false;

  // Hand the shared resolver just the import list to follow.
  const css = imports.map((specifier) => `@import "${specifier}";`).join("\n");
  return isTailwindEntry(css, from);
}

/**
 * PostCSS plugin that bridges tailess to Tailwind v4 — the integration to use with
 * **Next.js** and any other PostCSS-based setup. (On Vite, use `tailess/vite`
 * instead: `@tailwindcss/vite` compiles CSS before PostCSS ever runs, so a PostCSS
 * plugin cannot reach it.)
 *
 * tailess builds variant prefixes (`md:`, `hover:`, …) at runtime, so those full
 * class names never appear literally in your source and Tailwind's scanner misses
 * them. This plugin scans your source, enumerates the classes tailess can produce,
 * and hands them to Tailwind as `@source inline(...)` — no CSS changes and no scan
 * step of your own.
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
/**
 * True when this stylesheet is Tailwind's *output* rather than its input — which
 * means `@tailwindcss/postcss` was listed first and has already compiled.
 *
 * Order is the one thing a consumer has to get right, and getting it wrong is
 * otherwise completely silent: the build succeeds, and every runtime-built class
 * loses its CSS. Tailwind puts its licence banner at the very top of what it emits,
 * so recognising it costs one property read — no stringifying the compiled AST.
 */
function ranAfterTailwind(root: Root): boolean {
  const first = root.first;
  return first?.type === "comment" && (first.text ?? "").startsWith("! tailwindcss");
}

let warnedAboutOrder = false;

const tailessPostcss = Object.assign(
  (options: TailessPostcssOptions = {}): Plugin => {
    const sidecar = createSidecar(
      options.cacheDir ?? join(process.cwd(), "node_modules", ".cache"),
    );

    return {
      postcssPlugin: "tailess",
      async Once(root, helpers) {
        const from = helpers.result.opts?.from;

        // Injecting into a stylesheet Tailwind doesn't compile would leak our
        // directives into the output, so bail unless utilities land here.
        if (!(await isTailwindStylesheet(root, from))) {
          if (!warnedAboutOrder && ranAfterTailwind(root)) {
            warnedAboutOrder = true;
            console.warn(
              '[tailess] "tailess/postcss" ran after "@tailwindcss/postcss", so Tailwind ' +
                "had already compiled and no md:/hover:/dark: class will have any CSS. " +
                'List "tailess/postcss" first in your postcss config.',
            );
          }
          return;
        }

        const { classes, files, roots, extensions, diagnostics } = await collect({
          roots: options.content?.length ? options.content : [process.cwd()],
          ignore: options.ignore,
          extensions: options.extensions,
        });

        reportDiagnostics(diagnostics, process.cwd());

        // Prefer the sidecar: it is a build dependency Tailwind tracks, so a
        // rewritten list always takes effect. Falling back to inlining keeps things
        // working when we can't express the path (no `from`, another drive, an
        // unwritable cache dir) — correct for builds, at the cost of needing a dev
        // restart to see a brand-new class.
        const specifier = from === undefined ? null : importSpecifier(from, sidecar.path);
        let inline = specifier === null;

        if (specifier !== null) {
          try {
            await sidecar.refresh(classes);
            root.prepend(helpers.postcss.atRule({ name: "import", params: `"${specifier}"` }));
          } catch {
            inline = true;
          }
        }

        if (inline) {
          const marker = helpers.postcss.rule({ selector: ":root" });
          marker.append(helpers.postcss.decl({ prop: "--tailess", value: "1" }));
          root.prepend(
            marker,
            ...sourceChunks(classes).map((chunk) =>
              helpers.postcss.atRule({ name: "source", params: `inline("${chunk}")` }),
            ),
          );
        }

        const parent = from ?? "";

        // Per-file `dependency` messages are what make the *bundler* rebuild this
        // stylesheet when a source file changes, which is what re-runs this plugin.
        // (Tailwind picking up the new list is the sidecar's job.)
        for (const file of files) {
          helpers.result.messages.push({ type: "dependency", plugin: "tailess", file, parent });
        }

        // Directory watching covers files created after this run. Scope the glob
        // to the extensions actually scanned: `**/*` makes the bundler watch every
        // file under the root — `node_modules` and build output included — which on
        // a large project costs far more than the scan it is guarding.
        const glob = extensions.length > 0 ? `**/*.{${extensions.join(",")}}` : "**/*";
        for (const dir of roots) {
          helpers.result.messages.push({
            type: "dir-dependency",
            plugin: "tailess",
            dir,
            glob,
            parent,
          });
        }
      },
    };
  },
  { postcss: true as const },
);

export default tailessPostcss;
