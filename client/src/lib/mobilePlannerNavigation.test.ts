import { describe, expect, it } from "vitest";
import { mobilePlannerDestinations, mobileSurfaceFor } from "./mobilePlannerNavigation";

describe("mobile planner navigation", () => {
  it("keeps four stable primary destinations for compact screens", () => {
    expect(mobilePlannerDestinations.map(item => item.surface)).toEqual(["today", "calendar", "todo", "more"]);
  });

  it("routes workspaces into the intended mobile surface", () => {
    expect(mobileSurfaceFor("calendar")).toBe("today");
    expect(mobileSurfaceFor("todo")).toBe("todo");
    expect(mobileSurfaceFor("reminders")).toBe("more");
  });
});
