// Pure, testable rules for agent routing and loop prevention.

export const LIMITS = {
  maxDepthDefault: 6,
  maxRunsPerSend: 8,
  maxRunsPerConversationPerMinute: 20,
  maxRunsPerTask: 10,
  dailyTokenBudget: 200_000,
} as const;

export interface AgentRef {
  id: string;
  handle: string;
}

/** Extracts @Handles from text and resolves them to agent ids (case-insensitive, deduped). */
export function parseMentions(text: string, agents: AgentRef[]): string[] {
  const found = new Set<string>();
  const re = /@([A-Za-z0-9_-]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const tag = (m[1] ?? "").toLowerCase();
    const a = agents.find((x) => x.handle.toLowerCase() === tag);
    if (a) found.add(a.id);
  }
  return [...found];
}

export function normalizeForDuplicate(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

export type RunBlock =
  | { ok: true }
  | { ok: false; reason: string; pause: boolean };

export function checkRunAllowed(input: {
  paused: boolean;
  depth: number;
  maxDepth: number;
  runsThisSend: number;
  runsLastMinute: number;
  tokensToday: number;
  taskRunCount?: number;
}): RunBlock {
  if (input.paused) return { ok: false, reason: "Conversation is paused", pause: false };
  if (input.depth > input.maxDepth)
    return { ok: false, reason: `Agent-to-agent depth limit (${input.maxDepth}) reached`, pause: true };
  if (input.runsThisSend >= LIMITS.maxRunsPerSend)
    return { ok: false, reason: `Per-message agent run limit (${LIMITS.maxRunsPerSend}) reached`, pause: true };
  if (input.runsLastMinute >= LIMITS.maxRunsPerConversationPerMinute)
    return { ok: false, reason: "Rate limit: too many agent runs in the last minute", pause: true };
  if (input.tokensToday >= LIMITS.dailyTokenBudget)
    return { ok: false, reason: "Daily token budget exhausted", pause: true };
  if ((input.taskRunCount ?? 0) >= LIMITS.maxRunsPerTask)
    return { ok: false, reason: `Per-task execution limit (${LIMITS.maxRunsPerTask}) reached`, pause: true };
  return { ok: true };
}

/** Only humans may decide approvals; agents can never approve their own requests. */
export function canDecideApproval(actor: { kind: "user" | "agent"; isMember: boolean }): boolean {
  return actor.kind === "user" && actor.isMember;
}

export type InviteCheck = { ok: true } | { ok: false; reason: string };

/** An invite can be used only before it expires and while it has uses left. */
export function checkInviteUsable(invite: { expires_at: string; uses: number; max_uses: number }, now: Date = new Date()): InviteCheck {
  if (new Date(invite.expires_at).getTime() <= now.getTime()) return { ok: false, reason: "This invite link has expired" };
  if (invite.uses >= invite.max_uses) return { ok: false, reason: "This invite link has reached its use limit" };
  return { ok: true };
}
