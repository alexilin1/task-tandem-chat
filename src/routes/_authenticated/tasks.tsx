import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAgents } from "@/hooks/use-chat-data";
import { WorkspaceShell, timeAgo, useActiveWorkspace } from "@/components/workspace/WorkspaceShell";
import { AgentAvatar } from "@/components/chat/Avatars";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/tasks")({
  head: () => ({
    meta: [
      { title: "Task inbox — AgentChat" },
      { name: "description", content: "Every task your agents are working on, across all conversations." },
      { property: "og:title", content: "Task inbox — AgentChat" },
      { property: "og:description", content: "Every task your agents are working on, across all conversations." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TasksPage,
});

const FILTERS = [
  ["all", "All"],
  ["assigned", "Assigned"],
  ["running", "In progress"],
  ["waiting_input", "Waiting"],
  ["completed", "Completed"],
  ["failed", "Failed"],
] as const;
const STATUS_LABEL: Record<string, string> = { pending: "Assigned", running: "In progress", waiting_input: "Waiting", completed: "Completed", failed: "Failed" };
const STATUS_DOT: Record<string, string> = { pending: "bg-subtle-foreground", running: "bg-primary", waiting_input: "bg-warning", completed: "bg-success", failed: "bg-destructive" };

export function useWorkspaceTasks(wsId?: string) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!wsId) return;
    const ch = supabase.channel(`tasks-${wsId}`).on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => qc.invalidateQueries({ queryKey: ["ws-tasks", wsId] })).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [wsId, qc]);
  return useQuery({
    enabled: !!wsId,
    queryKey: ["ws-tasks", wsId],
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks").select("*, conversations!inner(id, title, workspace_id)").eq("conversations.workspace_id", wsId!).order("updated_at", { ascending: false }).limit(300);
      if (error) throw error;
      return data;
    },
  });
}

function TasksPage() {
  const { wsId, wsName } = useActiveWorkspace();
  const { data: tasks, isLoading } = useWorkspaceTasks(wsId);
  const { data: agents } = useAgents(wsId);
  const [filter, setFilter] = useState<(typeof FILTERS)[number][0]>("all");
  const [open, setOpen] = useState<string | null>(null);
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: tasks?.length ?? 0 };
    for (const t of tasks ?? []) c[t.status === "pending" ? "assigned" : t.status] = (c[t.status === "pending" ? "assigned" : t.status] ?? 0) + 1;
    return c;
  }, [tasks]);
  const list = (tasks ?? []).filter((t) => filter === "all" || (filter === "assigned" ? t.status === "pending" : t.status === filter));
  const agent = (id: string | null) => agents?.find((a) => a.id === id);

  return (
    <WorkspaceShell title="Task inbox" wsName={wsName} wide>
      <div className="mb-3 flex flex-wrap gap-1">
        {FILTERS.map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)} className={cn("h-7 rounded-md px-2.5 text-[13px] text-muted-foreground transition-ui hover:bg-hover", filter === v && "bg-selected font-medium text-primary")}>
            {l} <span className="ml-0.5 text-xs opacity-70">{counts[v] ?? 0}</span>
          </button>
        ))}
      </div>
      {isLoading || !wsId ? (
        <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <div className="hidden grid-cols-[1fr_160px_160px_110px_80px_90px] gap-3 border-b border-border bg-secondary/50 px-4 py-2 text-[11px] font-medium text-muted-foreground md:grid">
            <span>Task</span><span>Agent</span><span>Conversation</span><span>Status</span><span>Priority</span><span>Updated</span>
          </div>
          {list.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No tasks here. Tasks agents create in chats show up automatically.</p>}
          {list.map((t) => {
            const a = agent(t.assigned_agent_id);
            return (
              <button key={t.id} onClick={() => setOpen(t.id)} className="grid w-full grid-cols-1 gap-1 border-b border-border px-4 py-2.5 text-left text-[13px] transition-ui last:border-0 hover:bg-hover md:grid-cols-[1fr_160px_160px_110px_80px_90px] md:items-center md:gap-3">
                <span className="truncate font-medium">{t.title}</span>
                <span className="flex min-w-0 items-center gap-2 text-muted-foreground">{a ? <><AgentAvatar agent={a} size="xs" showStatus={false} /><span className="truncate">{a.name}</span></> : "Unassigned"}</span>
                <span className="truncate text-muted-foreground">{t.conversations?.title}</span>
                <span className="inline-flex items-center gap-1.5 text-muted-foreground"><span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[t.status])} />{STATUS_LABEL[t.status] ?? t.status}</span>
                <span className={cn("capitalize text-muted-foreground", (t.priority === "high" || t.priority === "urgent") && "font-medium text-foreground")}>{t.priority}</span>
                <span className="text-muted-foreground" title={new Date(t.created_at).toLocaleString()}>{timeAgo(t.updated_at)}</span>
              </button>
            );
          })}
        </div>
      )}
      <TaskDrawer taskId={open} onClose={() => setOpen(null)} task={tasks?.find((t) => t.id === open) ?? null} agents={agents ?? []} />
    </WorkspaceShell>
  );
}

