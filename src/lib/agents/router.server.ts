import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { checkRunAllowed, parseMentions, normalizeForDuplicate, pickBestAgent, canReceiveWork, canHandoff, checkBudget, estimateCostUsd, EST_RUN_RESERVE_USD, classifyApprovalAction } from "./safeguards";
import { runAgentLLM, pickAgentWithLLM, type AgentOutput } from "./llm.server";

type Admin = SupabaseClient<Database>;
type Agent = Database["public"]["Tables"]["agents"]["Row"];
type Msg = Database["public"]["Tables"]["messages"]["Row"];

export interface RouterMessage {
  id: string;
  conversation_id: string;
  content: string;
  depth: number;
  correlation_id: string;
  mentions: string[];
  sender_agent_id: string | null;
}

export async function hmacHex(secret: string, body: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function logActivity(admin: Admin, e: { workspace_id: string; conversation_id?: string | null; agent_id?: string | null; task_id?: string | null; run_id?: string | null; event_type: string; summary: string; metadata?: Record<string, unknown> }) {
  await admin.from("agent_activity_events").insert({ ...e, metadata: (e.metadata ?? {}) as any });
}

/** Stable hash of an approval's action payload; approval is bound to exactly this. */
export async function approvalHash(payload: Record<string, unknown>) {
  const keys = Object.keys(payload).sort();
  return sha256Hex(JSON.stringify(keys.map((k) => [k, payload[k]])));
}

async function budgetFor(admin: Admin, workspaceId: string, agentId: string) {
  const { data: rows } = await admin.from("agent_budgets").select("*").eq("workspace_id", workspaceId).or(`agent_id.is.null,agent_id.eq.${agentId}`);
  for (const b of rows ?? []) {
    const { data: spent } = await admin.rpc("month_spend_usd", b.agent_id ? { _workspace_id: workspaceId, _agent_id: agentId } : { _workspace_id: workspaceId });
    const r = checkBudget({ monthly_limit_usd: Number(b.monthly_limit_usd), warn_at_percent: b.warn_at_percent, hard_limit: b.hard_limit, max_cost_per_run_usd: b.max_cost_per_run_usd == null ? null : Number(b.max_cost_per_run_usd) }, Number(spent ?? 0), EST_RUN_RESERVE_USD);
    if (!r.ok) return { ok: false as const, reason: `${b.agent_id ? "Agent" : "Workspace"} ${r.reason.charAt(0).toLowerCase()}${r.reason.slice(1)}` };
  }
  return { ok: true as const };
}

export async function sha256Hex(s: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function pauseConversation(admin: Admin, convId: string, reason: string) {
  await admin.from("conversations").update({ paused: true, pause_reason: reason }).eq("id", convId);
  await admin.from("messages").insert({ conversation_id: convId, kind: "system", content: `⏸ Agents paused: ${reason}. Resume from the right panel.` });
}

/** Inserts an agent-authored message and returns it for further routing. */
export async function insertAgentMessage(
  admin: Admin,
  agents: Agent[],
  agent: Agent,
  convId: string,
  content: string,
  parent: { depth: number; correlation_id: string },
): Promise<RouterMessage | null> {
  const mentions = parseMentions(content, agents).filter((id) => id !== agent.id);
  const { data } = await admin
    .from("messages")
    .insert({
      conversation_id: convId,
      sender_agent_id: agent.id,
      content,
      mentions,
      depth: parent.depth + 1,
      correlation_id: parent.correlation_id,
    })
    .select()
    .single();
  return data as RouterMessage | null;
}

export async function routeMessage(admin: Admin, start: RouterMessage) {
  const convId = start.conversation_id;
  const { data: parts } = await admin.from("conversation_participants").select("agent_id").eq("conversation_id", convId).not("agent_id", "is", null);
  const ids = (parts ?? []).map((p) => p.agent_id!);
  if (!ids.length) return;
  const { data: agentRows } = await admin.from("agents").select("*").in("id", ids);
  const agents = ((agentRows ?? []) as Agent[]).filter(canReceiveWork);
  if (!agents.length) return;
  const queue: Array<{ agentId: string; msg: RouterMessage }> = start.mentions
    .filter((id) => ids.includes(id))
    .map((agentId) => ({ agentId, msg: start }));

  // Human message with no @mention: route to the single best-suited agent.
  if (!queue.length && !start.sender_agent_id) {
    const { data: conv } = await admin.from("conversations").select("kind").eq("id", convId).single();
    if (conv?.kind === "dm" && agents.length === 1 && agents[0]) {
      queue.push({ agentId: agents[0].id, msg: start });
    } else if (conv?.kind === "group" && agents.length) {
      // Keyword heuristic first; when it can't decide (no fit or a tie), ask the LLM to pick one handle.
      let chosen = pickBestAgent(start.content, agents);
      if (!chosen) {
        const roster = agents.map((a) => `@${a.handle} — ${a.name}: ${a.description} (${a.capabilities.join(", ")})`).join("\n");
        try {
          const handle = await pickAgentWithLLM(roster, start.content);
          chosen = agents.find((a) => a.handle.toLowerCase() === (handle ?? "").toLowerCase()) ?? null;
        } catch {
          chosen = null; // routing failure stays silent rather than spamming every agent
        }
      }
      if (chosen) queue.push({ agentId: chosen.id, msg: start });
    }
  }

  let runsThisSend = 0;
  const seen = new Set<string>();
  while (queue.length) {
    const { agentId, msg } = queue.shift()!;
    const agent = agents.find((a) => a.id === agentId);
    if (!agent) continue;
    const key = `${agentId}:${normalizeForDuplicate(msg.content)}`;
    if (seen.has(key)) continue; // duplicate detection
    seen.add(key);

    const { data: conv } = await admin.from("conversations").select("*").eq("id", convId).single();
    if (!conv) return;
    const since = new Date(Date.now() - 60_000).toISOString();
    const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
    const { count: runsLastMinute } = await admin.from("agent_runs").select("id", { count: "exact", head: true }).eq("conversation_id", convId).gte("created_at", since);
    const { data: tokenRows } = await admin.from("agent_runs").select("tokens").eq("conversation_id", convId).gte("created_at", dayAgo);
    const tokensToday = (tokenRows ?? []).reduce((s, r) => s + r.tokens, 0);

    const check = checkRunAllowed({
      paused: conv.paused,
      depth: msg.depth + 1,
      maxDepth: conv.max_depth,
      runsThisSend,
      runsLastMinute: runsLastMinute ?? 0,
      tokensToday,
    });
    if (!check.ok) {
      if (check.pause) await pauseConversation(admin, convId, check.reason);
      return;
    }

    if (agent.provider !== "builtin") {
      await deliverExternal(admin, agent, msg);
      continue;
    }

    const budget = await budgetFor(admin, conv.workspace_id, agent.id);
    if (!budget.ok) {
      await logActivity(admin, { workspace_id: conv.workspace_id, conversation_id: convId, agent_id: agent.id, event_type: "blocked", summary: `${agent.name} was stopped: ${budget.reason}` });
      await admin.from("messages").insert({ conversation_id: convId, kind: "system", content: `${agent.name} didn't run: ${budget.reason}. Change it in Usage & budgets.` });
      continue;
    }

    runsThisSend++;
    await admin.from("conversation_participants").update({ activity: "Thinking…" }).eq("conversation_id", convId).eq("agent_id", agent.id);
    const startedAt = new Date();
    const { data: run } = await admin.from("agent_runs").insert({ conversation_id: convId, workspace_id: conv.workspace_id, agent_id: agent.id, status: "running", started_at: startedAt.toISOString() }).select("id").single();
    await logActivity(admin, { workspace_id: conv.workspace_id, conversation_id: convId, agent_id: agent.id, run_id: run?.id ?? null, event_type: "started", summary: `${agent.name} started working` });
    try {
      const out = await runBuiltin(admin, agents, agent, conv, msg);
      const cost = estimateCostUsd(out.inputTokens, out.outputTokens);
      const finishedAt = new Date();
      if (run) await admin.from("agent_runs").update({ status: "ok", tokens: out.tokens, model: out.model, finished_at: finishedAt.toISOString(), estimated_cost_usd: cost }).eq("id", run.id);
      const next = await applyOutput(admin, agents, agent, conv, msg, out.output, run?.id ?? null);
      await logActivity(admin, { workspace_id: conv.workspace_id, conversation_id: convId, agent_id: agent.id, run_id: run?.id ?? null, event_type: "completed", summary: `${agent.name} finished`, metadata: { duration_ms: finishedAt.getTime() - startedAt.getTime(), tokens: out.tokens, input_tokens: out.inputTokens, output_tokens: out.outputTokens, estimated_cost_usd: cost, model: out.model, actions: (out.output.actions ?? []).map((a) => a.type), output_summary: out.output.message.slice(0, 200) } });
      for (const m of next) for (const id of m.mentions) if (ids.includes(id)) queue.push({ agentId: id, msg: m });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Agent failed";
      if (run) await admin.from("agent_runs").update({ status: "error", finished_at: new Date().toISOString(), error_summary: message.slice(0, 500) }).eq("id", run.id);
      await logActivity(admin, { workspace_id: conv.workspace_id, conversation_id: convId, agent_id: agent.id, run_id: run?.id ?? null, event_type: "failed", summary: `${agent.name} failed`, metadata: { error: message.slice(0, 300), duration_ms: Date.now() - startedAt.getTime() } });
      await admin.from("messages").insert({ conversation_id: convId, kind: "system", content: `⚠️ ${agent.name} could not respond: ${message}` });
    } finally {
      await admin.from("conversation_participants").update({ activity: null }).eq("conversation_id", convId).eq("agent_id", agent.id);
    }
  }
}

async function deliverExternal(admin: Admin, agent: Agent, msg: RouterMessage) {
  if (agent.provider !== "webhook" || !agent.webhook_url) return; // REST agents poll the API
  const { data: cred } = await admin.from("agent_credentials").select("webhook_secret").eq("agent_id", agent.id).single();
  if (!cred) return;
  const body = JSON.stringify({
    type: "message",
    conversation_id: msg.conversation_id,
    message_id: msg.id,
    sender_agent_id: msg.sender_agent_id,
    content: msg.content,
    depth: msg.depth,
    correlation_id: msg.correlation_id,
    timestamp: new Date().toISOString(),
  });
  try {
    const sig = await hmacHex(cred.webhook_secret, body);
    const res = await fetch(agent.webhook_url, { method: "POST", headers: { "Content-Type": "application/json", "X-AgentChat-Signature": sig }, body });
    await admin.from("agents").update({ status: res.ok ? "online" : "not_connected", last_seen_at: res.ok ? new Date().toISOString() : agent.last_seen_at }).eq("id", agent.id);
  } catch {
    await admin.from("agents").update({ status: "not_connected" }).eq("id", agent.id);
  }
}

async function runBuiltin(admin: Admin, agents: Agent[], agent: Agent, conv: Database["public"]["Tables"]["conversations"]["Row"], msg: RouterMessage) {
  const [{ data: recent }, { data: memory }, { data: tasks }] = await Promise.all([
    admin.from("messages").select("*").eq("conversation_id", conv.id).order("created_at", { ascending: false }).limit(15),
    admin.from("conversation_memory").select("kind, content").eq("conversation_id", conv.id).order("created_at", { ascending: false }).limit(20),
    admin.from("tasks").select("id, title, status, progress, assigned_agent_id").eq("conversation_id", conv.id).neq("status", "completed").limit(20),
  ]);
  const { data: users } = await admin.from("profiles").select("id, display_name");
  const name = (m: Msg) =>
    m.sender_agent_id ? `@${agents.find((a) => a.id === m.sender_agent_id)?.handle ?? "agent"}` : m.sender_user_id ? users?.find((u) => u.id === m.sender_user_id)?.display_name ?? "Human" : "System";
  const history = ((recent ?? []) as Msg[]).reverse().map((m) => `${name(m)}: ${m.content}`).join("\n");
  const roster = agents.map((a) => `@${a.handle} — ${a.name}: ${a.description}`).join("\n");
  const taskList = (tasks ?? []).map((t) => `[${t.id}] ${t.title} (${t.status}, ${t.progress}%, assigned @${agents.find((a) => a.id === t.assigned_agent_id)?.handle ?? "none"})`).join("\n") || "none";
  const canRead = agent.permissions.includes("read_history");

  const instructions = `${agent.system_prompt}

You are @${agent.handle} in the AgentChat group "${conv.title}". Project: ${conv.description}
Other agents in this group:\n${roster}

Rules:
- Reply concisely (1-4 sentences, Markdown allowed). Mention other agents with @Handle only when you need them to act; do not thank or acknowledge agents needlessly — avoid ping-pong.
- If nothing useful to add, return an empty message.
- Use actions to create tasks (assignee_handle without @), update task status/progress/result (task_id from the list), save important decisions to memory, or request_approval for sensitive operations (production changes, deploys, deletions, external data sharing, spending). Never assume approval was granted.
- To delegate work to another agent, use a "handoff" action (title, description = the context they need, assignee_handle, optional task_id it depends on). Don't also @mention them in your message.
- When you receive a handoff (a message containing task_id), first use accept_handoff (or reject_handoff / request_clarification with a reason) with that task_id, then do the work and finish with update_task status completed (result = your output) or failed. Results go back to the sender automatically.
- Set unused action fields to null.`;

  const input = `Shared memory:\n${(memory ?? []).map((m) => `- (${m.kind}) ${m.content}`).join("\n") || "none"}

Open tasks:\n${taskList}

${canRead ? `Recent conversation:\n${history}` : "(You do not have permission to read history.)"}

Message to respond to (depth ${msg.depth}): ${msg.sender_agent_id ? name({ sender_agent_id: msg.sender_agent_id } as Msg) : "Human"}: ${msg.content}`;
  return runAgentLLM(instructions, input);
}

async function applyOutput(admin: Admin, agents: Agent[], agent: Agent, conv: Database["public"]["Tables"]["conversations"]["Row"], parent: RouterMessage, out: AgentOutput, runId: string | null) {
  const convId = conv.id;
  const ws = conv.workspace_id;
  const posted: RouterMessage[] = [];
  const postSystemish = async (content: string, mentions: string[], taskId: string | null) => {
    const { data: m } = await admin.from("messages").insert({ conversation_id: convId, sender_agent_id: agent.id, kind: "task_event", task_id: taskId, content, mentions, depth: parent.depth + 1, correlation_id: parent.correlation_id }).select().single();
    if (m && mentions.length) posted.push(m as any);
  };
  for (const a of out.actions ?? []) {
    if (a.type === "create_task" && a.title && agent.permissions.includes("create_tasks")) {
      const assignee = agents.find((x) => x.handle.toLowerCase() === (a.assignee_handle ?? "").replace("@", "").toLowerCase());
      const { data: t } = await admin.from("tasks").insert({ conversation_id: convId, title: a.title, description: a.description ?? "", assigned_agent_id: assignee?.id ?? agent.id, created_by_agent_id: agent.id }).select().single();
      if (t) {
        await admin.from("messages").insert({ conversation_id: convId, sender_agent_id: agent.id, kind: "task_event", task_id: t.id, content: `${agent.name} created task **${t.title}**${assignee ? ` for ${assignee.name}` : ""}` });
        await logActivity(admin, { workspace_id: ws, conversation_id: convId, agent_id: agent.id, task_id: t.id, run_id: runId, event_type: "task_created", summary: `${agent.name} created ${t.title}` });
      }
    } else if (a.type === "update_task" && a.task_id) {
      const { data: t } = await admin.from("tasks").select("*").eq("id", a.task_id).eq("conversation_id", convId).maybeSingle();
      if (!t) continue;
      const patch: Database["public"]["Tables"]["tasks"]["Update"] = { updated_at: new Date().toISOString(), run_count: t.run_count + 1 };
      if (a.status) patch.status = a.status;
      if (a.progress != null) patch.progress = Math.max(0, Math.min(100, a.progress));
      if (a.result) patch.result = a.result;
      if (a.status === "completed") patch.progress = 100;
      await admin.from("tasks").update(patch).eq("id", t.id);
      const verb = { pending: "queued", running: "started", waiting_input: "is waiting for input on", completed: "completed", failed: "failed" }[a.status ?? "running"];
      await admin.from("messages").insert({ conversation_id: convId, sender_agent_id: agent.id, kind: "task_event", task_id: t.id, content: `${agent.name} ${verb} **${t.title}**${a.result ? ` — ${a.result}` : ""}` });
      await logActivity(admin, { workspace_id: ws, conversation_id: convId, agent_id: agent.id, task_id: t.id, run_id: runId, event_type: `task_${a.status ?? "updated"}`, summary: `${agent.name} ${verb} ${t.title}` });
      if (a.status === "completed" || a.status === "failed") {
        const { data: h } = await admin.from("agent_handoffs").select("*").eq("task_id", t.id).eq("to_agent_id", agent.id).in("status", ["pending", "accepted"]).maybeSingle();
        if (h) {
          await admin.from("agent_handoffs").update({ status: a.status, result: a.result ?? null, completed_at: new Date().toISOString() }).eq("id", h.id).in("status", ["pending", "accepted"]);
          await admin.from("handoff_events").insert({ handoff_id: h.id, event_type: a.status, actor_type: "agent", actor_id: agent.id, metadata: { result: a.result ?? null } });
          const from = agents.find((x) => x.id === h.from_agent_id);
          if (from) await postSystemish(`${agent.name} ${a.status === "completed" ? "completed" : "couldn't complete"} **${t.title}** and returned it to @${from.handle}${a.result ? `\n\n${a.result}` : ""}`, [from.id], t.id);
        }
      }
    } else if (a.type === "request_approval" && a.approval_action && agent.permissions.includes("request_approval")) {
      const payload = { action: a.approval_action, details: a.description ?? "", task_id: a.task_id ?? null, agent_id: agent.id, conversation_id: convId };
      const { data: ap } = await admin.from("approvals").insert({ conversation_id: convId, agent_id: agent.id, task_id: a.task_id, action: a.approval_action, details: a.description ?? "", action_type: classifyApprovalAction(`${a.approval_action} ${a.description ?? ""}`), action_payload: payload, action_hash: await approvalHash(payload) }).select().single();
      if (ap) {
        await admin.from("approval_events").insert({ approval_id: ap.id, actor_type: "agent", actor_id: agent.id, event_type: "requested", metadata: payload });
        await logActivity(admin, { workspace_id: ws, conversation_id: convId, agent_id: agent.id, task_id: a.task_id, run_id: runId, event_type: "waiting_approval", summary: `${agent.name} is waiting for approval: ${ap.action}` });
      }
      if (ap) await admin.from("messages").insert({ conversation_id: convId, sender_agent_id: agent.id, kind: "approval", approval_id: ap.id, content: `I need permission to: **${ap.action}**${ap.details ? `\n\n${ap.details}` : ""}` });
    } else if (a.type === "handoff" && a.title) {
      const to = agents.find((x) => x.handle.toLowerCase() === (a.assignee_handle ?? "").replace("@", "").toLowerCase());
      const { data: parentH } = await admin.from("agent_handoffs").select("id, handoff_depth").eq("conversation_id", convId).eq("to_agent_id", agent.id).in("status", ["pending", "accepted"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
      const depth = (parentH?.handoff_depth ?? 0) + 1;
      const ok = canHandoff({ fromId: agent.id, to, depth });
      if (!ok.ok || !to) {
        await logActivity(admin, { workspace_id: ws, conversation_id: convId, agent_id: agent.id, run_id: runId, event_type: "handoff_blocked", summary: `${agent.name} couldn't hand off ${a.title}: ${ok.ok ? "unknown agent" : ok.reason}` });
        continue;
      }
      const key = `${parent.id}:${to.id}:${a.title.toLowerCase().slice(0, 80)}`;
      const { data: existing } = await admin.from("agent_handoffs").select("id").eq("conversation_id", convId).eq("idempotency_key", key).maybeSingle();
      if (existing) continue; // idempotent: same handoff from the same message
      const { data: t } = await admin.from("tasks").insert({ conversation_id: convId, title: a.title, description: a.description ?? "", assigned_agent_id: to.id, created_by_agent_id: agent.id, depends_on: a.task_id ? [a.task_id] : [] }).select().single();
      if (!t) continue;
      const { data: h } = await admin.from("agent_handoffs").insert({ workspace_id: ws, conversation_id: convId, task_id: t.id, from_agent_id: agent.id, to_agent_id: to.id, parent_handoff_id: parentH?.id ?? null, handoff_depth: depth, context_summary: a.description ?? "", payload: { title: a.title, depends_on: a.task_id ?? null, source_message_id: parent.id }, idempotency_key: key }).select().single();
      if (!h) continue;
      await admin.from("handoff_events").insert({ handoff_id: h.id, event_type: "created", actor_type: "agent", actor_id: agent.id });
      await logActivity(admin, { workspace_id: ws, conversation_id: convId, agent_id: agent.id, task_id: t.id, run_id: runId, event_type: "handoff", summary: `${agent.name} handed off ${t.title} to ${to.name}`, metadata: { handoff_id: h.id } });
      await postSystemish(`${agent.name} handed off **${t.title}** to @${to.handle}${a.description ? `\n\nContext: ${a.description}` : ""}\n\n(task_id ${t.id})`, [to.id], t.id);
    } else if ((a.type === "accept_handoff" || a.type === "reject_handoff" || a.type === "request_clarification") && a.task_id) {
      const { data: h } = await admin.from("agent_handoffs").select("*").eq("task_id", a.task_id).eq("to_agent_id", agent.id).in("status", ["pending", "clarification_requested"]).maybeSingle();
      if (!h) continue;
      const status = a.type === "accept_handoff" ? "accepted" : a.type === "reject_handoff" ? "rejected" : "clarification_requested";
      await admin.from("agent_handoffs").update({ status, accepted_at: status === "accepted" ? new Date().toISOString() : h.accepted_at }).eq("id", h.id);
      await admin.from("handoff_events").insert({ handoff_id: h.id, event_type: status, actor_type: "agent", actor_id: agent.id, metadata: { note: a.description ?? a.result ?? null } });
      if (status === "accepted") await admin.from("tasks").update({ status: "running", updated_at: new Date().toISOString() }).eq("id", a.task_id);
      if (status === "rejected") await admin.from("tasks").update({ status: "failed", result: a.description ?? "Handoff rejected", updated_at: new Date().toISOString() }).eq("id", a.task_id);
      await logActivity(admin, { workspace_id: ws, conversation_id: convId, agent_id: agent.id, task_id: a.task_id, run_id: runId, event_type: `handoff_${status}`, summary: `${agent.name} ${status === "accepted" ? "accepted" : status === "rejected" ? "rejected" : "asked for clarification on"} a handoff` });
      const from = agents.find((x) => x.id === h.from_agent_id);
      if (from && status !== "accepted") await postSystemish(`${agent.name} ${status === "rejected" ? "rejected" : "needs clarification on"} the handoff from @${from.handle}${a.description ? `: ${a.description}` : ""}`, [from.id], a.task_id);
    } else if (a.type === "save_memory" && (a.result || a.description || a.title)) {
      await admin.from("conversation_memory").insert({ conversation_id: convId, kind: "decision", content: (a.result || a.description || a.title)!, created_by_agent_id: agent.id });
    }
  }
  if (out.message?.trim()) {
    const m = await insertAgentMessage(admin, agents, agent, convId, out.message.trim(), parent);
    if (m) posted.push(m);
  }
  return posted;
}
