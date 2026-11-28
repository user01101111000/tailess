import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import tailess from "tailess/vite";
import { defineConfig } from "vite";

// The whole integration: one line beside the Tailwind plugin. Order does not matter.
export default defineConfig({
  plugins: [tailwindcss(), tailess({ diagnostics: "error" }), reactRouter()],
  resolve: {
    tsconfigPaths: true,
  },
});
