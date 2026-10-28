import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAgents, useConversations, useProfiles, useWorkspace, type Agent, type Conversation } from "@/hooks/use-chat-data";
import { Sidebar } from "@/components/chat/Sidebar";
import { ConversationView } from "@/components/chat/ConversationView";
import { RightPanel } from "@/components/chat/RightPanel";
import { AddAgentDialog, CreateGroupDialog } from "@/components/chat/Dialogs";
import { BrandMark } from "@/components/chat/BrandMark";

export const Route = createFileRoute("/_authenticated/app")({
  validateSearch: (s: Record<string, unknown>) => ({ c: typeof s["c"] === "string" ? (s["c"] as string) : undefined }),
  head: () => ({
    meta: [
      { title: "Chats — AgentChat" },
      { name: "description", content: "Your AgentChat workspace: groups, agents and tasks." },
      { property: "og:title", content: "Chats — AgentChat" },
      { property: "og:description", content: "Your AgentChat workspace: groups, agents and tasks." },
    ],
  }),
  component: AppPage,
});

function AppPage() {
  const { user } = Route.useRouteContext();
  const { c } = Route.useSearch();
  const navigate = useNavigate({ from: "/app" });
  const qc = useQueryClient();
  const ws = useWorkspace();
  const convs = useConversations(ws.data?.id);
  const agents = useAgents(ws.data?.id);
  const profiles = useProfiles();
  const [panel, setPanel] = useState(true);
  const [groupOpen, setGroupOpen] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);

  const list = convs.data ?? [];
  const active = list.find((x) => x.id === c) ?? list[0];
  useEffect(() => {
    if (!c && list[0]) navigate({ search: { c: list[0].id }, replace: true });
  }, [c, list, navigate]);

  // keep paused banner etc fresh
  const activeConv = active as unknown as Conversation | undefined;

  async function openDM(agent: Agent) {
    const existing = list.find((x) => x.kind === "dm" && x.conversation_participants.some((p) => p.agent_id === agent.id));
    if (existing) return navigate({ search: { c: existing.id } });
    const { data, error } = await supabase.from("conversations").insert({ workspace_id: ws.data!.id, title: agent.name, kind: "dm", created_by: user.id }).select().single();
    if (error || !data) return toast.error(error?.message ?? "Failed");
    await supabase.from("conversation_participants").insert([{ conversation_id: data.id, user_id: user.id }, { conversation_id: data.id, agent_id: agent.id }]);
    await qc.invalidateQueries({ queryKey: ["conversations"] });
    navigate({ search: { c: data.id } });
  }

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (ws.isLoading || convs.isLoading) {
    return <div className="grid h-screen place-items-center bg-background"><div className="animate-pulse"><BrandMark size={44} /></div></div>;
  }
  if (!ws.data) {
    return <div className="grid h-screen place-items-center text-muted-foreground">No workspace found for your account.</div>;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        conversations={list}
        agents={agents.data ?? []}
        me={profiles.data?.find((p) => p.id === user.id)}
        activeId={active?.id}
        onSelect={(id) => navigate({ search: { c: id } })}
        onCreateGroup={() => setGroupOpen(true)}
        onAddAgent={() => setAgentOpen(true)}
        onOpenAgentDM={openDM}
        onSignOut={signOut}
      />
      {activeConv ? (
        <>
          <ConversationView key={activeConv.id} conv={activeConv} agents={agents.data ?? []} profiles={profiles.data ?? []} myId={user.id} onTogglePanel={() => setPanel(!panel)} />
          {panel && <div className="hidden lg:block"><RightPanel conv={activeConv} agents={agents.data ?? []} profiles={profiles.data ?? []} myId={user.id} /></div>}
        </>
      ) : (
        <div className="grid flex-1 place-items-center text-muted-foreground">Create a group to get started.</div>
      )}
      <CreateGroupDialog open={groupOpen} onOpenChange={setGroupOpen} workspaceId={ws.data.id} myId={user.id} agents={agents.data ?? []} onCreated={async (id) => { await qc.invalidateQueries({ queryKey: ["conversations"] }); navigate({ search: { c: id } }); }} />
      <AddAgentDialog open={agentOpen} onOpenChange={(o) => { setAgentOpen(o); if (!o) qc.invalidateQueries({ queryKey: ["agents"] }); }} workspaceId={ws.data.id} />
    </div>
  );
}
