import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { checkInviteUsable } from "@/lib/agents/safeguards";

const codeSchema = z.string().trim().min(6).max(32).regex(/^[a-z0-9-]+$/i);

/** Creates a shareable invite link for a workspace the caller belongs to. */
export const createInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ workspaceId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const code = crypto.randomUUID().replace(/-/g, "").slice(0, 10);
    // RLS: insert only succeeds if the caller is a workspace member.
    const { data: invite, error } = await supabase
      .from("workspace_invites")
      .insert({ workspace_id: data.workspaceId, code, created_by: userId })
      .select("code, expires_at")
      .single();
    if (error || !invite) throw new Error("Couldn't create an invite — are you a member of this workspace?");
    return invite;
  });

/** Public-to-members preview: workspace name behind an invite code, so the join page can show what you're joining. */
export const previewInvite = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ code: codeSchema }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: invite } = await supabaseAdmin
      .from("workspace_invites")
      .select("expires_at, uses, max_uses, workspaces(name)")
      .eq("code", data.code)
      .maybeSingle();
    if (!invite) throw new Error("Invite not found — check the link and try again");
    const check = checkInviteUsable(invite);
    if (!check.ok) throw new Error(check.reason);
    return { name: (invite.workspaces as { name: string } | null)?.name ?? "a workspace" };
  });

/** Joins the caller to the workspace behind an invite code. */
export const joinWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ code: codeSchema }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: invite } = await supabaseAdmin.from("workspace_invites").select("*").eq("code", data.code).maybeSingle();
    if (!invite) throw new Error("Invite not found — check the link and try again");
    const check = checkInviteUsable(invite);
    if (!check.ok) throw new Error(check.reason);

    const { data: existing } = await supabaseAdmin
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", invite.workspace_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!existing) {
      const { error } = await supabaseAdmin.from("workspace_members").insert({ workspace_id: invite.workspace_id, user_id: userId, role: "member" });
      if (error) throw new Error("Couldn't join the workspace");
      await supabaseAdmin.from("workspace_invites").update({ uses: invite.uses + 1 }).eq("id", invite.id);
    }
    const { data: ws } = await supabaseAdmin.from("workspaces").select("id, name").eq("id", invite.workspace_id).single();
    return { workspaceId: ws?.id ?? invite.workspace_id, name: ws?.name ?? "the workspace", alreadyMember: !!existing };
  });
