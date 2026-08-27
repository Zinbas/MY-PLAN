import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("MY PLAN compact-phone navigation", () => {
  it("uses the APK-inspired Today, Calendar, Add, To-do, and More navigation pattern", async () => {
    const source = await readFile(new URL("../pages/MobilePlannerNav.tsx", import.meta.url), "utf8");

    expect(source).toContain('aria-label="Primary mobile navigation"');
    expect(source).toContain("onToday");
    expect(source).toContain('onOpen("calendar")');
    expect(source).toContain('className="mobile-capture"');
    expect(source).toContain("Add a plan item on the selected date");
    expect(source).toContain('onOpen("todo")');
    expect(source).toContain("More in MY PLAN");
  });

  it("keeps Progress, Profile, and Workspace inside an accessible contextual More menu", async () => {
    const source = await readFile(new URL("../pages/MobilePlannerNav.tsx", import.meta.url), "utf8");
    const styles = await readFile(new URL("../pages/mobilePlannerNav.css", import.meta.url), "utf8");

    expect(source).toContain('aria-label="More planning destinations"');
    expect(source).toContain('onClick={() => openMoreSection("progress")}');
    expect(source).toContain('onClick={() => openMoreSection("profile")}');
    expect(source).toContain('onClick={() => openMoreSection("tools")}');
    expect(source).toContain('aria-expanded={moreOpen}');
    expect(styles).toContain("env(safe-area-inset-bottom)");
    expect(styles).toContain(".notification-trigger");
    expect(styles).toContain(".active-timer");
    expect(styles).toContain("prefers-reduced-motion: no-preference");
  });
});
