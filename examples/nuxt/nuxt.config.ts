import tailwindcss from "@tailwindcss/vite";
import tailess from "tailess/vite";

// The whole integration: one line beside the Tailwind plugin. Order does not matter.
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  css: ["~/assets/css/main.css"],
  vite: {
    plugins: [tailwindcss(), tailess({ diagnostics: "error" })],
  },
});
