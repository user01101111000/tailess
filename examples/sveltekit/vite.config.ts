import adapter from "@sveltejs/adapter-auto";
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import tailess from "tailess/vite";
import { defineConfig } from "vite";

// The whole integration: one line beside the Tailwind plugin. Order does not matter.
export default defineConfig({
  plugins: [
    tailwindcss(),
    tailess({ diagnostics: "error" }),
    sveltekit({
      compilerOptions: {
        // The template's default: runes everywhere but in libraries.
        runes: ({ filename }) =>
          filename.split(/[/\\]/).includes("node_modules") ? undefined : true,
      },
      adapter: adapter(),
    }),
  ],
});
