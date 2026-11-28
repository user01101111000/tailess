import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { watch } from "../../src/internal/rules.js";
import { firstTime } from "../../src/internal/settings.js";

/**
 * The dev-time check that a variant class on the page has a CSS rule — the one silent
 * failure `tailess check` cannot see, because a spread or a computed key enumerates
 * nothing for it to fail.
 *
 * The bar is the package's own: a warning that fires on working code is a bug. So most
 * of these are the quiet half — a rule wrapped in every shape Tailwind writes one, a
 * stylesheet still on its way after a save, one this page is not allowed to read.
 */

interface FakeRule {
  selectorText?: string;
  style?: { getPropertyValue(name: string): string };
  cssRules?: FakeRule[];
  styleSheet?: FakeSheet;
}

interface FakeSheet {
  cssRules: FakeRule[];
}

function rule(selectorText: string, declarations: Record<string, string> = {}): FakeRule {
  return { selectorText, style: { getPropertyValue: (name) => declarations[name] ?? "" } };
}

const marker = rule(":root", { "--tailess": "1" });

/** A stylesheet from another origin, which the browser will not let a script read. */
function foreign(): FakeSheet {
  return {
    get cssRules(): FakeRule[] {
      throw new Error("SecurityError: cannot access rules");
    },
  };
}

/** `CSS.escape` as the CSSOM spec defines it — which is how a browser serializes a class. */
function cssEscape(value: string): string {
  let out = "";
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    const digit = code >= 48 && code <= 57;
    if ((code >= 1 && code <= 31) || code === 127 || (i === 0 && digit)) {
      out += `\\${code.toString(16)} `;
    } else if (i === 1 && digit && value.charCodeAt(0) === 45) {
      out += `\\${code.toString(16)} `;
    } else if (
      code >= 128 ||
      code === 45 ||
      code === 95 ||
      digit ||
      (code >= 65 && code <= 90) ||
      (code >= 97 && code <= 122)
    ) {
      out += value[i];
    } else {
      out += `\\${value[i]}`;
    }
  }
  return out;
}

/**
 * A page: its stylesheets, the class list of each element on it, and the custom
 * properties its root element computes — where the build marks what it saw.
 */
function page(sheets: FakeSheet[], elements: string[][], root: Record<string, string> = {}) {
  let notify: ((records: Array<{ type: string; addedNodes: unknown[] }>) => void) | undefined;
  vi.stubGlobal("getComputedStyle", () => ({
    getPropertyValue: (name: string) => root[name] ?? "",
  }));
  vi.stubGlobal("document", {
    documentElement: {},
    styleSheets: sheets,
    querySelectorAll: () =>
      elements
        .filter((list) => list.some((cls) => cls.includes(":")))
        .map((list) => ({ classList: list })),
  });
  vi.stubGlobal(
    "MutationObserver",
    class {
      constructor(callback: typeof notify) {
        notify = callback;
      }
      observe(): void {}
    },
  );
  vi.stubGlobal("CSS", { escape: cssEscape });
  return {
    elements,
    /** The page changed: an element arrived, or a class did. */
    changed: (type = "attributes") => notify?.([{ type, addedNodes: [] }]),
  };
}

let warn: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  warn = vi.fn();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** Start the check; `configured` is whether `configure()` set a merge or keys here. */
function start(configured = false): void {
  watch("--tailess", warn as (message: string) => void, firstTime, () => configured);
}

describe("the configure() the build saw", () => {
  // A root layout that calls it runs on the server alone. The browser then merges with
  // the defaults and does not know the keys, and React's hydration error was all anyone
  // saw of it.
  it("is reported when it never ran in this browser, with where to call it", () => {
    page([{ cssRules: [marker] }], [], { "--tailess-configure": "1" });
    start(false);

    expect(warn).toHaveBeenCalledOnce();
    const message = String(warn.mock.calls[0]?.[0]);
    expect(message).toContain("calls configure() with a merge or keys");
    expect(message).toContain("has not run in this browser");
    expect(message).toContain("instrumentation-client.ts");
    expect(message).toContain("#on-nextjs-and-anywhere-else-that-renders-on-the-server");
  });

  it("is quiet once it ran here", () => {
    page([{ cssRules: [marker] }], [], { "--tailess-configure": "1" });
    start(true);
    expect(warn).not.toHaveBeenCalled();
  });

  it("is quiet when the build saw no such call", () => {
    page([{ cssRules: [marker] }], []);
    start(false);
    expect(warn).not.toHaveBeenCalled();
  });
});

