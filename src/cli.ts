#!/usr/bin/env node
import { commandIn, jsonResult } from "./check/result.js";
/// <reference types="node" />
import { help, parse, run, UsageError, version } from "./check/run.js";

/**
 * The `tailess` binary. Everything it does lives in `check/run.ts`, so the parts
 * worth testing can be called directly — importing this file would run it. The
 * subcommand is read there too, which keeps this file to argv in, exit code out.
 */
async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  // Read straight from argv, before anything that could throw — including `parse` itself.
  // A crash still has to answer in the shape the caller asked for: a job running
  // `tailess check --json | jq -e .ok` otherwise gets a parse error on exactly the exit
  // path the README says is worth an alert, which reads as a broken pipeline rather than
  // as a finding.
  const asJson = argv.includes("--json");
  try {
    const parsed = parse(argv);
    if (parsed === "help") {
      console.log(help);
      return 0;
    }
    if (parsed === "version") {
      console.log(await version());
      return 0;
    }
    return await run(parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (asJson) {
      console.log(jsonResult(commandIn(argv), 2, { error: "crashed", message }));
      return 2;
    }
    console.error(`[tailess] ${message}`);
    // Usage text answers a usage error. After "tailwindcss is not installed here" it is
    // thirty lines that bury the one useful one and point the reader at flags that were
    // never the problem.
    if (error instanceof UsageError) console.error(`\n${help}`);
    return 2;
  }
}

main().then((code) => {
  process.exitCode = code;
});
