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

export interface AgentProfile extends AgentRef {
  name: string;
  description: string;
  capabilities: string[];
}

const STOPWORDS = new Set(["the", "and", "for", "are", "but", "not", "you", "all", "can", "has", "was", "one", "our", "out", "any", "with", "this", "that", "from", "is", "on", "it", "in", "to", "of", "a", "an"]);

function tokens(text: string): Set<string> {
  return new Set(text.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 1 && !STOPWORDS.has(w)));
}

/**
 * Scores how well an agent fits a message: capability matches weigh most,
 * then handle/name, then description words. Returns 0 for no fit.
 */
export function scoreAgent(content: string, agent: AgentProfile): number {
  const words = tokens(content);
  if (!words.size) return 0;
  let score = 0;
  for (const cap of agent.capabilities) {
    for (const w of tokens(cap)) if (words.has(w)) score += 3;
  }
  for (const w of tokens(`${agent.handle} ${agent.name}`)) if (words.has(w)) score += 2;
  for (const w of tokens(agent.description)) if (words.has(w)) score += 1;
  return score;
}

/**
 * Picks the single best-suited agent for an unmentioned message.
 * Returns null when no agent scores (caller may fall back to an LLM pick)
 * or when the top score is tied (ambiguous — let the LLM decide).
 */
export function pickBestAgent<T extends AgentProfile>(content: string, agents: T[]): T | null {
  let best: T | null = null;
  let bestScore = 0;
  let tied = false;
  for (const a of agents) {
    const s = scoreAgent(content, a);
    if (s > bestScore) {
      best = a;
      bestScore = s;
      tied = false;
    } else if (s === bestScore && s > 0) {
      tied = true;
    }
  }
  return tied ? null : best;
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

export const MAX_HANDOFF_DEPTH = 3;

/** Rules for an agent delegating work to another agent. */
export function checkHandoffAllowed(i: {
  fromId: string;
  toId: string | null;
  fromPermissions: string[];
  participantIds: string[];
  parentDepth: number;
}): { ok: true; depth: number } | { ok: false; reason: string } {
  if (!i.fromPermissions.includes("create_tasks")) return { ok: false, reason: "sender cannot delegate" };
  if (!i.toId || !i.participantIds.includes(i.toId)) return { ok: false, reason: "receiving agent is not in this conversation" };
  if (i.toId === i.fromId) return { ok: false, reason: "cannot hand off to itself" };
  const depth = i.parentDepth + 1;
  if (depth > MAX_HANDOFF_DEPTH) return { ok: false, reason: `handoff chain deeper than ${MAX_HANDOFF_DEPTH}` };
  return { ok: true, depth };
}

/** Stable key so the same delegation is never recorded twice. */
export function handoffIdempotencyKey(fromId: string, toId: string, title: string, correlationId: string) {
  return `${correlationId}:${fromId}:${toId}:${normalizeForDuplicate(title)}`;
}
