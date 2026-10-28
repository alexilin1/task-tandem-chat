import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authenticateAgent, agentInConversation, json } from "@/lib/agents/external-auth.server";

const PostBody = z.object({
  conversation_id: z.string().uuid(),
  content: z.string().min(1).max(8000),
  correlation_id: z.string().uuid().optional(),
  depth: z.number().int().min(0).max(100).optional(),
});

export const Route = createFileRoute("/api/public/agents/messages")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const ctx = await authenticateAgent(request);
        if (!ctx) return json({ error: "Unauthorized" }, 401);
        const url = new URL(request.url);
        const conv = url.searchParams.get("conversation_id");
        const since = url.searchParams.get("since");
        if (!conv || !z.string().uuid().safeParse(conv).success) return json({ error: "conversation_id required" }, 400);
        if (!(await agentInConversation(ctx.admin, ctx.agent.id, conv))) return json({ error: "Forbidden" }, 403);
        let q = ctx.admin.from("messages").select("id, conversation_id, sender_user_id, sender_agent_id, content, kind, mentions, task_id, correlation_id, depth, created_at").eq("conversation_id", conv).order("created_at", { ascending: true }).limit(50);
        if (since && !Number.isNaN(Date.parse(since))) q = q.gt("created_at", since);
        const { data } = await q;
        return json({ messages: data ?? [] });
      },
      POST: async ({ request }) => {
        const ctx = await authenticateAgent(request);
        if (!ctx) return json({ error: "Unauthorized" }, 401);
        const parsed = PostBody.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ error: "Invalid body" }, 400);
        const b = parsed.data;
        if (!(await agentInConversation(ctx.admin, ctx.agent.id, b.conversation_id))) return json({ error: "Forbidden" }, 403);
        const { data: parts } = await ctx.admin.from("conversation_participants").select("agent_id").eq("conversation_id", b.conversation_id).not("agent_id", "is", null);
        const { data: agents } = await ctx.admin.from("agents").select("*").in("id", (parts ?? []).map((p: any) => p.agent_id));
        const { insertAgentMessage } = await import("@/lib/agents/router.server");
        const msg = await insertAgentMessage(ctx.admin, agents ?? [], ctx.agent, b.conversation_id, b.content, {
          depth: b.depth ?? 0,
          correlation_id: b.correlation_id ?? crypto.randomUUID(),
        });
        if (!msg) return json({ error: "Failed" }, 500);
        const { enqueueAgentWork } = await import("@/lib/agents/queue.server");
        await enqueueAgentWork(ctx.admin, msg);
        return json({ message: msg }, 201);
      },
    },
  },
});
