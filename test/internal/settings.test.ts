import { twMerge } from "tailwind-merge";
import { afterEach, describe, expect, it, vi } from "vitest";
import { configure, firstTime } from "../../src/internal/settings.js";
import { cn } from "../../src/utils/cn.js";
import { withPrefix } from "../../src/utils/prefix.js";
import { ss } from "../../src/utils/ss.js";

/**
 * The two things a project may need to change, and the one that keeps a dev server
 * from leaking. Everything else about tailess is deliberately fixed.
 */

afterEach(() => {
  // Back to the shipped behaviour, so one test cannot change another's answer.
  configure({
    merge: twMerge,
    onWarn: (message) => {
      console.warn(message);
    },
  });
});

describe("configure({ merge })", () => {
  it("merges with tailwind-merge until told otherwise", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("takes a configured instance, which is what a custom @utility needs", () => {
    // tailwind-merge only knows Tailwind's own utilities, so `text-hero` from a
    // project's own theme does not displace `text-sm` — the winner ends up decided by
    // CSS source order rather than by argument order, which is cn's one guarantee.
    expect(cn("text-sm", "text-hero")).toBe("text-sm text-hero");
    configure({ merge: (classes) => classes.split(" ").slice(-1).join(" ") });
    expect(cn("text-sm", "text-hero")).toBe("text-hero");
  });

  it("can skip merging entirely", () => {
    configure({ merge: (classes) => classes });
    expect(cn("px-2", "px-4")).toBe("px-2 px-4");
  });

  it("applies to ss too, since everything ends there", () => {
    configure({ merge: (classes) => classes });
    expect(ss({ base: "p-2 p-4" })).toBe("p-2 p-4");
  });
});

describe("configure({ onWarn })", () => {
  it("sends warnings where it is told", () => {
    const seen: string[] = [];
    configure({ onWarn: (message) => seen.push(message) });
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    withPrefix("has-[data-x=a b]", "p-4");
    expect(seen).toHaveLength(1);
    expect(seen[0]).toContain("contains whitespace");
    // And not to the console, which is the point of redirecting them.
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("can be made fatal, for a CI run that should not ship an unstyled class", () => {
    configure({
      onWarn: (message) => {
        throw new Error(message);
      },
    });
    expect(() => withPrefix("has-[data-y=a b]", "p-4")).toThrow(/contains whitespace/);
  });

  it("can be silenced", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    configure({ onWarn: () => {} });
    withPrefix("has-[data-z=a b]", "p-4");
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("the memo behind once-per-process warnings", () => {
  it("says yes once, then no", () => {
    const seen = new Set<string>();
    expect(firstTime(seen, "a")).toBe(true);
    expect(firstTime(seen, "a")).toBe(false);
    expect(firstTime(seen, "b")).toBe(true);
  });

  it("is bounded, so a long-lived dev server does not grow one warning at a time", () => {
    // `has(userInput)` on an SSR process in development is enough to see a fresh value
    // on every request; an unbounded set of every value ever seen grows with it.
    const seen = new Set<string>();
    for (let i = 0; i < 5_000; i += 1) firstTime(seen, `value-${i}`);
    expect(seen.size).toBeLessThanOrEqual(500);
  });

  it("keeps warning after a wrap rather than going quiet", () => {
    // Clearing rather than refusing to add: the worst that happens is one warning
    // prints a second time, which is far better than a real one never printing.
    const seen = new Set<string>();
    for (let i = 0; i < 600; i += 1) firstTime(seen, `value-${i}`);
    expect(firstTime(seen, "value-0")).toBe(true);
  });
});
