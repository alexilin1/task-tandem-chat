import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const idInput = (i: unknown) => z.object({ agentId: z.string().uuid() }).parse(i);

/** Checks an agent is reachable. Only a passing check switches it on. */
export const testAgentConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(idInput)
  .handler(async ({ data, context }) => {
    // RLS: the agent is only visible to workspace members.
    const { data: agent } = await context.supabase.from("agents").select("*").eq("id", data.agentId).maybeSingle();
    if (!agent) throw new Error("Agent not found");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let ok = false;
    let detail = "";
    if (agent.provider === "builtin") {
      ok = true;
      detail = "Built-in agent is ready";
    } else if (agent.provider === "webhook") {
      if (!agent.webhook_url) return { ok: false, detail: "No webhook address set" };
      const { data: cred } = await supabaseAdmin.from("agent_credentials").select("webhook_secret").eq("agent_id", agent.id).single();
      const { hmacHex } = await import("@/lib/agents/router.server");
      const body = JSON.stringify({ type: "ping", agent: { id: agent.id, handle: agent.handle }, sent_at: new Date().toISOString() });
      try {
        const res = await fetch(agent.webhook_url, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-AgentChat-Signature": await hmacHex(cred?.webhook_secret ?? "", body) },
          body,
          signal: AbortSignal.timeout(8000),
        });
        ok = res.ok;
        detail = ok ? "Webhook answered the test ping" : `Webhook answered with error ${res.status}`;
      } catch {
        detail = "Couldn't reach the webhook address";
      }
    } else {
      ok = !!agent.last_seen_at;
      detail = ok ? "Agent has called the API" : "Waiting for the agent's first API call with its token";
    }
    if (ok && agent.status !== "online") {
      await supabaseAdmin.from("agents").update({ status: "online", last_seen_at: new Date().toISOString() }).eq("id", agent.id);
    }
    return { ok, detail };
  });

export const setAgentEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ agentId: z.string().uuid(), enabled: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: agent } = await context.supabase.from("agents").select("provider, last_seen_at").eq("id", data.agentId).maybeSingle();
    if (!agent) throw new Error("Agent not found");
    // Turning on an external agent that never connected keeps it "not connected" until a test passes.
    const status = !data.enabled ? "offline" : agent.provider === "builtin" ? "online" : "not_connected";
    const { error } = await context.supabase.from("agents").update({ status }).eq("id", data.agentId);
    if (error) throw new Error(error.message);
    return { status };
  });

export const removeAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(idInput)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("agents").delete().eq("id", data.agentId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
