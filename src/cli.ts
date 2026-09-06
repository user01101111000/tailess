#!/usr/bin/env node
/// <reference types="node" />
import { commandIn, help, jsonResult, parse, run, version } from "./check/run.js";

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
    console.error(`\n${help}`);
    return 2;
  }
}

main().then((code) => {
  process.exitCode = code;
});
