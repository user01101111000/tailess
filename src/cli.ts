#!/usr/bin/env node
/// <reference types="node" />
import { help, parse, run } from "./check/run.js";

/**
 * The `tailess` binary. Everything it does lives in `check/run.ts`, so the parts
 * worth testing can be called directly — importing this file would run it.
 */
async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  // `tailess check` and a bare `tailess` are the same thing; there is only one command.
  const command = argv[0] === "check" ? argv.slice(1) : argv;
  try {
    const parsed = parse(command);
    if (parsed === "help") {
      console.log(help);
      return 0;
    }
    return await run(parsed);
  } catch (error) {
    console.error(`[tailess] ${error instanceof Error ? error.message : String(error)}`);
    console.error(`\n${help}`);
    return 2;
  }
}

main().then((code) => {
  process.exitCode = code;
});
