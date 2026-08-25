import { describe, expect, it } from "vitest";
import { sensitiveRouteLimits } from "./rateLimits";

describe("sensitive route rate-limit policy", () => {
  it("uses bounded windows for credential, token, costly extraction, and assistant-draft endpoints", () => {
    expect(sensitiveRouteLimits.oauthCallback).toEqual({ windowMs: 15 * 60_000, max: 30 });
    expect(sensitiveRouteLimits.mcp).toEqual({ windowMs: 60_000, max: 120 });
    expect(sensitiveRouteLimits.scheduleExtract).toEqual({ windowMs: 15 * 60_000, max: 6 });
    expect(sensitiveRouteLimits.assistantDraft).toEqual({ windowMs: 5 * 60_000, max: 20 });
  });
});
