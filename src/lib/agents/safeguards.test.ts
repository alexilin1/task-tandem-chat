import { describe, it, expect } from "vitest";
import { parseMentions, checkRunAllowed, canDecideApproval, checkInviteUsable, pickBestAgent } from "./safeguards";

const agents = [
  { id: "pm", handle: "ProjectManager" },
  { id: "fe", handle: "FrontendAgent" },
];
const base = { paused: false, depth: 1, maxDepth: 6, runsThisSend: 0, runsLastMinute: 0, tokensToday: 0 };

describe("safeguards", () => {
  it("resolves mentions case-insensitively and dedupes", () => {
    expect(parseMentions("@projectmanager hi @FrontendAgent @ProjectManager @Nobody", agents)).toEqual(["pm", "fe"]);
  });
  it("blocks beyond max depth 6", () => {
    expect(checkRunAllowed({ ...base, depth: 7 }).ok).toBe(false);
    expect(checkRunAllowed({ ...base, depth: 6 }).ok).toBe(true);
  });
  it("blocks when paused", () => {
    expect(checkRunAllowed({ ...base, paused: true }).ok).toBe(false);
  });
  it("blocks after 8 runs per message", () => {
    expect(checkRunAllowed({ ...base, runsThisSend: 8 }).ok).toBe(false);
  });
  it("agents can never decide approvals", () => {
    expect(canDecideApproval({ kind: "agent", isMember: true })).toBe(false);
    expect(canDecideApproval({ kind: "user", isMember: true })).toBe(true);
    expect(canDecideApproval({ kind: "user", isMember: false })).toBe(false);
  });
  it("invites work only before expiry and under the use limit", () => {
    const now = new Date("2026-10-28T12:00:00Z");
    const ok = { expires_at: "2026-11-04T12:00:00Z", uses: 3, max_uses: 25 };
    expect(checkInviteUsable(ok, now).ok).toBe(true);
    expect(checkInviteUsable({ ...ok, expires_at: "2026-10-28T11:59:00Z" }, now).ok).toBe(false);
    expect(checkInviteUsable({ ...ok, uses: 25 }, now).ok).toBe(false);
  });
  it("routes an unmentioned message to the single best-suited agent", () => {
    const roster = [
      { id: "fe", handle: "FrontendAgent", name: "Frontend Agent", description: "Builds user interfaces", capabilities: ["frontend", "ui"] },
      { id: "be", handle: "BackendAgent", name: "Backend Agent", description: "Builds APIs and databases", capabilities: ["backend", "api"] },
    ];
    expect(pickBestAgent("the api endpoint returns a 500", roster)?.id).toBe("be");
    expect(pickBestAgent("the button on the ui is misaligned", roster)?.id).toBe("fe");
  });
  it("returns null when no agent fits or the fit is ambiguous", () => {
    const roster = [
      { id: "fe", handle: "FrontendAgent", name: "Frontend Agent", description: "Builds user interfaces", capabilities: ["frontend"] },
      { id: "be", handle: "BackendAgent", name: "Backend Agent", description: "Builds APIs", capabilities: ["backend"] },
    ];
    expect(pickBestAgent("good morning everyone", roster)).toBeNull();
    expect(pickBestAgent("frontend backend", roster)).toBeNull(); // tie → let the LLM decide
  });
});

import { canReceiveWork, statusAfterAgentCall } from "./safeguards";
describe("agent availability", () => {
  it("routes only to online agents", () => {
    expect(canReceiveWork({ status: "online" })).toBe(true);
    expect(canReceiveWork({ status: "offline" })).toBe(false);
    expect(canReceiveWork({ status: "not_connected" })).toBe(false);
  });
  it("API calls connect an agent but never switch a paused one back on", () => {
    expect(statusAfterAgentCall("not_connected")).toBe("online");
    expect(statusAfterAgentCall("offline")).toBe("offline");
  });
});

import { jobStatusAfterFailure } from "./safeguards";
describe("agent job retries", () => {
  it("retries a failed job up to 3 attempts, then gives up", () => {
    expect(jobStatusAfterFailure(1)).toBe("pending");
    expect(jobStatusAfterFailure(2)).toBe("pending");
    expect(jobStatusAfterFailure(3)).toBe("failed");
  });
});

import { canHandoff, checkBudget, checkApprovalDecision, estimateCostUsd, classifyApprovalAction } from "./safeguards";
describe("handoffs", () => {
  const to = { id: "b", status: "online" };
  it("allows a handoff to another online agent within depth 3", () => expect(canHandoff({ fromId: "a", to, depth: 3 }).ok).toBe(true));
  it("blocks depth 4", () => expect(canHandoff({ fromId: "a", to, depth: 4 }).ok).toBe(false));
  it("blocks handing off to itself", () => expect(canHandoff({ fromId: "b", to, depth: 1 }).ok).toBe(false));
  it("blocks offline receivers", () => expect(canHandoff({ fromId: "a", to: { id: "b", status: "offline" }, depth: 1 }).ok).toBe(false));
});
describe("budgets", () => {
  const b = { monthly_limit_usd: 10, warn_at_percent: 80, hard_limit: true, max_cost_per_run_usd: null };
  it("allows spend under the limit", () => expect(checkBudget(b, 5, 0.1)).toEqual({ ok: true, warn: false }));
  it("warns at 80%", () => expect(checkBudget(b, 8, 0.1)).toEqual({ ok: true, warn: true }));
  it("blocks when the run would exceed a hard limit", () => expect(checkBudget(b, 9.95, 0.1).ok).toBe(false));
  it("soft limits only warn", () => expect(checkBudget({ ...b, hard_limit: false }, 20, 0.1).ok).toBe(true));
  it("blocks runs above the per-run cap", () => expect(checkBudget({ ...b, max_cost_per_run_usd: 0.01 }, 0, 0.05).ok).toBe(false));
  it("estimates cost from tokens", () => expect(estimateCostUsd(1_000_000, 100_000)).toBe(2.25));
});
describe("approval decisions", () => {
  const future = new Date(Date.now() + 60_000).toISOString();
  it("accepts a pending, unexpired, unchanged request", () => expect(checkApprovalDecision({ status: "pending", expires_at: future, action_hash: "h" }, "h").ok).toBe(true));
  it("rejects a changed action", () => expect(checkApprovalDecision({ status: "pending", expires_at: future, action_hash: "h" }, "x").ok).toBe(false));
  it("rejects expired requests", () => expect(checkApprovalDecision({ status: "pending", expires_at: new Date(Date.now() - 1).toISOString(), action_hash: "h" }, "h").ok).toBe(false));
  it("rejects already-decided requests (no double execution)", () => expect(checkApprovalDecision({ status: "approved", expires_at: future, action_hash: "h" }, "h").ok).toBe(false));
  it("classifies deploys", () => expect(classifyApprovalAction("Deploy to production")).toBe("deploy"));
});

import { checkThreadAllowed } from "./safeguards";
describe("private thread limits", () => {
  it("stops after 30 minutes", () => expect(checkThreadAllowed({ status: "open", ageMs: 31 * 60_000, agentMessages: 0 }).ok).toBe(false));
  it("stops at 12 agent messages", () => expect(checkThreadAllowed({ status: "open", ageMs: 0, agentMessages: 12 }).ok).toBe(false));
  it("blocks closed threads", () => expect(checkThreadAllowed({ status: "published", ageMs: 0, agentMessages: 0 }).ok).toBe(false));
  it("allows a fresh open thread", () => expect(checkThreadAllowed({ status: "open", ageMs: 1000, agentMessages: 3 }).ok).toBe(true));
});
