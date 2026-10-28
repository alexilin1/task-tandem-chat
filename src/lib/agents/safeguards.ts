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

/** Only agents that are switched on and have passed a connection check get routed work. */
export function canReceiveWork(agent: { status: string }): boolean {
  return agent.status === "online";
}

/** An API call from an outside agent marks it online, unless a human switched it off. */
export function statusAfterAgentCall(current: string): string {
  return current === "offline" ? "offline" : "online";
}

export const MAX_JOB_ATTEMPTS = 3;

/** After a failed attempt a job is retried until it has used all its attempts. */
export function jobStatusAfterFailure(attempts: number): "pending" | "failed" {
  return attempts >= MAX_JOB_ATTEMPTS ? "failed" : "pending";
}

export const MAX_HANDOFF_DEPTH = 3;

/** A handoff is allowed only to a different, online agent and below the depth limit. */
export function canHandoff(input: { fromId: string; to: { id: string; status: string } | null | undefined; depth: number }): { ok: true } | { ok: false; reason: string } {
  if (!input.to) return { ok: false, reason: "Receiving agent isn't in this conversation" };
  if (input.to.id === input.fromId) return { ok: false, reason: "An agent can't hand off to itself" };
  if (!canReceiveWork(input.to)) return { ok: false, reason: "Receiving agent isn't online" };
  if (input.depth > MAX_HANDOFF_DEPTH) return { ok: false, reason: `Handoff depth limit (${MAX_HANDOFF_DEPTH}) reached` };
  return { ok: true };
}

/**
 * Estimated cost in USD for a model call. These are estimates from a fixed per-million-token rate,
 * not billed amounts. Rates live here so they're easy to adjust.
 */
export const EST_USD_PER_M_INPUT = 1.25;
export const EST_USD_PER_M_OUTPUT = 10;
export function estimateCostUsd(inputTokens: number, outputTokens: number): number {
  return Math.round(((inputTokens * EST_USD_PER_M_INPUT + outputTokens * EST_USD_PER_M_OUTPUT) / 1_000_000) * 1e6) / 1e6;
}
/** Rough reservation for one built-in run before it starts (used for budget checks). */
export const EST_RUN_RESERVE_USD = estimateCostUsd(6000, 1500);

export type BudgetCheck = { ok: true; warn: boolean } | { ok: false; reason: string };

/** Blocks a run when it would push spend past a hard limit; warns past the threshold. */
export function checkBudget(budget: { monthly_limit_usd: number; warn_at_percent: number; hard_limit: boolean; max_cost_per_run_usd: number | null } | null, spentUsd: number, reserveUsd: number): BudgetCheck {
  if (!budget) return { ok: true, warn: false };
  if (budget.max_cost_per_run_usd != null && reserveUsd > budget.max_cost_per_run_usd)
    return { ok: false, reason: `Estimated run cost exceeds the per-run limit of $${budget.max_cost_per_run_usd}` };
  if (budget.hard_limit && spentUsd + reserveUsd > budget.monthly_limit_usd)
    return { ok: false, reason: `Monthly budget of $${budget.monthly_limit_usd} reached` };
  return { ok: true, warn: spentUsd + reserveUsd >= (budget.monthly_limit_usd * budget.warn_at_percent) / 100 };
}

/** Approvals must be decided while pending, before expiry, and for the exact action that was requested. */
export function checkApprovalDecision(ap: { status: string; expires_at: string; action_hash: string | null }, currentHash: string, now: Date = new Date()): { ok: true } | { ok: false; reason: string } {
  if (ap.status !== "pending") return { ok: false, reason: "This request was already decided" };
  if (new Date(ap.expires_at).getTime() <= now.getTime()) return { ok: false, reason: "This request has expired" };
  if (ap.action_hash && ap.action_hash !== currentHash) return { ok: false, reason: "The requested action changed; a new approval is needed" };
  return { ok: true };
}

/** Maps an approval request to a category so the inbox can show what kind of action it is. */
export function classifyApprovalAction(text: string): string {
  const t = text.toLowerCase();
  if (/deploy|release|ship|rollout/.test(t)) return "deploy";
  if (/delete|remove|drop|wipe/.test(t)) return "delete";
  if (/spend|pay|purchase|buy|charge|\$/.test(t)) return "spend";
  if (/email|send|post|tweet|publish|notify/.test(t)) return "external_message";
  if (/database|production data|migrat|update records/.test(t)) return "modify_data";
  if (/install|integrat|connect/.test(t)) return "install";
  if (/access|credential|secret|permission/.test(t)) return "access";
  return "other";
}
