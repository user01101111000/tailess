#!/usr/bin/env node
/// <reference types="node" />
import { help, parse, run, version } from "./check/run.js";

/**
 * The `tailess` binary. Everything it does lives in `check/run.ts`, so the parts
 * worth testing can be called directly — importing this file would run it. The
 * subcommand is read there too, which keeps this file to argv in, exit code out.
 */
async function main(): Promise<number> {
  try {
    const parsed = parse(process.argv.slice(2));
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
    console.error(`[tailess] ${error instanceof Error ? error.message : String(error)}`);
    console.error(`\n${help}`);
    return 2;
  }
}

main().then((code) => {
  process.exitCode = code;
});
