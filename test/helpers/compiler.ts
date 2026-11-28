/**
 * A consumer's TypeScript, run over a few files in a scratch directory.
 *
 * By default it is this repository's own, through its API. With `TAILESS_TSC` naming
 * another one's `bin/tsc`, it is that one instead, run as a program over a tsconfig.json
 * that holds the same options: TypeScript 7 ships no API these tests could call, and it
 * is the compiler a project created today installs. CI runs `test/types` both ways.
 */
import { execFile } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import ts from "typescript";

/** The `bin/tsc` of the TypeScript to ask instead of this repository's, if there is one. */
export const otherCompiler = process.env.TAILESS_TSC || undefined;

/**
 * What the compiler reports for `files` in `dir`, as one flattened message per diagnostic.
 *
 * `options` are spelled as in a tsconfig.json — `module: "esnext"`, not the API's enum —
 * because that is the one spelling both ways of asking can read.
 */
export async function diagnose(
  dir: string,
  files: readonly string[],
  options: Record<string, unknown>,
): Promise<string[]> {
  return otherCompiler
    ? await runCompiler(otherCompiler, dir, files, options)
    : callCompiler(dir, files, options);
}

function callCompiler(
  dir: string,
  files: readonly string[],
  json: Record<string, unknown>,
): string[] {
  const { options, errors } = ts.convertCompilerOptionsFromJson(json, dir);
  if (errors.length > 0) throw new Error(errors.map((d) => flatten(d.messageText)).join("\n"));
  const program = ts.createProgram(
    files.map((file) => join(dir, file)),
    options,
  );
  return ts.getPreEmitDiagnostics(program).map((d) => flatten(d.messageText));
}

function flatten(message: string | ts.DiagnosticMessageChain): string {
  return ts.flattenDiagnosticMessageText(message, "\n");
}

const run = promisify(execFile);

/** Where a printed diagnostic came from, which the API's flattened message leaves out. */
const location = /^(?:.*?\(\d+,\d+\): )?error TS\d+: /;

async function runCompiler(
  tsc: string,
  dir: string,
  files: readonly string[],
  options: Record<string, unknown>,
): Promise<string[]> {
  await writeFile(join(dir, "tsconfig.json"), JSON.stringify({ compilerOptions: options, files }));
  let printed: string;
  try {
    ({ stdout: printed } = await run(process.execPath, [tsc, "-p", dir, "--pretty", "false"]));
  } catch (error) {
    // It exits non-zero whenever it reports anything, which is most of what it is asked to
    // do here — so only an exit with nothing printed is a failure to run.
    const failed = error as { stdout?: string };
    if (!failed.stdout) throw error;
    printed = failed.stdout;
  }
  // One diagnostic per line that starts at the margin; its chain is indented under it.
  return printed
    .replace(/\r\n/g, "\n")
    .split(/\n(?=\S)/)
    .map((entry) => entry.replace(location, "").trimEnd())
    .filter((entry) => entry !== "");
}
