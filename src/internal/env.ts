// Environment-agnostic access to NODE_ENV without pulling in Node globals.
declare const process: { env?: Record<string, string | undefined> } | undefined;

/** True unless explicitly running in a production build. Drives dev-only warnings. */
export const isDev = typeof process !== "undefined" && process?.env?.NODE_ENV !== "production";
