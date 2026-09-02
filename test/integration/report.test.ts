import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FileDiagnostic } from "../../src/extract/collect.js";
import { clearReported, reportDiagnostics } from "../../src/integration/report.js";

/**
 * A dev server rescans on every keystroke. Printing the same problem each time would
 * bury the one line the developer is actually looking for, so the reporter remembers
 * what it has said — and this pins that, because the failure is invisible in a unit
 * test of the diagnostics themselves.
 */

afterEach(() => {
  clearReported();
  vi.restoreAllMocks();
});

const root = join("C:", "project");
const diagnostic = (message: string, file = join(root, "src", "Card.tsx")): FileDiagnostic => ({
  kind: "dead-class",
  message,
  file,
});

describe("reportDiagnostics", () => {
  it("prints a problem once, however many rebuilds ask", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    for (let i = 0; i < 5; i += 1) reportDiagnostics([diagnostic("p-4 is dead")], root);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("prints the path relative to the project, not the absolute one", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    reportDiagnostics([diagnostic("p-4 is dead")], root);
    const [line] = warn.mock.calls[0] as [string];
    expect(line).toContain(join("src", "Card.tsx"));
    expect(line).not.toContain(root);
    expect(line.startsWith("[tailess] ")).toBe(true);
  });

  it("tells two files apart even when the problem is identical", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    reportDiagnostics(
      [
        diagnostic("p-4 is dead", join(root, "src", "A.tsx")),
        diagnostic("p-4 is dead", join(root, "src", "B.tsx")),
      ],
      root,
    );
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it("falls back to the full path when the file is outside the project", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    // A monorepo `content` can point at a sibling package.
    reportDiagnostics([diagnostic("p-4 is dead", join(root, "..", "ui", "B.tsx"))], root);
    const [line] = warn.mock.calls[0] as [string];
    expect(line).toContain("B.tsx");
  });

  it("says nothing when there is nothing to say", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    reportDiagnostics([], root);
    expect(warn).not.toHaveBeenCalled();
  });
});
