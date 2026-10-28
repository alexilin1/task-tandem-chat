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
