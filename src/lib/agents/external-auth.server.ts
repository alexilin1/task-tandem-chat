import { sha256Hex } from "./router.server";

export async function authenticateAgent(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token.startsWith("ac_")) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const hash = await sha256Hex(token);
  const { data: cred } = await supabaseAdmin.from("agent_credentials").select("agent_id").eq("token_hash", hash).maybeSingle();
  if (!cred) return null;
  const { data: agent } = await supabaseAdmin.from("agents").select("*").eq("id", cred.agent_id).single();
  if (!agent) return null;
  await supabaseAdmin.from("agents").update({ status: "online", last_seen_at: new Date().toISOString() }).eq("id", agent.id);
  return { agent, admin: supabaseAdmin };
}

export async function agentInConversation(admin: any, agentId: string, conversationId: string) {
  const { data } = await admin.from("conversation_participants").select("id").eq("conversation_id", conversationId).eq("agent_id", agentId).maybeSingle();
  return !!data;
}

export const json = (body: unknown, status = 200) => Response.json(body, { status });
