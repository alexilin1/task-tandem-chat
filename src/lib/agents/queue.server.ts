import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { jobStatusAfterFailure } from "./safeguards";

type Admin = SupabaseClient<Database>;

/** Queue agent work for a message. Duplicate enqueues for the same message are ignored. */
export async function enqueueAgentWork(admin: Admin, msg: { id: string; conversation_id: string }) {
  await admin.from("agent_jobs").upsert({ message_id: msg.id, conversation_id: msg.conversation_id }, { onConflict: "message_id", ignoreDuplicates: true });
}

/** Process a bounded batch of queued jobs. Each job is claimed atomically, so parallel runs never double-process. */
export async function processAgentJobs(admin: Admin, opts: { limit: number; conversationId?: string }) {
  const { data: jobs, error } = await admin.rpc("claim_agent_jobs", opts.conversationId ? { _limit: opts.limit, _conversation_id: opts.conversationId } : { _limit: opts.limit });
  if (error) throw new Error(error.message);
  const { routeMessage } = await import("./router.server");
  let done = 0;
  for (const job of jobs ?? []) {
    try {
      const { data: msg } = await admin.from("messages").select("*").eq("id", job.message_id).maybeSingle();
      if (msg) await routeMessage(admin, msg as any);
      await admin.from("agent_jobs").update({ status: "done", locked_until: null, updated_at: new Date().toISOString() }).eq("id", job.id);
      done++;
    } catch (e) {
      const status = jobStatusAfterFailure(job.attempts);
      await admin.from("agent_jobs").update({ status, locked_until: null, last_error: e instanceof Error ? e.message.slice(0, 500) : "failed", updated_at: new Date().toISOString() }).eq("id", job.id);
      if (status === "failed") {
        await admin.from("messages").insert({ conversation_id: job.conversation_id, kind: "system", content: "⚠️ Agents couldn't respond to a message after 3 tries." });
      }
    }
  }
  return { claimed: jobs?.length ?? 0, done };
}
