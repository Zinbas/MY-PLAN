import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("MY PLAN paper-mark loader animation", () => {
  it("uses a smooth circle-and-logo settle, soft halo, and subtle logo pulse without a filling sweep line", async () => {
    const styles = await readFile(new URL("../pages/loader.css", import.meta.url), "utf8");

    expect(styles).toContain(".loader-mark");
    expect(styles).toContain("border-radius:50%");
    expect(styles).toContain(".loader-paper-halo");
    expect(styles).toContain(".loader-stamp-pulse");
    expect(styles).toContain("@keyframes loader-stamp-settle");
    expect(styles).toContain("@keyframes loader-logo-pulse");
    expect(styles).toContain("animation:loader-logo-pulse 3.6s");
    expect(styles).toContain("animation:loader-paper-halo 3.2s");
    expect(styles).not.toContain("loader-ink-sweep");
    expect(styles).not.toContain("conic-gradient");
    expect(styles).toContain("@media (prefers-reduced-motion:no-preference)");
  });
});
