import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("mobile date-action sheet dismissal", () => {
  it("keeps close, backdrop, swipe-down, and browser Back dismissal paths available", async () => {
    const source = await readFile(new URL("../pages/Home.tsx", import.meta.url), "utf8");
    const styles = await readFile(new URL("../index.css", import.meta.url), "utf8");

    expect(source).toContain("window.history.pushState");
    expect(source).toContain('window.addEventListener("popstate", closeOnHistoryBack)');
    expect(source).toContain('aria-label="Close planning actions"');
    expect(source).toContain("event.clientY - start > 72");
    expect(source).toContain("event.target === event.currentTarget");
    expect(styles).toContain(".mobile-date-sheet-close");
    expect(styles).toContain("touch-action:pan-y");
  });

  it("keeps the compact-phone header branded and removes the redundant Today item", async () => {
    const source = await readFile(new URL("../pages/Home.tsx", import.meta.url), "utf8");
    const styles = await readFile(new URL("../index.css", import.meta.url), "utf8");

    expect(source).toContain('className="mobile-header-brand"');
    expect(source).toContain("Go to today in MY PLAN");
    expect(styles).toContain(".top-actions .topbar-today{display:none!important}");
  });
});
