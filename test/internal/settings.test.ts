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
    keys: [],
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

  it("sees a warning that already fired, which is what makes it usable in a test", () => {
    // Warnings are reported once per process, so a collector installed after the code
    // under test had already warned stayed empty — and the assertion passed while
    // asserting nothing, which is worse than failing. The three tests above only avoid it
    // by using a different value each; a real suite has no such luxury.
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    withPrefix("has-[data-same=a b]", "p-4");
    expect(spy).toHaveBeenCalledTimes(1);

    const seen: string[] = [];
    configure({ onWarn: (message) => seen.push(message) });
    withPrefix("has-[data-same=a b]", "p-4");
    expect(seen).toHaveLength(1);
    spy.mockRestore();
  });

  it("still reports a repeated warning only once for the collector it was given", () => {
    const seen: string[] = [];
    configure({ onWarn: (message) => seen.push(message) });
    withPrefix("has-[data-twice=a b]", "p-4");
    withPrefix("has-[data-twice=a b]", "p-4");
    expect(seen).toHaveLength(1);
  });
});

describe("a merge function that does not return a string", () => {
  it('says so and falls back to the unmerged classes, rather than class="undefined"', () => {
    // `merge` is the consumer's code now, and one that falls off the end of a branch
    // hands React a class attribute with nothing to debug.
    const seen: string[] = [];
    configure({ onWarn: (message) => seen.push(message) });
    configure({ merge: (() => undefined) as unknown as (classes: string) => string });
    expect(cn("px-2", "px-4")).toBe("px-2 px-4");
    expect(seen[0]).toContain("not a string");
  });
});

describe("configure({ keys })", () => {
  it("emits declared keys in the order given, not the order they were written", () => {
    // The docs promise "after the built-in keys, in the order given ... a stable position
    // is what `tailwind-merge` needs". Every declared key shared one rank, and the sort is
    // stable, so the emitted order was the object literal's — two components declaring the
    // same two keys the other way round emitted them the other way round, and which won a
    // merge conflict depended on how someone typed an object.
    configure({ keys: ["aaa", "zzz"] });
    expect(ss({ base: "p-1", zzz: "p-2", aaa: "p-3" } as never)).toBe("p-1 aaa:p-3 zzz:p-2");
    expect(ss({ base: "p-1", aaa: "p-3", zzz: "p-2" } as never)).toBe("p-1 aaa:p-3 zzz:p-2");

    configure({ keys: ["zzz", "aaa"] });
    expect(ss({ aaa: "p-3", zzz: "p-2" } as never)).toBe("zzz:p-2 aaa:p-3");
  });

  it("still emits declared keys after every built-in one", () => {
    configure({ keys: ["zzz"] });
    expect(ss({ hover: "p-2", zzz: "p-3", base: "p-1" } as never)).toBe("p-1 hover:p-2 zzz:p-3");
  });

  it("leaves keys nobody declared in the order written", () => {
    configure({ keys: [] });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(ss({ yyy: "p-2", xxx: "p-3" } as never)).toBe("yyy:p-2 xxx:p-3");
    warn.mockRestore();
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
