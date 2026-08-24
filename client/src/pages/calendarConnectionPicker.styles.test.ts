import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("connected-calendar picker layout", () => {
  it("keeps long calendar names readable and switches to one column on compact screens", async () => {
    const styles = await readFile(new URL("./calendarConnectionPicker.css", import.meta.url), "utf8");
    expect(styles).toContain("minmax(min(100%, 270px), 1fr)");
    expect(styles).toContain("white-space: normal");
    expect(styles).toContain("grid-template-columns: 1fr");
  });
});
