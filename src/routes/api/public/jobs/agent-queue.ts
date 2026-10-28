import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

// Scheduled sweep: picks up any agent work that wasn't run right after sending (closed tab, crash, retry).
export const Route = createFileRoute("/api/public/jobs/agent-queue")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { processAgentJobs } = await import("@/lib/agents/queue.server");
        // Expire stale approval requests and trim old activity (keep 90 days).
        const now = new Date().toISOString();
        const { data: expired } = await supabaseAdmin.from("approvals").update({ status: "expired" }).eq("status", "pending").lt("expires_at", now).select("id");
        if (expired?.length) await supabaseAdmin.from("approval_events").insert(expired.map((e) => ({ approval_id: e.id, actor_type: "system", event_type: "expired" })));
        await supabaseAdmin.from("agent_activity_events").delete().lt("created_at", new Date(Date.now() - 90 * 86_400_000).toISOString());
        const r = await processAgentJobs(supabaseAdmin, { limit: 5 });
        return Response.json(r);
      },
    },
  },
});
