import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Pause, Play, Plus, Trash2, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { setPaused } from "@/lib/chat.functions";
import { cn } from "@/lib/utils";
import { AgentAvatar, AgentBadge, HumanAvatar, statusLabel } from "./Avatars";
import { useConversationData, type Agent, type Conversation, type Profile } from "@/hooks/use-chat-data";
import { useQueryClient } from "@tanstack/react-query";

const statusStyle: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  running: "bg-accent text-accent-foreground",
  waiting_input: "bg-warning/25 text-warning-foreground",
  completed: "bg-success/20 text-success",
  failed: "bg-destructive/15 text-destructive",
};

export function RightPanel(props: { conv: Conversation; agents: Agent[]; profiles: Profile[]; myId: string }) {
  const { conv, agents, profiles, myId } = props;
  const data = useConversationData(conv.id);
  const qc = useQueryClient();
  const pause = useServerFn(setPaused);
  const [note, setNote] = useState("");
  const parts = data.participants.data ?? [];
  const convAgents = agents.filter((a) => parts.some((p) => p.agent_id === a.id));
  const humans = parts.filter((p) => p.user_id);
  const others = agents.filter((a) => !convAgents.includes(a));
  const files = (data.messages.data ?? []).filter((m) => m.attachment);
  const pending = (data.approvals.data ?? []).filter((a) => a.status === "pending").length;

  async function addAgent(id: string) {
    const { error } = await supabase.from("conversation_participants").insert({ conversation_id: conv.id, agent_id: id });
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["conversations"] });
  }
  async function removeAgent(id: string) {
    await supabase.from("conversation_participants").delete().eq("conversation_id", conv.id).eq("agent_id", id);
    qc.invalidateQueries({ queryKey: ["conversations"] });
  }
  async function addNote() {
    if (!note.trim()) return;
    await supabase.from("conversation_memory").insert({ conversation_id: conv.id, content: note.trim(), kind: "note", created_by_user_id: myId });
    setNote("");
    qc.invalidateQueries({ queryKey: ["conv", conv.id, "memory"] });
  }

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col overflow-y-auto border-l bg-sidebar">
      <div className="space-y-6 p-4">
        <div className="rounded-2xl border bg-card p-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">Agent activity</div>
              <div className="text-xs text-muted-foreground">{conv.paused ? "Paused" : "Running"} · max depth {conv.max_depth}{pending ? ` · ${pending} approval pending` : ""}</div>
            </div>
            <Button size="sm" variant={conv.paused ? "default" : "outline"} onClick={() => pause({ data: { conversationId: conv.id, paused: !conv.paused } })}>
              {conv.paused ? <><Play className="h-3.5 w-3.5" />Resume</> : <><Pause className="h-3.5 w-3.5" />Stop</>}
            </Button>
          </div>
        </div>

        <Block title={`Tasks (${data.tasks.data?.length ?? 0})`}>
          {(data.tasks.data ?? []).map((t) => {
            const a = agents.find((x) => x.id === t.assigned_agent_id);
            return (
              <div key={t.id} className="rounded-xl border bg-card p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-medium leading-tight">{t.title}</div>
                  <span className={cn("shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold", statusStyle[t.status])}>{t.status.replace("_", " ")}</span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{a ? `${a.avatar_emoji} ${a.name}` : "Unassigned"}{t.is_demo ? " · demo" : ""}</div>
                <Progress value={t.progress} className="mt-2 h-1.5" />
                {t.result && <div className="mt-1.5 line-clamp-3 text-xs">{t.result}</div>}
              </div>
            );
          })}
          {!data.tasks.data?.length && <Muted>Agents will create tasks as they work.</Muted>}
        </Block>

        <Block title={`Agents (${convAgents.length})`}>
          {convAgents.map((a) => {
            const act = parts.find((p) => p.agent_id === a.id)?.activity;
            return (
              <div key={a.id} className="group flex items-start gap-2.5 rounded-xl p-1.5 hover:bg-sidebar-accent">
                <AgentAvatar agent={a} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-sm font-medium">{a.name} <AgentBadge /></div>
                  <div className="text-xs text-muted-foreground">{act ? <span className="text-agent">{act}</span> : `${statusLabel(a.status)} · ${a.provider}`}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {a.capabilities.map((c) => <span key={c} className="rounded bg-secondary px-1.5 text-[10px] text-secondary-foreground">{c}</span>)}
                  </div>
                </div>
                <button className="opacity-0 group-hover:opacity-100" onClick={() => removeAgent(a.id)} title="Remove"><Trash2 className="h-3.5 w-3.5 text-muted-foreground" /></button>
              </div>
            );
          })}
          {others.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {others.map((a) => (
                <Button key={a.id} size="sm" variant="outline" className="h-7 text-xs" onClick={() => addAgent(a.id)}><Plus className="h-3 w-3" />{a.name}</Button>
              ))}
            </div>
          )}
        </Block>

        <Block title={`Humans (${humans.length})`}>
          {humans.map((h) => {
            const p = profiles.find((x) => x.id === h.user_id);
            return (
              <div key={h.id} className="flex items-center gap-2.5 p-1.5">
                <HumanAvatar profile={p} size="sm" online={h.user_id === myId} />
                <span className="text-sm">{p?.display_name}{h.user_id === myId ? " (you)" : ""}</span>
              </div>
            );
          })}
        </Block>

        <Block title="Shared memory">
          {(data.memory.data ?? []).map((m) => (
            <div key={m.id} className="group flex gap-2 rounded-lg bg-card p-2 text-xs">
              <span className="font-semibold capitalize text-agent">{m.kind}</span>
              <span className="flex-1">{m.content}</span>
              <button className="opacity-0 group-hover:opacity-100" onClick={async () => { await supabase.from("conversation_memory").delete().eq("id", m.id); qc.invalidateQueries({ queryKey: ["conv", conv.id, "memory"] }); }}><Trash2 className="h-3 w-3" /></button>
            </div>
          ))}
          <div className="flex gap-1.5">
            <Input value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addNote()} placeholder="Add project context…" className="h-8 text-xs" />
            <Button size="sm" className="h-8" onClick={addNote}>Add</Button>
          </div>
        </Block>

        <Block title={`Shared files (${files.length})`}>
          {files.map((m) => {
            const a = m.attachment as { name: string; path: string };
            return (
              <button key={m.id} className="flex w-full items-center gap-2 rounded-lg p-1.5 text-left text-xs hover:bg-sidebar-accent" onClick={async () => { const { data: s } = await supabase.storage.from("attachments").createSignedUrl(a.path, 300); if (s) window.open(s.signedUrl, "_blank", "noopener"); }}>
                <Paperclip className="h-3.5 w-3.5" /> <span className="truncate">{a.name}</span>
              </button>
            );
          })}
          {!files.length && <Muted>No files shared yet.</Muted>}
        </Block>
      </div>
    </aside>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}
function Muted({ children }: { children: React.ReactNode }) {
  return <div className="text-xs text-muted-foreground">{children}</div>;
}
