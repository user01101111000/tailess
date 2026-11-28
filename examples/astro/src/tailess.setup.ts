import { configure } from "tailess";

// The page imports this first, on the server — the only side there is here. An Astro page
// ships no JavaScript, so its classes are built while it renders and never in a browser.
// A framework island would be a second side: import this in the island's module too.
configure({ keys: ["3xl"] });
