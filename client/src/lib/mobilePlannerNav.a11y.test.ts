import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("MY PLAN compact-phone navigation", () => {
  it("keeps five labeled primary destinations and a separate, non-writing plan action", async () => {
    const source = await readFile(new URL("../pages/MobilePlannerNav.tsx", import.meta.url), "utf8");

    expect(source).toContain('aria-label="Primary mobile navigation"');
    expect(source).toContain('onOpen("calendar")');
    expect(source).toContain('onOpen("todo")');
    expect(source).toContain('onOpen("progress")');
    expect(source).toContain('onOpen("profile")');
    expect(source).toContain('onOpen("tools")');
    expect(source).toContain('aria-current={isWorkspaceToolsSection(activeSection) ? "page" : undefined}');
    expect(source).toContain('className="mobile-plan-action"');
    expect(source).toContain("onClick={onPlan}");
  });

  it("keeps the compact-phone controls clear of fixed feedback layers and honors safe areas", async () => {
    const styles = await readFile(new URL("../pages/mobilePlannerNav.css", import.meta.url), "utf8");

    expect(styles).toContain("env(safe-area-inset-bottom)");
    expect(styles).toContain(".notification-trigger");
    expect(styles).toContain(".active-timer");
    expect(styles).toContain("prefers-reduced-motion: no-preference");
  });
});
