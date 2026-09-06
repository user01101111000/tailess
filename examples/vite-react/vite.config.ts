import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tailess from "tailess/vite";
import { defineConfig } from "vite";

// The whole integration: one line beside the Tailwind plugin. Order does not matter.
export default defineConfig({
  plugins: [react(), tailwindcss(), tailess({ diagnostics: "error" })],
});