describe("a class on the page with no rule", () => {
  it("is named, with the reason and where to read more", async () => {
    page([{ cssRules: [marker, rule(".md\\:p-4")] }], [["md:p-7", "md:p-4"]]);
    start();

    await vi.advanceTimersByTimeAsync(1000);
    expect(warn).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(6000);

    expect(warn).toHaveBeenCalledOnce();
    const message = String(warn.mock.calls[0]?.[0]);
    expect(message).toContain('No CSS rule for "md:p-7"');
    expect(message).not.toContain("md:p-4");
    expect(message).toContain("literals at the call site");
    expect(message).toContain("#what-the-scanner-can-and-cannot-see");
  });

  it("is not answered for by a rule for a longer class", async () => {
    page([{ cssRules: [marker, rule(".md\\:p-70"), rule(".md\\:p-7x")] }], [["md:p-7"]]);
    start();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(warn).toHaveBeenCalledOnce();
  });

  it("is reported once, and the ones found in the same check together", async () => {
    const { changed } = page([{ cssRules: [marker] }], [["md:p-7"], ["lg:grid", "md:p-7"]]);
    start();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(warn).toHaveBeenCalledOnce();
    expect(String(warn.mock.calls[0]?.[0])).toContain('"md:p-7", "lg:grid"');

    // The component keeps rendering it.
    changed();
    await vi.advanceTimersByTimeAsync(20_000);
    expect(warn).toHaveBeenCalledOnce();
  });

  it("is found when the page changes to show it", async () => {
    const { elements, changed } = page([{ cssRules: [marker] }], []);
    start();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(warn).not.toHaveBeenCalled();

    elements.push(["md:p-7"]);
    changed();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(warn).toHaveBeenCalledOnce();
  });

  it("reads past a web font's @import from another origin", async () => {
    // The `@import` is the first rule of Tailwind's own stylesheet. Reading it throws, and
    // a check that let that throw lose the whole sheet would never find the marker again.
    page(
      [{ cssRules: [{ styleSheet: foreign() }, marker, rule(".md\\:p-4")] }],
      [["md:p-4"], ["md:p-7"]],
    );
    start();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(warn).toHaveBeenCalledOnce();
    expect(String(warn.mock.calls[0]?.[0])).toContain('"md:p-7"');
  });
});

describe("staying quiet", () => {
  it("finds a rule in every shape Tailwind writes one", async () => {
    const shapes: Array<[string, string]> = [
      ["md:p-7", ".md\\:p-7"],
      ["md:space-y-8", ":where(.md\\:space-y-8>:not(:last-child))"],
      ["2xl:flex", ".\\32 xl\\:flex"],
      ["[&>p]:mt-2", ".\\[\\&\\>p\\]\\:mt-2>p"],
      ["md:p-0.5", ".md\\:p-0\\.5"],
      [
        "group-hover/row:underline",
        ".group-hover\\/row\\:underline:is(:where(.group\\/row):hover *)",
      ],
      ["has-[>_img]:p-0", ".has-\\[\\>_img\\]\\:p-0:has(>img)"],
      ["after:content-['→']", ".after\\:content-\\[\\'→\\'\\]::after"],
      ["md:p-6!", ".md\\:p-6\\!"],
    ];
    // And one nested the way `@media` and `@layer` nest them.
    const nested: FakeRule = { cssRules: [{ cssRules: [rule(".lg\\:grid")] }] };
    page(
      [{ cssRules: [marker, ...shapes.map(([, selector]) => rule(selector)), nested] }],
      [...shapes.map(([cls]) => [cls]), ["lg:grid"]],
    );
    start();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(warn).not.toHaveBeenCalled();
  });

  it("waits out a stylesheet still on its way after a save", async () => {
    // The edit re-renders at once; the rebuilt CSS lands a second or two later — two and a
    // half under webpack, measured. That class is fine, only late.
    const sheet: FakeSheet = { cssRules: [marker] };
    const { changed } = page([sheet], [["md:p-7"]]);
    start();
    await vi.advanceTimersByTimeAsync(3000);
    sheet.cssRules.push(rule(".md\\:p-7"));
    changed("childList");
    await vi.advanceTimersByTimeAsync(20_000);
    expect(warn).not.toHaveBeenCalled();
  });

  it("forgets a class that leaves the page before it is reported", async () => {
    const { elements, changed } = page([{ cssRules: [marker] }], [["md:p-7"]]);
    start();
    await vi.advanceTimersByTimeAsync(3000);
    elements.length = 0;
    changed();
    await vi.advanceTimersByTimeAsync(3000);
    // Back again: its five seconds start over.
    elements.push(["md:p-7"]);
    changed();
    await vi.advanceTimersByTimeAsync(3000);
    expect(warn).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(4000);
    expect(warn).toHaveBeenCalledOnce();
  });

  it("has nothing to prove when no stylesheet it can read carries the marker", async () => {
    // Integration missing — which the marker check reports — or Tailwind's output served
    // from another origin, as Laravel serves it from the Vite dev server.
    page([foreign(), { cssRules: [rule(".card")] }], [["md:p-7"]]);
    start();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(warn).not.toHaveBeenCalled();
  });

  it("leaves a class without a colon alone", async () => {
    // Plain Tailwind's business — and one with no rule is as likely a hook for a script.
    page([{ cssRules: [marker] }], [["card", "js-toggle", "is-open"]]);
    start();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(warn).not.toHaveBeenCalled();
  });

  it("does not wake for text that changes inside an element", () => {
    const { changed } = page([{ cssRules: [marker] }], []);
    start();
    vi.runOnlyPendingTimers();
    changed("characterData");
    expect(vi.getTimerCount()).toBe(0);
    changed("attributes");
    expect(vi.getTimerCount()).toBe(1);
  });
});
