import { configure } from "tailess";

// Runs once per side, before the app renders: app/plugins/tailess.ts imports it, and Nuxt
// runs a plugin on the server and in the browser alike. Configured on one side only, the
// other merges with the defaults and the page fails to hydrate.
configure({ keys: ["3xl"] });
