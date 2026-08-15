import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The dev-time check that turns "my styles silently don't apply" — the failure this
 * package exists to prevent — into a message that names the fix.
 *
 * Each case re-imports the module because the warning is deliberately once-per-
 * process.
 */

interface FakeDocument {
  readyState: string;
  documentElement: object;
}

function setupDom(markerValue: string, readyState = "complete") {
  const listeners: Array<() => void> = [];
  const document: FakeDocument = { readyState, documentElement: {} };
  vi.stubGlobal("document", document);
  vi.stubGlobal("window", {
    addEventListener: (_event: string, listener: () => void) => listeners.push(listener),
  });
  vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: () => markerValue }));
  return { document, listeners };
}

async function loadWithPrefix() {
  vi.resetModules();
  const { withPrefix } = await import("../../src/utils/prefix.js");
  return withPrefix;
}

let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  warn.mockRestore();
});

describe("integration check", () => {
  it("warns when the marker is missing, naming both integrations", async () => {
    setupDom("");
    const withPrefix = await loadWithPrefix();

    withPrefix("md", "text-lg");
    await vi.runAllTimersAsync();

    expect(warn).toHaveBeenCalledOnce();
    const message = String(warn.mock.calls[0]?.[0]);
    expect(message).toContain("[tailess]");
    expect(message).toContain("tailess/vite");
    expect(message).toContain("tailess/postcss");
  });

  it("stays quiet when the integration injected the marker", async () => {
    setupDom("1");
    const withPrefix = await loadWithPrefix();

    withPrefix("md", "text-lg");
    await vi.runAllTimersAsync();

    expect(warn).not.toHaveBeenCalled();
  });

  it("warns at most once no matter how many classes are built", async () => {
    setupDom("");
    const withPrefix = await loadWithPrefix();

    for (let i = 0; i < 50; i += 1) withPrefix("md", `p-${i}`);
    await vi.runAllTimersAsync();

    expect(warn).toHaveBeenCalledOnce();
  });

  it("never runs when no prefixed class is produced", async () => {
    setupDom("");
    const withPrefix = await loadWithPrefix();

    expect(withPrefix("md", "")).toBe("");
    expect(withPrefix("md", false)).toBe("");
    await vi.runAllTimersAsync();

    expect(warn).not.toHaveBeenCalled();
  });

  it("waits for window load before deciding stylesheets are missing", async () => {
    const { listeners } = setupDom("", "loading");
    const withPrefix = await loadWithPrefix();

    withPrefix("md", "text-lg");
    await vi.runAllTimersAsync();
    // Still loading: judging now would flag a stylesheet that simply hasn't
    // arrived yet.
    expect(warn).not.toHaveBeenCalled();
    expect(listeners).toHaveLength(1);

    listeners[0]?.();
    await vi.runAllTimersAsync();
    expect(warn).toHaveBeenCalledOnce();
  });

  it("does nothing on the server, where there is no document", async () => {
    vi.stubGlobal("document", undefined);
    vi.stubGlobal("window", undefined);
    const withPrefix = await loadWithPrefix();

    expect(withPrefix("md", "text-lg")).toBe("md:text-lg");
    await vi.runAllTimersAsync();

    expect(warn).not.toHaveBeenCalled();
  });
});

describe("server-side rendering", () => {
  it("does not spend the one-shot check on a render that had no document", async () => {
    // SSR reaches withPrefix too. If the server pass claimed the flag, the browser
    // pass — the only one that can observe the marker — would never warn, and a
    // missing integration would go back to being silent. That is the exact failure
    // this check exists to catch, so it must survive a server render first.
    const withPrefix = await loadWithPrefix();

    withPrefix("md", "text-lg"); // no window/document stubbed yet
    await vi.runAllTimersAsync();
    expect(warn).not.toHaveBeenCalled();

    // Now the same module reaches a browser without the marker.
    setupDom("");
    withPrefix("md", "text-lg");
    await vi.runAllTimersAsync();

    expect(warn).toHaveBeenCalledOnce();
    expect(String(warn.mock.calls[0]?.[0])).toContain("[tailess]");
  });
});
