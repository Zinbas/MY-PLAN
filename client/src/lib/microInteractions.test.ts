import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("MY PLAN micro-interaction safeguards", () => {
  it("limits the extra motion to state feedback and includes a reduced-motion fallback", async () => {
    const styles = await readFile(new URL("../index.css", import.meta.url), "utf8");
    expect(styles).toContain("my-plan-nav-settle");
    expect(styles).toContain("my-plan-date-select");
    expect(styles).toContain("my-plan-notification-pop");
    expect(styles).toContain("my-plan-completion-settle");
    expect(styles).toContain("@media (prefers-reduced-motion:reduce)");
  });
});
