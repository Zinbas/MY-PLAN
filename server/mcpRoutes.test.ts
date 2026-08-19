import { describe, expect, it } from "vitest";
import { handleDemoMcpRequest } from "./mcpRoutes";

describe("demonstration MCP endpoint", () => {
  it("advertises the two safe demonstration tools", () => {
    const response = handleDemoMcpRequest({ id: 1, method: "tools/list" });
    expect(response).toMatchObject({ jsonrpc: "2.0", id: 1 });
    expect((response as any).result.tools).toHaveLength(2);
  });

  it("returns an honest activation status instead of claiming Google access", () => {
    const response = handleDemoMcpRequest({ id: 2, method: "tools/call", params: { name: "get_calendar_connection_status" } }) as any;
    expect(response.result.content[0].text).toContain("demonstration mode");
    expect(response.result.content[0].text).toContain("no Google account data");
  });
});
