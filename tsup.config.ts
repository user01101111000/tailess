import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "postcss/index": "src/postcss/index.ts",
    "vite/index": "src/vite/index.ts",
  },
  format: ["esm", "cjs"],
  tsconfig: "tsconfig.build.json",
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  minify: false,
  // Keep the `node:` prefix the source is written with. tsup strips it by default
  // for pre-Node-14 compatibility, turning `node:fs/promises` into bare
  // `fs/promises` — which Node still resolves, but which reads as an npm package to
  // bundlers and to non-Node runtimes.
  removeNodeProtocol: false,
  outExtension({ format }) {
    return { js: format === "cjs" ? ".cjs" : ".js" };
  },
});