function TaskDrawer({ taskId, task, onClose, agents }: { taskId: string | null; task: any; onClose: () => void; agents: { id: string; name: string }[] }) {
  const { data } = useQuery({
    enabled: !!taskId,
    queryKey: ["task-detail", taskId],
    queryFn: async () => {
      const [msgs, handoffs, deps] = await Promise.all([
        supabase.from("messages").select("id, content, created_at, sender_agent_id, attachment").eq("task_id", taskId!).order("created_at"),
        supabase.from("agent_handoffs").select("*, handoff_events(*)").eq("task_id", taskId!).order("created_at"),
        task?.depends_on?.length ? supabase.from("tasks").select("id, title, status").in("id", task.depends_on) : Promise.resolve({ data: [] as any[] }),
      ]);
      return { msgs: msgs.data ?? [], handoffs: handoffs.data ?? [], deps: deps.data ?? [] };
    },
  });
  const name = (id: string | null) => agents.find((a) => a.id === id)?.name ?? "Agent";
  return (
    <Sheet open={!!taskId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {task && (
          <>
            <SheetHeader>
              <SheetTitle className="text-[15px]">{task.title}</SheetTitle>
              <SheetDescription>{STATUS_LABEL[task.status]} · {name(task.assigned_agent_id)} · <Link to="/app" search={{ c: task.conversation_id }} className="text-primary hover:underline">{task.conversations?.title}</Link></SheetDescription>
            </SheetHeader>
            <div className="mt-4 space-y-5 text-[13px]">
              <Section title="Original request"><p className="whitespace-pre-wrap text-muted-foreground">{task.description || "—"}</p></Section>
              {task.result && <Section title="Result"><p className="whitespace-pre-wrap">{task.result}</p></Section>}
              {!!data?.deps.length && <Section title="Depends on">{data.deps.map((d: any) => <div key={d.id}>{d.title} <span className="text-muted-foreground">· {STATUS_LABEL[d.status]}</span></div>)}</Section>}
              {!!data?.handoffs.length && (
                <Section title="Handoffs">
                  {data.handoffs.map((h: any) => (
                    <div key={h.id} className="rounded-lg border border-border p-2.5">
                      <div className="font-medium">{name(h.from_agent_id)} → {name(h.to_agent_id)} <span className="font-normal text-muted-foreground">· {h.status.replace("_", " ")}</span></div>
                      {h.context_summary && <p className="mt-1 text-muted-foreground">{h.context_summary}</p>}
                      <ul className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
                        {(h.handoff_events ?? []).sort((a: any, b: any) => a.created_at.localeCompare(b.created_at)).map((e: any) => <li key={e.id}>{new Date(e.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} — {e.event_type.replace("_", " ")}</li>)}
                      </ul>
                    </div>
                  ))}
                </Section>
              )}
              <Section title="Updates">
                {(data?.msgs ?? []).length === 0 ? <p className="text-muted-foreground">No updates yet.</p> : (data?.msgs ?? []).map((m: any) => (
                  <div key={m.id} className="border-l-2 border-border pl-2.5">
                    <div className="text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}</div>
                    <div className="whitespace-pre-wrap">{m.content.replace(/\*\*/g, "")}</div>
                    {m.attachment && <div className="text-xs text-primary">{(m.attachment as any).name}</div>}
                  </div>
                ))}
              </Section>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section><h3 className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{title}</h3><div className="space-y-2">{children}</div></section>;
}
