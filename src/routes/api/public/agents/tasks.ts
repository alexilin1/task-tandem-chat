import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authenticateAgent, agentInConversation, json } from "@/lib/agents/external-auth.server";

const Body = z.object({
  task_id: z.string().uuid(),
  status: z.enum(["pending", "running", "waiting_input", "completed", "failed"]).optional(),
  progress: z.number().int().min(0).max(100).optional(),
  result: z.string().max(8000).optional(),
});

export const Route = createFileRoute("/api/public/agents/tasks")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ctx = await authenticateAgent(request);
        if (!ctx) return json({ error: "Unauthorized" }, 401);
        const p = Body.safeParse(await request.json().catch(() => null));
        if (!p.success) return json({ error: "Invalid body" }, 400);
        const { data: t } = await ctx.admin.from("tasks").select("*").eq("id", p.data.task_id).maybeSingle();
        if (!t || !(await agentInConversation(ctx.admin, ctx.agent.id, t.conversation_id))) return json({ error: "Forbidden" }, 403);
        const patch: { updated_at: string; status?: "pending" | "running" | "waiting_input" | "completed" | "failed"; progress?: number; result?: string } = { updated_at: new Date().toISOString() };
        if (p.data.status) patch.status = p.data.status;
        if (p.data.progress != null) patch.progress = p.data.progress;
        if (p.data.result) patch.result = p.data.result;
        await ctx.admin.from("tasks").update(patch).eq("id", t.id);
        await ctx.admin.from("messages").insert({ conversation_id: t.conversation_id, sender_agent_id: ctx.agent.id, kind: "task_event", task_id: t.id, content: `${ctx.agent.name} updated **${t.title}**${p.data.status ? ` → ${p.data.status}` : ""}` });
        return json({ ok: true });
      },
    },
  },
});
