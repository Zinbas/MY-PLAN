import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("mobile fixed control stack", () => {
  it("moves the notification trigger above a running timer and retains 44px calendar navigation targets on compact screens", () => {
    const css = readFileSync(new URL("../index.css", import.meta.url), "utf8");
    const home = readFileSync(new URL("../pages/Home.tsx", import.meta.url), "utf8");
    expect(home).toContain('activeTimer ? "has-active-timer" : ""');
    expect(css).toContain(".ongoing-shell.has-active-timer .notification-trigger{bottom:132px}");
    expect(css).toContain(".cursor-controls button{width:44px;height:44px;min-width:44px;min-height:44px}");
  });
});
