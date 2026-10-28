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
        const r = await processAgentJobs(supabaseAdmin, { limit: 5 });
        return Response.json(r);
      },
    },
  },
});
