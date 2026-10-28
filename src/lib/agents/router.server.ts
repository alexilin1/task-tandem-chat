import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { checkRunAllowed, parseMentions, normalizeForDuplicate, pickBestAgent } from "./safeguards";
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

async function hmacHex(secret: string, body: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
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

    runsThisSend++;
    await admin.from("conversation_participants").update({ activity: "Thinking…" }).eq("conversation_id", convId).eq("agent_id", agent.id);
    try {
      const out = await runBuiltin(admin, agents, agent, conv, msg);
      await admin.from("agent_runs").insert({ conversation_id: convId, agent_id: agent.id, tokens: out.tokens });
      const next = await applyOutput(admin, agents, agent, convId, msg, out.output);
      for (const m of next) for (const id of m.mentions) if (ids.includes(id)) queue.push({ agentId: id, msg: m });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Agent failed";
      await admin.from("agent_runs").insert({ conversation_id: convId, agent_id: agent.id, status: "error" });
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
    await admin.from("agents").update({ status: res.ok ? "online" : "offline", last_seen_at: res.ok ? new Date().toISOString() : agent.last_seen_at }).eq("id", agent.id);
  } catch {
    await admin.from("agents").update({ status: "offline" }).eq("id", agent.id);
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
- Set unused action fields to null.`;

  const input = `Shared memory:\n${(memory ?? []).map((m) => `- (${m.kind}) ${m.content}`).join("\n") || "none"}

Open tasks:\n${taskList}

${canRead ? `Recent conversation:\n${history}` : "(You do not have permission to read history.)"}

Message to respond to (depth ${msg.depth}): ${msg.sender_agent_id ? name({ sender_agent_id: msg.sender_agent_id } as Msg) : "Human"}: ${msg.content}`;
  return runAgentLLM(instructions, input);
}

async function applyOutput(admin: Admin, agents: Agent[], agent: Agent, convId: string, parent: RouterMessage, out: AgentOutput) {
  const posted: RouterMessage[] = [];
  for (const a of out.actions ?? []) {
    if (a.type === "create_task" && a.title && agent.permissions.includes("create_tasks")) {
      const assignee = agents.find((x) => x.handle.toLowerCase() === (a.assignee_handle ?? "").replace("@", "").toLowerCase());
      const { data: t } = await admin.from("tasks").insert({ conversation_id: convId, title: a.title, description: a.description ?? "", assigned_agent_id: assignee?.id ?? agent.id, created_by_agent_id: agent.id }).select().single();
      if (t) await admin.from("messages").insert({ conversation_id: convId, sender_agent_id: agent.id, kind: "task_event", task_id: t.id, content: `${agent.name} created task **${t.title}**${assignee ? ` for ${assignee.name}` : ""}` });
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
    } else if (a.type === "request_approval" && a.approval_action && agent.permissions.includes("request_approval")) {
      const { data: ap } = await admin.from("approvals").insert({ conversation_id: convId, agent_id: agent.id, task_id: a.task_id, action: a.approval_action, details: a.description ?? "" }).select().single();
      if (ap) await admin.from("messages").insert({ conversation_id: convId, sender_agent_id: agent.id, kind: "approval", approval_id: ap.id, content: `I need permission to: **${ap.action}**${ap.details ? `\n\n${ap.details}` : ""}` });
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
