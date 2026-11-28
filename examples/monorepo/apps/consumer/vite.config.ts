import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// This app uses the design system the way it would from npm: its build, not its source.
// No tailess plugin, and no scan of @acme/ui — its stylesheet brings what it needs.
export default defineConfig({
  plugins: [react(), tailwindcss()],
});
