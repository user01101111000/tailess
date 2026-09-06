/**
 * The one shape every command answers in under `--json`.
 *
 * Its own module rather than a helper inside `run.ts`, because `setup.ts` needs it too
 * and `run.ts` already imports `setup.ts` — a cycle between the two would work and read
 * badly. `--json` is documented as "one JSON object instead of prose" and the exit-code
 * table calls `2` the one worth an alert, so a path that answers with prose, or with
 * nothing, hands the job that followed that advice a parse error instead of a finding.
 */

/** The four subcommands, in one place: the parser reads them, so does the crash handler. */
export const commands = ["check", "emit", "init", "doctor"] as const;

/** Which command ran. */
export type Command = (typeof commands)[number];

/**
 * The subcommand `argv` names, or `check` — which a bare `tailess …` means.
 *
 * Read from argv rather than from parsed options because the binary's catch has to name
 * the command after a throw that may have come from the parser itself.
 */
export function commandIn(argv: readonly string[]): Command {
  const first = argv[0];
  return (commands as readonly string[]).includes(first ?? "") ? (first as Command) : "check";
}

/** The JSON form of a result. */
export function jsonResult(command: Command, code: number, body: Record<string, unknown>): string {
  return JSON.stringify({ tailess: 1, command, ok: code === 0, code, ...body });
}
