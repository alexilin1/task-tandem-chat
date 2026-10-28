import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAgents } from "@/hooks/use-chat-data";
import { setPaused } from "@/lib/chat.functions";
import { WorkspaceShell, useActiveWorkspace } from "@/components/workspace/WorkspaceShell";
import { AgentAvatar } from "@/components/chat/Avatars";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/activity")({
  head: () => ({
    meta: [
      { title: "Activity — BotsApp" },
      { name: "description", content: "A live timeline of what your agents are doing." },
      { property: "og:title", content: "Activity — BotsApp" },
      { property: "og:description", content: "A live timeline of what your agents are doing." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ActivityPage,
});

const PAGE = 50;
const TONE: Record<string, string> = { failed: "bg-destructive", blocked: "bg-destructive", handoff_blocked: "bg-warning", waiting_approval: "bg-warning", completed: "bg-success", task_completed: "bg-success", started: "bg-primary" };

function ActivityPage() {
  const { wsId, wsName } = useActiveWorkspace();
  const { data: agents } = useAgents(wsId);
  const qc = useQueryClient();
  const [agentFilter, setAgentFilter] = useState("all");
  const [open, setOpen] = useState<any>(null);

  useEffect(() => {
    if (!wsId) return;
    const ch = supabase.channel(`activity-${wsId}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "agent_activity_events", filter: `workspace_id=eq.${wsId}` }, () => qc.invalidateQueries({ queryKey: ["activity", wsId] })).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [wsId, qc]);

  const q = useInfiniteQuery({
    enabled: !!wsId,
    queryKey: ["activity", wsId, agentFilter],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      let req = supabase.from("agent_activity_events").select("*, conversations(title), tasks(title)").eq("workspace_id", wsId!).order("created_at", { ascending: false }).limit(PAGE);
      if (agentFilter !== "all") req = req.eq("agent_id", agentFilter);
      if (pageParam) req = req.lt("created_at", pageParam);
      const { data, error } = await req;
      if (error) throw error;
      return data;
    },
    getNextPageParam: (last) => (last.length === PAGE ? last[last.length - 1]!.created_at : null),
  });
  const events = q.data?.pages.flat() ?? [];
  const agent = (id: string | null) => agents?.find((a) => a.id === id);

  return (
    <WorkspaceShell title="Activity" wsName={wsName}>
      <div className="mb-3 flex items-center gap-2">
        <Select value={agentFilter} onValueChange={setAgentFilter}>
          <SelectTrigger className="h-8 w-48 text-[13px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All agents</SelectItem>
            {(agents ?? []).map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">Live · only recorded events are shown</span>
      </div>
      {q.isLoading || !wsId ? <Skeleton className="h-40" /> : (
        <div className="rounded-xl border border-border">
          {events.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No activity yet. It appears here as soon as an agent starts working.</p>}
          {events.map((e) => {
            const a = agent(e.agent_id);
            return (
              <button key={e.id} onClick={() => setOpen(e)} className="flex w-full items-center gap-3 border-b border-border px-4 py-2.5 text-left text-[13px] transition-ui last:border-0 hover:bg-hover">
                <span className="w-12 shrink-0 text-xs tabular-nums text-muted-foreground">{new Date(e.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", TONE[e.event_type] ?? "bg-subtle-foreground")} />
                {a && <AgentAvatar agent={a} size="xs" showStatus={false} />}
                <span className="min-w-0 flex-1 truncate">{e.summary}</span>
                <span className="hidden max-w-40 truncate text-xs text-muted-foreground sm:block">{e.tasks?.title ?? e.conversations?.title}</span>
              </button>
            );
          })}
        </div>
      )}
      {q.hasNextPage && <Button variant="outline" size="sm" className="mt-3" disabled={q.isFetchingNextPage} onClick={() => q.fetchNextPage()}>Load older</Button>}
      <EventDrawer e={open} agentName={agent(open?.agent_id)?.name} onClose={() => setOpen(null)} />
    </WorkspaceShell>
  );
}

function EventDrawer({ e, agentName, onClose }: { e: any; agentName?: string | undefined; onClose: () => void }) {
  const pause = useServerFn(setPaused);
  const m = (e?.metadata ?? {}) as Record<string, any>;
  const rows: [string, string | undefined][] = e
    ? [
        ["Agent", agentName],
        ["When", new Date(e.created_at).toLocaleString()],
        ["Event", e.event_type.replace(/_/g, " ")],
        ["Task", e.tasks?.title ?? (e.task_id ? e.task_id : undefined)],
        ["Duration", m["duration_ms"] != null ? `${(m["duration_ms"] / 1000).toFixed(1)} s` : undefined],
        ["Model", m["model"]],
        ["Tokens", m["tokens"] != null ? `${m["tokens"]} (${m["input_tokens"] ?? "?"} in / ${m["output_tokens"] ?? "?"} out)` : undefined],
        ["Est. cost", m["estimated_cost_usd"] != null ? `$${Number(m["estimated_cost_usd"]).toFixed(4)} USD (estimate)` : undefined],
        ["Actions", Array.isArray(m["actions"]) && m["actions"].length ? m["actions"].join(", ") : undefined],
        ["Output", m["output_summary"] || undefined],
        ["Error", m["error"]],
      ]
    : [];
  return (
    <Sheet open={!!e} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {e && (
          <>
            <SheetHeader>
              <SheetTitle className="text-[15px]">{e.summary}</SheetTitle>
              <SheetDescription>{e.conversations?.title && e.conversation_id ? <Link to="/app" search={{ c: e.conversation_id }} className="text-primary hover:underline">Open {e.conversations.title}</Link> : "Workspace event"}</SheetDescription>
            </SheetHeader>
            <dl className="mt-4 grid grid-cols-[90px_1fr] gap-y-2 text-[13px]">
              {rows.filter(([, v]) => v).map(([k, v]) => <><dt key={`${k}-k`} className="text-muted-foreground">{k}</dt><dd key={`${k}-v`} className={cn("whitespace-pre-wrap break-words", k === "Error" && "text-destructive")}>{v}</dd></>)}
            </dl>
            {e.conversation_id && (
              <Button variant="outline" size="sm" className="mt-5" onClick={() => pause({ data: { conversationId: e.conversation_id, paused: true } }).then(() => toast.success("Agents paused in that conversation")).catch((err) => toast.error(err instanceof Error ? err.message : "Couldn't pause"))}>
                Pause agents in this conversation
              </Button>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
