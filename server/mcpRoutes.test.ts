import { describe, expect, it } from "vitest";
import { getMcpTools, handleMcpRequest, requestToken } from "./mcpRoutes";

describe("authenticated MY PLAN Spark MCP endpoint", () => {
  it("advertises the private event tools required for user-authorized planning actions", () => {
    const names = getMcpTools().map(tool => tool.name);
    expect(names).toEqual(["list_events", "create_event", "update_event", "delete_event"]);
    expect(getMcpTools().find(tool => tool.name === "create_event")?.description).toContain("private MY PLAN event");
  });

  it("keeps the MCP protocol available while rejecting invalid event input before any private write", async () => {
    await expect(handleMcpRequest(7, { id: 1, method: "initialize" })).resolves.toMatchObject({ jsonrpc: "2.0", result: { serverInfo: { name: "MY PLAN" } } });
    await expect(handleMcpRequest(7, { id: 2, method: "tools/call", params: { name: "create_event", arguments: { title: "Exam", startAt: "not-a-date", endAt: "2026-09-01T10:00:00Z" } } })).resolves.toMatchObject({ error: { code: -32602 } });
  });

  it("accepts only a bearer credential format and never treats Basic credentials as an MCP token", () => {
    expect(requestToken({ header: (name: string) => name === "authorization" ? "Bearer secure-token" : undefined } as any)).toBe("secure-token");
    expect(requestToken({ header: () => "Basic dXNlcjpzZWNyZXQtdG9rZW4=" } as any)).toBe("");
  });
});
