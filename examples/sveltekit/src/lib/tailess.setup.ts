import { configure } from "tailess";

// Runs once per side, before any route builds a class: src/hooks.server.ts imports it for
// the server render, src/hooks.client.ts for the browser. Configured on one side only,
// the other merges with the defaults and the page fails to hydrate.
configure({ keys: ["3xl"] });
