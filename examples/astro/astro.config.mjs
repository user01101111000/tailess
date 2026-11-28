// @ts-check
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import tailess from "tailess/vite";

// The whole integration: one line beside the Tailwind plugin. Order does not matter.
export default defineConfig({
  vite: {
    plugins: [tailwindcss(), tailess({ diagnostics: "error" })],
  },
});
