import { describe, it, expect } from "vitest";
import { parseMentions, checkRunAllowed, canDecideApproval } from "./safeguards";

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
});
