import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("MY PLAN paper-mark loader animation", () => {
  it("uses an app-inspired logo settle, paper halo, and restrained ink sweep with reduced-motion safeguards", async () => {
    const styles = await readFile(new URL("../pages/loader.css", import.meta.url), "utf8");

    expect(styles).toContain(".loader-mark");
    expect(styles).toContain("border-radius:50%");
    expect(styles).toContain(".loader-paper-halo");
    expect(styles).toContain(".loader-ink-sweep");
    expect(styles).toContain("@keyframes loader-stamp-settle");
    expect(styles).toContain("@keyframes loader-ink-sweep");
    expect(styles).toContain("animation:loader-ink-sweep 2.35s");
    expect(styles).toContain("@media (prefers-reduced-motion:no-preference)");
  });
});
