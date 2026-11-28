import { configure } from "tailess";

// Runs once per side, before a route builds a class: app/root.tsx imports it first, and
// the root module is loaded by the server render and by the browser alike. Configured on
// one side only, the other merges with the defaults and the page fails to hydrate.
configure({ keys: ["3xl"] });
