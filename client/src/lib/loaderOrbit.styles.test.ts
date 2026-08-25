import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("MY PLAN loader orbit animation", () => {
  it("uses a circular logo, a white orbit strip, and a reduced-motion-safe animation rule", async () => {
    const styles = await readFile(new URL("../pages/loader.css", import.meta.url), "utf8");

    expect(styles).toContain(".loader-mark");
    expect(styles).toContain("border-radius:50%");
    expect(styles).toContain(".loader-orbit");
    expect(styles).toContain("rgba(255,255,255,.98)");
    expect(styles).toContain("@keyframes loader-orbit");
    expect(styles).toContain("animation:loader-orbit 1.35s linear infinite");
    expect(styles).toContain("@media (prefers-reduced-motion:no-preference)");
  });
});
