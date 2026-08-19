/**
 * Minimal JSON-RPC MCP surface for Gemini Spark evaluation. It deliberately exposes only
 * read-only demonstration data until user authentication and Google OAuth are activated.
 */
import type { Express, Request, Response } from "express";

type JsonRpcRequest = { id?: string | number | null; method?: string; params?: Record<string, unknown> };

const tools = [
  {
    name: "list_academic_deadlines",
    description: "Return the academic milestones currently included in the MY PLAN demonstration calendar.",
    inputSchema: { type: "object", properties: { month: { type: "string", description: "Optional month name, for example August." } } },
  },
  {
    name: "get_calendar_connection_status",
    description: "Return the current demonstration status and the requirements for live Google Calendar activation.",
    inputSchema: { type: "object", properties: {} },
  },
] as const;

const milestones = [
  "Aug 12 — Assignment Submission - I",
  "Aug 17 — Java 1st Quiz",
  "Sept 16–21 — SESSIONAL I EXAMINATIONS",
  "Oct 22–28 — SESSIONAL II EXAMINATIONS",
  "Nov 16–20 — Practical Examinations",
  "Nov 25–Dec 15 — END SEMESTER THEORY EXAMS",
];

export function getMcpTools() { return tools; }

export function handleDemoMcpRequest(request: JsonRpcRequest) {
  const id = request.id ?? null;
  if (request.method === "initialize") {
    return { jsonrpc: "2.0", id, result: { protocolVersion: "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "MY PLAN Demo MCP", version: "0.1.0" } } };
  }
  if (request.method === "tools/list") return { jsonrpc: "2.0", id, result: { tools } };
  if (request.method === "tools/call") {
    const toolName = request.params?.name;
    if (toolName === "list_academic_deadlines") return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: milestones.join("\n") }] } };
    if (toolName === "get_calendar_connection_status") return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: "MY PLAN is in demonstration mode. Google Calendar linking requires app-owner OAuth credentials; no Google account data is connected or available through this endpoint." }] } };
    return { jsonrpc: "2.0", id, error: { code: -32601, message: "Unknown demonstration tool" } };
  }
  if (request.method?.startsWith("notifications/")) return null;
  return { jsonrpc: "2.0", id, error: { code: -32601, message: "Method not found" } };
}

export function registerMcpRoutes(app: Express) {
  app.post("/api/mcp", (req: Request, res: Response) => {
    const response = handleDemoMcpRequest(req.body as JsonRpcRequest);
    if (response === null) return res.status(202).end();
    return res.status(200).json(response);
  });
}
