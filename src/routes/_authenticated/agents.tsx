import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Plus, Search } from "lucide-react";
import { getActiveWorkspaceId, useAgents, useWorkspaces, type Agent } from "@/hooks/use-chat-data";
import { createAgent } from "@/lib/chat.functions";
import { setAgentEnabled, testAgentConnection } from "@/lib/agents.functions";
import { AGENT_TEMPLATES, type AgentTemplate } from "@/lib/agents/templates";
import { AgentAvatar, AgentStatus, providerLabel } from "@/components/chat/Avatars";
import { AddAgentDialog } from "@/components/chat/Dialogs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/agents")({
  head: () => ({
    meta: [
      { title: "Agents — AgentChat" },
      { name: "description", content: "Manage your workspace agents and discover new ones to add." },
      { property: "og:title", content: "Agents — AgentChat" },
      { property: "og:description", content: "Manage your workspace agents and discover new ones to add." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AgentsPage,
});

function AgentsPage() {
  const { data: workspaces } = useWorkspaces();
  const [wsId, setWsId] = useState<string | undefined>();
  useEffect(() => {
    if (!workspaces?.length) return;
    const saved = getActiveWorkspaceId();
    setWsId(workspaces.find((w) => w.id === saved)?.id ?? workspaces[0]!.id);
  }, [workspaces]);
  const { data: agents, isLoading } = useAgents(wsId);
  const [tab, setTab] = useState<"mine" | "discover">("mine");
  const [adding, setAdding] = useState(false);
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["agents", wsId] });

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <div className="mb-6 flex items-center gap-3">
          <Button asChild variant="ghost" size="icon" aria-label="Back to chats">
            <Link to="/app"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold">Agents</h1>
            <p className="text-[13px] text-muted-foreground">{workspaces?.find((w) => w.id === wsId)?.name ?? "Workspace"}</p>
          </div>
          <Button onClick={() => setAdding(true)} disabled={!wsId}><Plus className="h-4 w-4" />Add agent</Button>
        </div>

        <div className="mb-4 inline-grid grid-cols-2 gap-1 rounded-lg bg-secondary p-1">
          {([["mine", "Your agents"], ["discover", "Discover"]] as const).map(([v, l]) => (
            <button key={v} onClick={() => setTab(v)} className={cn("h-8 rounded-md px-4 text-[13px] font-medium text-muted-foreground transition-ui", tab === v && "bg-background text-foreground shadow-soft")}>{l}</button>
          ))}
        </div>

        {isLoading || !wsId ? (
          <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
        ) : tab === "mine" ? (
          <div className="divide-y divide-border rounded-xl border border-border">
            {(agents ?? []).length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No agents yet. Add one or pick from Discover.</p>}
            {(agents ?? []).map((a) => <AgentRow key={a.id} agent={a} onChanged={refresh} />)}
          </div>
        ) : (
          <Discover workspaceId={wsId} agents={agents ?? []} onAdded={refresh} />
        )}
      </div>
      {wsId && <AddAgentDialog open={adding} onOpenChange={setAdding} workspaceId={wsId} onCreated={refresh} />}
    </div>
  );
}

function AgentRow({ agent, onChanged }: { agent: Agent; onChanged: () => void }) {
  const toggle = useServerFn(setAgentEnabled);
  const test = useServerFn(testAgentConnection);
  const [busy, setBusy] = useState(false);
  const enabled = agent.status !== "offline";

  async function run<T>(fn: () => Promise<T>, done: (r: T) => void) {
    setBusy(true);
    try { done(await fn()); onChanged(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Something went wrong"); }
    finally { setBusy(false); }
  }

  return (
    <div className="flex items-center gap-3 p-3 sm:p-4">
      <AgentAvatar agent={agent} showStatus={false} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 text-[14px] font-medium">
          {agent.name}<span className="text-xs font-normal text-muted-foreground">@{agent.handle} · {providerLabel[agent.provider] ?? agent.provider}</span>
        </div>
        <div className="truncate text-[13px] text-muted-foreground">{agent.description || "No description"}</div>
        <div className="mt-1"><AgentStatus status={agent.status} /></div>
      </div>
      {agent.status === "not_connected" && (
        <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => test({ data: { agentId: agent.id } }), (r) => (r.ok ? toast.success(`${agent.name} is connected`) : toast.error(r.detail)))}>
          Test connection
        </Button>
      )}
      <Switch
        aria-label={enabled ? `Switch off ${agent.name}` : `Switch on ${agent.name}`}
        checked={enabled}
        disabled={busy}
        onCheckedChange={(v) => run(() => toggle({ data: { agentId: agent.id, enabled: v } }), () => {})}
      />
    </div>
  );
}

function Discover({ workspaceId, agents, onAdded }: { workspaceId: string; agents: Agent[]; onAdded: () => void }) {
  const create = useServerFn(createAgent);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const have = new Set(agents.map((a) => a.handle.toLowerCase()));
  const list = AGENT_TEMPLATES.filter((t) => `${t.name} ${t.description} ${t.capabilities.join(" ")}`.toLowerCase().includes(q.toLowerCase()));

  async function add(t: AgentTemplate) {
    setBusy(t.handle);
    try {
      await create({ data: { workspaceId, name: t.name, handle: t.handle, description: t.description, provider: "builtin", capabilities: t.capabilities, systemPrompt: t.systemPrompt, avatarEmoji: "", color: t.color, permissions: ["read_history", "create_tasks", "request_approval"], webhookUrl: null } });
      toast.success(`${t.name} added`);
      onAdded();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't add agent");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search agents by skill" className="pl-9" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {list.map((t) => {
          const added = have.has(t.handle.toLowerCase());
          return (
            <div key={t.handle} className="flex flex-col rounded-xl border border-border p-4">
              <div className="flex items-center gap-3">
                <AgentAvatar agent={{ name: t.name, color: t.color, status: "online" }} showStatus={false} />
                <div className="min-w-0">
                  <div className="text-[14px] font-medium">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.capabilities.join(", ")}</div>
                </div>
              </div>
              <p className="mt-2 flex-1 text-[13px] text-muted-foreground">{t.description}</p>
              <Button className="mt-3 self-start" size="sm" variant={added ? "outline" : "default"} disabled={added || busy === t.handle} onClick={() => add(t)}>
                {added ? "Added" : busy === t.handle ? "Adding…" : "Add to workspace"}
              </Button>
            </div>
          );
        })}
        {list.length === 0 && <p className="text-sm text-muted-foreground">No agents match that search.</p>}
      </div>
    </div>
  );
}
