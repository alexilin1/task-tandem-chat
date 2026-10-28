import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  getLastRead,
  getActiveWorkspaceId,
  setActiveWorkspaceId,
  useAgents,
  useConversations,
  useProfiles,
  useRecentMessages,
  useWorkspaces,
  type Agent,
  type Conversation,
} from "@/hooks/use-chat-data";
import { useTheme } from "@/hooks/use-theme";
import { AppSidebar, type Preview } from "@/components/chat/Sidebar";
import { ConversationView } from "@/components/chat/ConversationView";
import { RightPanel } from "@/components/chat/RightPanel";
import {
  AddAgentDialog,
  AgentProfileDialog,
  CreateGroupDialog,
  InviteDialog,
} from "@/components/chat/Dialogs";
import { CommandMenu } from "@/components/chat/CommandMenu";
import { EmptyState } from "@/components/chat/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { WelcomeDemo } from "@/components/onboarding/WelcomeDemo";
import { useWelcomeDemo } from "@/hooks/use-welcome-demo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app")({
  validateSearch: (s: Record<string, unknown>): { c?: string | undefined } => ({
    c: typeof s["c"] === "string" ? (s["c"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Chats — AgentChat" },
      {
        name: "description",
        content: "Your AgentChat workspace: conversations, agents and tasks.",
      },
      { property: "og:title", content: "Chats — AgentChat" },
      {
        property: "og:description",
        content: "Your AgentChat workspace: conversations, agents and tasks.",
      },
    ],
  }),
  component: AppPage,
});

function AppPage() {
  const tour = useWelcomeDemo();
  const { user } = Route.useRouteContext();
  const { c } = Route.useSearch();
  const navigate = useNavigate({ from: "/app" });
  const qc = useQueryClient();
  const theme = useTheme();
  const workspaces = useWorkspaces();
  const [activeWsId, setActiveWsId] = useState<string | null>(() => getActiveWorkspaceId());
  const wsList = workspaces.data ?? [];
  const wsData = wsList.find((w) => w.id === activeWsId) ?? wsList[0];
  const convs = useConversations(wsData?.id);
  const agents = useAgents(wsData?.id);
  const profiles = useProfiles();
  const list = convs.data ?? [];
  const recent = useRecentMessages(list.map((x) => x.id));
  const [details, setDetails] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [profileAgent, setProfileAgent] = useState<Agent | null>(null);

  function switchWorkspace(id: string) {
    if (id === wsData?.id) return;
    setActiveWorkspaceId(id);
    setActiveWorkspaceId(id);
    setDetails(false);
    navigate({ search: {}, replace: true });
  }

  const active = list.find((x) => x.id === c);
  const activeConv = active as unknown as Conversation | undefined;

  // Desktop: open the most recent conversation by default. Mobile shows the list first.
  useEffect(() => {
    if (!c && list[0] && window.matchMedia("(min-width: 768px)").matches)
      navigate({ search: { c: list[0].id }, replace: true });
  }, [c, list, navigate]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen((o) => !o);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === ".") {
        e.preventDefault();
        setDetails((d) => !d);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const { previews, unread } = useMemo(() => {
    const previews = new Map<string, Preview>();
    const unread = new Map<string, number>();
    const lastRead = typeof window === "undefined" ? {} : getLastRead();
    for (const m of recent.data ?? []) {
      if (!previews.has(m.conversation_id) && m.kind !== "task_event")
        previews.set(m.conversation_id, m);
      const lr = lastRead[m.conversation_id];
      if (
        m.conversation_id !== c &&
        m.sender_user_id !== user.id &&
        m.kind === "text" &&
        (!lr || m.created_at > lr)
      )
        unread.set(m.conversation_id, (unread.get(m.conversation_id) ?? 0) + 1);
    }
    return { previews, unread };
  }, [recent.data, c, user.id]);

  async function openDM(agent: Agent) {
    setProfileAgent(null);
    const existing = list.find(
      (x) => x.kind === "dm" && x.conversation_participants.some((p) => p.agent_id === agent.id),
    );
    if (existing) return navigate({ search: { c: existing.id } });
    const { data, error } = await supabase
      .from("conversations")
      .insert({ workspace_id: wsData!.id, title: agent.name, kind: "dm", created_by: user.id })
      .select()
      .single();
    if (error || !data) return toast.error("Couldn't start the conversation");
    await supabase.from("conversation_participants").insert([
      { conversation_id: data.id, user_id: user.id },
      { conversation_id: data.id, agent_id: agent.id },
    ]);
    await qc.invalidateQueries({ queryKey: ["conversations"] });
    navigate({ search: { c: data.id } });
  }

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (workspaces.isLoading || convs.isLoading) return <AppSkeleton />;
  if (workspaces.isError || convs.isError) {
    return (
      <div className="grid h-dvh place-items-center">
        <EmptyState
          icon={MessageSquare}
          title="Couldn't load your workspace"
          description="Check your connection and try again."
          action={
            <Button size="sm" variant="outline" onClick={() => location.reload()}>
              Reload
            </Button>
          }
        />
      </div>
    );
  }
  if (!wsData)
    return (
      <div className="grid h-dvh place-items-center text-sm text-muted-foreground">
        No workspace found for your account.
      </div>
    );

  const agentList = agents.data ?? [];
  const profileList = profiles.data ?? [];

  return (
    <div className="flex h-dvh overflow-hidden bg-background text-foreground">
      <AppSidebar
        className={cn(
          "w-full md:w-[320px] lg:w-[360px] md:shrink-0",
          c ? "hidden md:flex" : "flex",
        )}
        workspaceName={wsData.name}
        workspaces={wsList.map((w) => ({ id: w.id, name: w.name }))}
        conversations={list}
        agents={agentList}
        profiles={profileList}
        me={profileList.find((p) => p.id === user.id)}
        myId={user.id}
        previews={previews}
        unread={unread}
        activeId={c}
        onSelect={(id) => navigate({ search: { c: id } })}
        onSwitchWorkspace={switchWorkspace}
        onInvite={() => setInviteOpen(true)}
        onCreateGroup={() => setGroupOpen(true)}
        onAddAgent={() => setAgentOpen(true)}
        onOpenAgent={setProfileAgent}
        onSearch={() => setCmdOpen(true)}
        onSignOut={signOut}
        onShowDemo={tour.show}
      />
      {activeConv ? (
        <>
          <div className={cn("min-w-0 flex-1", details ? "hidden md:flex" : "flex")}>
            <ConversationView
              key={activeConv.id}
              conv={activeConv}
              agents={agentList}
              profiles={profileList}
              myId={user.id}
              detailsOpen={details}
              onToggleDetails={() => setDetails(!details)}
              onBack={() => navigate({ search: {} })}
            />
          </div>
          {details && (
            <RightPanel
              className="w-full animate-fade-in md:w-[300px] md:shrink-0"
              conv={activeConv}
              agents={agentList}
              profiles={profileList}
              myId={user.id}
              onClose={() => setDetails(false)}
              onOpenAgent={setProfileAgent}
            />
          )}
        </>
      ) : (
        <div className="hidden flex-1 items-center justify-center md:flex">
          <EmptyState
            icon={MessageSquare}
            title={list.length ? "Select a conversation" : "No conversations yet"}
            description="Create a group, add agents and give them a shared objective."
            action={
              <Button size="sm" onClick={() => setGroupOpen(true)}>
                New group
              </Button>
            }
          />
        </div>
      )}

      <WelcomeDemo key={tour.session} open={tour.open} onClose={tour.close} authenticated />
      <CommandMenu
        open={cmdOpen}
        onOpenChange={setCmdOpen}
        conversations={list}
        agents={agentList}
        onSelectConversation={(id) => navigate({ search: { c: id } })}
        onOpenAgent={openDM}
        onCreateGroup={() => setGroupOpen(true)}
        onAddAgent={() => setAgentOpen(true)}
        onToggleTheme={theme.toggle}
        onToggleDetails={() => setDetails((d) => !d)}
        onDocs={() => navigate({ to: "/docs" })}
      />
      <AgentProfileDialog
        agent={profileAgent}
        onOpenChange={(o) => !o && setProfileAgent(null)}
        onMessage={openDM}
      />
      <CreateGroupDialog
        open={groupOpen}
        onOpenChange={setGroupOpen}
        workspaceId={wsData.id}
        myId={user.id}
        agents={agentList}
        onCreated={async (id) => {
          await qc.invalidateQueries({ queryKey: ["conversations"] });
          navigate({ search: { c: id } });
        }}
      />
      <AddAgentDialog
        open={agentOpen}
        onOpenChange={(o) => {
          setAgentOpen(o);
          if (!o) qc.invalidateQueries({ queryKey: ["agents"] });
        }}
        workspaceId={wsData.id}
      />
      <InviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        workspaceId={wsData.id}
        workspaceName={wsData.name}
      />
    </div>
  );
}

function AppSkeleton() {
  return (
    <div className="flex h-dvh bg-background">
      <div className="hidden w-[320px] space-y-3 border-r bg-sidebar p-3 md:block">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-8 w-full" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex gap-3 py-1">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-40" />
            </div>
          </div>
        ))}
      </div>
      <div className="flex-1">
        <div className="h-14 border-b" />
      </div>
    </div>
  );
}
