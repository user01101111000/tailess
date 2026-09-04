import { defineConfig } from "tsup";

const shared = {
  format: ["esm", "cjs"] as const,
  tsconfig: "tsconfig.build.json",
  sourcemap: true,
  treeshake: true,
  minify: false,
  // Keep the `node:` prefix the source is written with. tsup strips it by default
  // for pre-Node-14 compatibility, turning `node:fs/promises` into bare
  // `fs/promises` — which Node still resolves, but which reads as an npm package to
  // bundlers and to non-Node runtimes.
  removeNodeProtocol: false,
};

export default defineConfig([
  {
    ...shared,
    entry: {
      index: "src/index.ts",
      "postcss/index": "src/postcss/index.ts",
      "vite/index": "src/vite/index.ts",
    },
    format: ["esm", "cjs"],
    dts: true,
    clean: true,
    outExtension({ format }) {
      return { js: format === "cjs" ? ".cjs" : ".js" };
    },
  },
  {
    ...shared,
    // The CLI is ESM only and has no types worth emitting: `bin` names one file and
    // nothing imports it. Building the CJS copy and its sourcemap too added 175 kB to
    // the tarball that nothing could ever load.
    entry: { cli: "src/cli.ts" },
    format: ["esm"],
    dts: false,
    // No sourcemap either: standing alone it cannot share the library chunks, so its
    // map is larger than the code, and a stack trace from a CLI points at a file the
    // user is not going to debug.
    sourcemap: false,
    // `clean` belongs to the first config; running it here would delete what that one
    // just wrote. The shebang is already the first line of `src/cli.ts`; tsup keeps it.
    clean: false,
  },
]);
