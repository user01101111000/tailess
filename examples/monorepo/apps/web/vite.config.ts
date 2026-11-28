import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import tailess from "tailess/vite";
import { defineConfig } from "vite";

// This app compiles the design system from its source, as most monorepos do: the alias
// points `@acme/ui` at packages/ui/src rather than at its build.
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // `content` replaces the default — Vite's root — so this app's own src is listed too.
    tailess({ content: ["src", "../../packages/ui/src"], diagnostics: "error" }),
  ],
  resolve: {
    alias: {
      "@acme/ui": fileURLToPath(new URL("../../packages/ui/src/index.ts", import.meta.url)),
    },
  },
});
