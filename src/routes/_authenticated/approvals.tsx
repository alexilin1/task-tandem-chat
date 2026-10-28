import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAgents } from "@/hooks/use-chat-data";
import { decideApproval, runAgentQueue } from "@/lib/chat.functions";
import { WorkspaceShell, timeAgo, useActiveWorkspace } from "@/components/workspace/WorkspaceShell";
import { AgentAvatar } from "@/components/chat/Avatars";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/approvals")({
  head: () => ({
    meta: [
      { title: "Approvals — AgentChat" },
      { name: "description", content: "Review and decide actions your agents need permission for." },
      { property: "og:title", content: "Approvals — AgentChat" },
      { property: "og:description", content: "Review and decide actions your agents need permission for." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ApprovalsPage,
});

const TYPE_LABEL: Record<string, string> = { deploy: "Deploy", delete: "Delete", spend: "Spend money", external_message: "External message", modify_data: "Modify data", install: "Install integration", access: "Restricted access", other: "Other" };
const STATUS_LABEL: Record<string, string> = { pending: "Pending", approved: "Approved", rejected: "Rejected", changes_requested: "Changes requested", expired: "Expired" };

function ApprovalsPage() {
  const { wsId, wsName } = useActiveWorkspace();
  const { data: agents } = useAgents(wsId);
  const qc = useQueryClient();
  const [tab, setTab] = useState<"pending" | "decided">("pending");
  useEffect(() => {
    if (!wsId) return;
    const ch = supabase.channel(`approvals-${wsId}`).on("postgres_changes", { event: "*", schema: "public", table: "approvals" }, () => qc.invalidateQueries({ queryKey: ["ws-approvals", wsId] })).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [wsId, qc]);
  const { data, isLoading } = useQuery({
    enabled: !!wsId,
    queryKey: ["ws-approvals", wsId],
    queryFn: async () => {
      const { data, error } = await supabase.from("approvals").select("*, conversations!inner(id, title, workspace_id), tasks(title), approval_events(*)").eq("conversations.workspace_id", wsId!).order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data;
    },
  });
  const pending = (data ?? []).filter((a) => a.status === "pending" && new Date(a.expires_at) > new Date());
  const decided = (data ?? []).filter((a) => !pending.includes(a));
  const list = tab === "pending" ? pending : decided;

  return (
    <WorkspaceShell title="Approvals" wsName={wsName}>
      <div className="mb-3 flex gap-1">
        {([["pending", `Waiting for you`, pending.length], ["decided", "History", decided.length]] as const).map(([v, l, n]) => (
          <button key={v} onClick={() => setTab(v)} className={cn("h-7 rounded-md px-2.5 text-[13px] text-muted-foreground transition-ui hover:bg-hover", tab === v && "bg-selected font-medium text-primary")}>{l} <span className="text-xs opacity-70">{n}</span></button>
        ))}
      </div>
      {isLoading || !wsId ? <Skeleton className="h-32" /> : (
        <div className="space-y-3">
          {list.length === 0 && <p className="rounded-xl border border-border p-6 text-center text-sm text-muted-foreground">{tab === "pending" ? "Nothing needs your approval right now." : "No decisions yet."}</p>}
          {list.map((a) => <ApprovalCard key={a.id} a={a} agent={agents?.find((x) => x.id === a.agent_id)} onDone={() => qc.invalidateQueries({ queryKey: ["ws-approvals", wsId] })} />)}
        </div>
      )}
    </WorkspaceShell>
  );
}

function ApprovalCard({ a, agent, onDone }: { a: any; agent: any; onDone: () => void }) {
  const decide = useServerFn(decideApproval);
  const runQueue = useServerFn(runAgentQueue);
  const [busy, setBusy] = useState(false);
  const [noting, setNoting] = useState(false);
  const [note, setNote] = useState("");
  const pending = a.status === "pending" && new Date(a.expires_at) > new Date();

  async function go(decision: "approved" | "rejected" | "changes_requested") {
    setBusy(true);
    try {
      const r = await decide({ data: { approvalId: a.id, decision, note: note.trim() || undefined } });
      runQueue({ data: { conversationId: r.conversationId } }).catch((err) => console.error("Agent queue run failed; the scheduled sweep will retry", err));
      toast.success(decision === "approved" ? "Approved" : decision === "rejected" ? "Rejected" : "Changes requested");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't record your decision");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-border p-4">
      <div className="flex items-start gap-3">
        {agent && <AgentAvatar agent={agent} showStatus={false} />}
        <div className="min-w-0 flex-1">
          <div className="text-[13px] text-muted-foreground">{agent?.name ?? "An agent"} requests approval · {timeAgo(a.created_at)}</div>
          <div className="mt-0.5 text-[15px] font-medium">{a.action}</div>
          <dl className="mt-2 grid grid-cols-[110px_1fr] gap-y-1 text-[13px]">
            <dt className="text-muted-foreground">Type</dt><dd>{TYPE_LABEL[a.action_type] ?? a.action_type}</dd>
            <dt className="text-muted-foreground">Conversation</dt><dd><Link to="/app" search={{ c: a.conversation_id }} className="text-primary hover:underline">{a.conversations?.title}</Link></dd>
            {a.tasks?.title && <><dt className="text-muted-foreground">Task</dt><dd>{a.tasks.title}</dd></>}
            <dt className="text-muted-foreground">Details</dt><dd className="whitespace-pre-wrap">{a.details || "—"}</dd>
            <dt className="text-muted-foreground">{pending ? "Expires" : "Status"}</dt>
            <dd>{pending ? new Date(a.expires_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : STATUS_LABEL[a.status === "pending" ? "expired" : a.status]}{a.decision_note ? ` — ${a.decision_note}` : ""}</dd>
          </dl>
          <p className="mt-2 text-xs text-muted-foreground">Approving allows only this exact action. If the agent changes it, it has to ask again.</p>
          {pending && (
            <div className="mt-3 space-y-2">
              {noting && <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="What should the agent change?" className="text-[13px]" />}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={busy} onClick={() => go("approved")}>Approve</Button>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => go("rejected")}>Reject</Button>
                <Button size="sm" variant="ghost" disabled={busy || (noting && !note.trim())} onClick={() => (noting ? go("changes_requested") : setNoting(true))}>{noting ? "Send change request" : "Request changes"}</Button>
              </div>
            </div>
          )}
          {!!a.approval_events?.length && (
            <ul className="mt-3 space-y-0.5 border-t border-border pt-2 text-xs text-muted-foreground">
              {a.approval_events.sort((x: any, y: any) => x.created_at.localeCompare(y.created_at)).map((e: any) => <li key={e.id}>{new Date(e.created_at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })} — {e.event_type.replace("_", " ")} ({e.actor_type})</li>)}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
