import { createHash } from "node:crypto";
import type { Express, Request, Response } from "express";
import { createSparkEvent, deleteSparkEvent, getSparkTokenOwner, listSparkEvents, updateSparkEvent } from "./db";

type Rpc = { id?: string | number | null; method?: string; params?: { name?: string; arguments?: Record<string, unknown> } };

const tools = [
  { name: "list_events", description: "List private MY PLAN events only for the connected account.", inputSchema: { type: "object", properties: { startAt: { type: "string" }, endAt: { type: "string" } }, required: ["startAt", "endAt"] } },
  { name: "create_event", description: "Create a private MY PLAN event after confirming its date and time with the user.", inputSchema: { type: "object", properties: { title: { type: "string" }, startAt: { type: "string" }, endAt: { type: "string" }, description: { type: "string" } }, required: ["title", "startAt", "endAt"] } },
  { name: "update_event", description: "Update a private MY PLAN event belonging to the connected account.", inputSchema: { type: "object", properties: { eventId: { type: "number" }, title: { type: "string" }, startAt: { type: "string" }, endAt: { type: "string" }, description: { type: "string" } }, required: ["eventId", "title", "startAt", "endAt"] } },
  { name: "delete_event", description: "Delete a private MY PLAN event belonging to the connected account after explicit confirmation.", inputSchema: { type: "object", properties: { eventId: { type: "number" } }, required: ["eventId"] } },
] as const;

function validDate(value: unknown, label: string) { const date = typeof value === "string" ? new Date(value) : new Date(NaN); if (Number.isNaN(date.getTime())) throw new Error(`${label} must be ISO-8601.`); return date; }
function title(value: unknown) { if (typeof value !== "string" || !value.trim() || value.length > 1024) throw new Error("title must be 1–1024 characters."); return value.trim(); }
function eventId(value: unknown) { if (!Number.isInteger(value) || (value as number) < 1) throw new Error("eventId must be a positive integer."); return value as number; }
function result(value: unknown) { return { content: [{ type: "text", text: JSON.stringify(value) }] }; }
function requestToken(request: Request) { const header = request.header("authorization") || ""; if (header.startsWith("Bearer ")) return header.slice(7).trim(); if (header.startsWith("Basic ")) return Buffer.from(header.slice(6), "base64").toString("utf8").split(":")[1] || ""; return ""; }

export function getMcpTools() { return tools; }

export async function handleMcpRequest(userId: number, request: Rpc) {
  const id = request.id ?? null;
  if (request.method === "initialize") return { jsonrpc: "2.0", id, result: { protocolVersion: "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "MY PLAN", version: "1.0.0" } } };
  if (request.method === "tools/list") return { jsonrpc: "2.0", id, result: { tools } };
  if (request.method?.startsWith("notifications/")) return null;
  if (request.method !== "tools/call") return { jsonrpc: "2.0", id, error: { code: -32601, message: "Method not found" } };
  try {
    const name = request.params?.name; const input = request.params?.arguments ?? {};
    if (name === "list_events") return { jsonrpc: "2.0", id, result: result(await listSparkEvents(userId, validDate(input.startAt, "startAt"), validDate(input.endAt, "endAt"))) };
    if (name === "create_event" || name === "update_event") {
      const startAt = validDate(input.startAt, "startAt"); const endAt = validDate(input.endAt, "endAt"); if (endAt <= startAt) throw new Error("endAt must be after startAt.");
      const payload = { title: title(input.title), description: typeof input.description === "string" ? input.description.slice(0, 10_000) : null, startAt, endAt };
      const event = name === "create_event" ? await createSparkEvent(userId, payload) : await updateSparkEvent(userId, eventId(input.eventId), payload);
      if (!event) throw new Error("Event not found in this MY PLAN workspace.");
      return { jsonrpc: "2.0", id, result: result(event) };
    }
    if (name === "delete_event") { await deleteSparkEvent(userId, eventId(input.eventId)); return { jsonrpc: "2.0", id, result: result({ success: true }) }; }
    return { jsonrpc: "2.0", id, error: { code: -32601, message: "Unknown MY PLAN tool" } };
  } catch (error) { return { jsonrpc: "2.0", id, error: { code: -32602, message: error instanceof Error ? error.message : "Invalid tool input" } }; }
}

export function registerMcpRoutes(app: Express) {
  app.post("/api/mcp", async (req: Request, res: Response) => {
    const token = requestToken(req); if (!token) return res.status(401).json({ error: "MY PLAN Spark credential required" });
    const userId = await getSparkTokenOwner(createHash("sha256").update(token).digest("hex"));
    if (!userId) return res.status(401).json({ error: "Invalid MY PLAN Spark credential" });
    const response = await handleMcpRequest(userId, req.body as Rpc);
    return response === null ? res.status(202).end() : res.status(200).json(response);
  });
}
