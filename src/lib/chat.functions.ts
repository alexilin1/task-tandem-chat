import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { parseMentions, canDecideApproval } from "@/lib/agents/safeguards";

async function assertMember(supabase: any, conversationId: string) {
  const { data } = await supabase.from("conversations").select("id, workspace_id").eq("id", conversationId).maybeSingle();
  if (!data) throw new Error("Conversation not found");
  return data as { id: string; workspace_id: string };
}

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      conversationId: z.string().uuid(),
      content: z.string().max(8000),
      replyTo: z.string().uuid().nullable().optional(),
      attachment: z.object({ path: z.string(), name: z.string(), size: z.number(), type: z.string() }).nullable().optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertMember(supabase, data.conversationId);
    if (!data.content.trim() && !data.attachment) throw new Error("Empty message");
    const { data: parts } = await supabase.from("conversation_participants").select("agent_id, agents(id, handle)").eq("conversation_id", data.conversationId).not("agent_id", "is", null);
    const agents = (parts ?? []).map((p: any) => p.agents).filter(Boolean);
    const mentions = parseMentions(data.content, agents);
    const { data: msg, error } = await supabase
      .from("messages")
      .insert({ conversation_id: data.conversationId, sender_user_id: userId, content: data.content, mentions, reply_to: data.replyTo ?? null, attachment: data.attachment ?? null })
      .select()
      .single();
    if (error || !msg) throw new Error(error?.message ?? "Failed to send");
    await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", data.conversationId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { routeMessage } = await import("@/lib/agents/router.server");
    await routeMessage(supabaseAdmin, msg as any);
    return { id: msg.id };
  });

export const decideApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ approvalId: z.string().uuid(), decision: z.enum(["approved", "rejected"]) }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // RLS: only visible if the human caller is a workspace member.
    const { data: ap } = await supabase.from("approvals").select("*").eq("id", data.approvalId).maybeSingle();
    if (!canDecideApproval({ kind: "user", isMember: !!ap })) throw new Error("Not allowed");
    if (ap!.status !== "pending") throw new Error("Already decided");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("approvals").update({ status: data.decision, decided_by: userId, decided_at: new Date().toISOString() }).eq("id", ap!.id);
    const { data: prof } = await supabase.from("profiles").select("display_name").eq("id", userId).single();
    const { data: agent } = ap!.agent_id ? await supabaseAdmin.from("agents").select("handle").eq("id", ap!.agent_id).single() : { data: null };
    const content = `${data.decision === "approved" ? "✅ Approved" : "❌ Rejected"} by ${prof?.display_name ?? "a human"}: **${ap!.action}**${agent ? ` @${agent.handle}` : ""}`;
    const { data: msg } = await supabaseAdmin.from("messages").insert({ conversation_id: ap!.conversation_id, sender_user_id: userId, kind: "system", content, mentions: ap!.agent_id ? [ap!.agent_id] : [] }).select().single();
    const { routeMessage } = await import("@/lib/agents/router.server");
    if (msg) await routeMessage(supabaseAdmin, msg as any);
    return { ok: true };
  });

export const setPaused = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ conversationId: z.string().uuid(), paused: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await assertMember(supabase, data.conversationId);
    await supabase.from("conversations").update({ paused: data.paused, pause_reason: data.paused ? "Paused by a human" : null }).eq("id", data.conversationId);
    await supabase.from("messages").insert({ conversation_id: data.conversationId, sender_user_id: context.userId, kind: "system", content: data.paused ? "⏸ Agent activity paused" : "▶️ Agent activity resumed" });
    return { ok: true };
  });

export const createAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      workspaceId: z.string().uuid(),
      name: z.string().min(1).max(60),
      handle: z.string().regex(/^[A-Za-z0-9_-]{2,30}$/),
      description: z.string().max(500),
      provider: z.enum(["builtin", "webhook", "rest"]),
      capabilities: z.array(z.string().max(30)).max(12),
      systemPrompt: z.string().max(4000),
      avatarEmoji: z.string().max(8),
      color: z.enum(["violet", "blue", "emerald", "amber", "rose"]),
      permissions: z.array(z.enum(["read_history", "create_tasks", "request_approval"])),
      webhookUrl: z.string().url().startsWith("https://").nullable(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: agent, error } = await supabase
      .from("agents")
      .insert({
        workspace_id: data.workspaceId, name: data.name, handle: data.handle, description: data.description, provider: data.provider,
        capabilities: data.capabilities, system_prompt: data.systemPrompt, avatar_emoji: data.avatarEmoji || "🤖", color: data.color,
        permissions: data.permissions, webhook_url: data.provider === "webhook" ? data.webhookUrl : null,
        status: data.provider === "builtin" ? "online" : "not_connected",
      })
      .select()
      .single();
    if (error || !agent) throw new Error(error?.message.includes("duplicate") ? "That handle is already taken" : error?.message ?? "Failed");
    if (data.provider === "builtin") return { agentId: agent.id, token: null, webhookSecret: null };
    const token = `ac_${crypto.randomUUID().replace(/-/g, "")}${crypto.randomUUID().replace(/-/g, "")}`;
    const webhookSecret = `whsec_${crypto.randomUUID().replace(/-/g, "")}`;
    const { sha256Hex } = await import("@/lib/agents/router.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("agent_credentials").insert({ agent_id: agent.id, token_hash: await sha256Hex(token), webhook_secret: webhookSecret });
    return { agentId: agent.id, token, webhookSecret };
  });
