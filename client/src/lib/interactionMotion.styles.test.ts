import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("MY PLAN interaction motion system", () => {
  it("covers page changes, feedback, layered pop-ups, control press states, and reduced-motion preferences", async () => {
    const css = await readFile(new URL("../pages/interactionMotion.css", import.meta.url), "utf8");
    expect(css).toContain("section-stage-in");
    expect(css).toContain("feedback-pulse");
    expect(css).toContain("dialog-rise");
    expect(css).toContain("sheet-rise");
    expect(css).toContain("button:not(:disabled):active");
    expect(css).toContain("prefers-reduced-motion: reduce");
  });
});
