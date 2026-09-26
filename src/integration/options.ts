import type { DiagnosticMode } from "./report.js";

/** The options both plugins take, in the shape the scanner reads them. */
interface PluginOptions {
  content?: string[] | undefined;
  ignore?: string[] | undefined;
  extensions?: string[] | undefined;
  diagnostics?: DiagnosticMode | undefined;
  cacheDir?: string | undefined;
}

const modes: readonly unknown[] = ["warn", "error", "off"] satisfies DiagnosticMode[];

/** A value as it would read in a config file. */
function shown(value: unknown): string {
  return typeof value === "string" ? `"${value}"` : (JSON.stringify(value) ?? String(value));
}

/**
 * `options` checked, or a thrown error naming the one that is wrong.
 *
 * They arrive from `postcss.config.mjs`, a `.postcssrc.json` or an untyped
 * `vite.config.js`, where nothing checks their shape, and each wrong shape failed badly:
 * `content: "src"` crashed the build with "options.roots.map is not a function",
 * `ignore: "src"` was read one letter at a time, and `diagnostics: "ERROR"` — the setting
 * a CI gate depends on — quietly behaved as "warn". A single string where a list belongs
 * is taken as a list of one, since that is plainly what it means. A loader that hands
 * over `true` or nothing for "no options" gets the defaults.
 */
export function readOptions<T extends PluginOptions>(options: unknown, plugin: string): T {
  const fail = (message: string): never => {
    throw new TypeError(`[tailess] ${plugin}: ${message}`);
  };
  if (options === undefined || options === null || typeof options === "boolean") return {} as T;
  if (typeof options !== "object" || Array.isArray(options)) {
    return fail(`options must be an object, got ${shown(options)}`);
  }
  const read = { ...(options as T) };

  for (const key of ["content", "ignore", "extensions"] as const) {
    const value: unknown = read[key];
    if (value === undefined) continue;
    const list =
      typeof value === "string"
        ? [value]
        : typeof value === "object" && value !== null && Symbol.iterator in value
          ? [...(value as Iterable<unknown>)]
          : undefined;
    if (!list?.every((item) => typeof item === "string")) {
      fail(`"${key}" must be a list of strings, got ${shown(value)}`);
    }
    read[key] = list as string[];
  }

  if (read.diagnostics !== undefined && !modes.includes(read.diagnostics)) {
    fail(`"diagnostics" must be "warn", "error" or "off", got ${shown(read.diagnostics)}`);
  }
  // `""` resolves to the project root, which is where the generated stylesheet then went.
  if (
    read.cacheDir !== undefined &&
    (typeof read.cacheDir !== "string" || read.cacheDir.trim() === "")
  ) {
    fail(`"cacheDir" must be a directory path, got ${shown(read.cacheDir)}`);
  }
  return read;
}
