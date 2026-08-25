import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("constrained laptop calendar layout", () => {
  it("stacks the selected-day panel and wraps filters before their controls can overlap", () => {
    const css = readFileSync(new URL("../index.css", import.meta.url), "utf8");
    expect(css).toContain("@media (max-width:1180px) and (min-width:821px)");
    expect(css).toContain(".calendar-layout{grid-template-columns:minmax(0,1fr)");
    expect(css).toContain(".calendar-filters{flex-wrap:wrap");
  });
});
