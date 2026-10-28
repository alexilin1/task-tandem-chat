import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import {
  Pause,
  Play,
  Plus,
  X,
  FileText,
  Circle,
  CircleDot,
  CircleCheck,
  CircleX,
  CircleDashed,
  ChevronLeft,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setPaused } from "@/lib/chat.functions";
import { cn } from "@/lib/utils";
import { AgentAvatar, AgentStatus, AgentTag, HumanAvatar, providerLabel } from "./Avatars";
import {
  useConversationData,
  type Agent,
  type Conversation,
  type Profile,
} from "@/hooks/use-chat-data";

const taskIcon = {
  pending: [Circle, "text-subtle-foreground", "Pending"],
  running: [CircleDot, "text-primary", "Working"],
  waiting_input: [CircleDashed, "text-warning", "Waiting"],
  completed: [CircleCheck, "text-success", "Completed"],
  failed: [CircleX, "text-destructive", "Failed"],
} as const;

export function RightPanel(props: {
  conv: Conversation;
  agents: Agent[];
  profiles: Profile[];
  myId: string;
  onClose: () => void;
  onOpenAgent: (a: Agent) => void;
  className?: string;
}) {
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
  const tasks = data.tasks.data ?? [];
  const activeTasks = tasks.filter((t) => t.status !== "completed");
  const doneTasks = tasks.filter((t) => t.status === "completed");
  const recent = (data.messages.data ?? [])
    .filter((m) => m.kind === "task_event" || m.kind === "system")
    .slice(-6)
    .reverse();

  async function addAgent(id: string) {
    const { error } = await supabase
      .from("conversation_participants")
      .insert({ conversation_id: conv.id, agent_id: id });
    if (error) toast.error("Couldn't add agent");
    qc.invalidateQueries({ queryKey: ["conversations"] });
  }
  async function removeAgent(id: string) {
    await supabase
      .from("conversation_participants")
      .delete()
      .eq("conversation_id", conv.id)
      .eq("agent_id", id);
    qc.invalidateQueries({ queryKey: ["conversations"] });
  }
  async function addNote() {
    if (!note.trim()) return;
    const { error } = await supabase.from("conversation_memory").insert({
      conversation_id: conv.id,
      content: note.trim(),
      kind: "note",
      created_by_user_id: myId,
    });
    if (error) return void toast.error("Couldn't save note");
    setNote("");
    qc.invalidateQueries({ queryKey: ["conv", conv.id, "memory"] });
  }

  return (
    <aside className={cn("flex h-full flex-col border-l bg-background", props.className)}>
      <div className="flex h-[76px] shrink-0 items-center gap-2 border-b px-3">
        <Button
          size="icon"
          variant="ghost"
          className="h-9 w-9 md:hidden"
          onClick={props.onClose}
          aria-label="Back"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <span className="flex-1 text-sm font-semibold">Details</span>
        <Button
          size="icon"
          variant="ghost"
          className="hidden h-8 w-8 md:inline-flex"
          onClick={props.onClose}
          aria-label="Close details"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <Section title="Agent activity">
          <div className="flex items-center gap-2 px-4">
            <span
              className={cn("h-1.5 w-1.5 rounded-full", conv.paused ? "bg-warning" : "bg-success")}
            />
            <span className="flex-1 text-[13px]">
              {conv.paused ? "Paused" : "Running"}{" "}
              <span className="text-muted-foreground">· max depth {conv.max_depth}</span>
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-7"
              onClick={() => pause({ data: { conversationId: conv.id, paused: !conv.paused } })}
            >
              {conv.paused ? (
                <>
                  <Play className="h-3.5 w-3.5" />
                  Resume
                </>
              ) : (
                <>
                  <Pause className="h-3.5 w-3.5" />
                  Pause
                </>
              )}
            </Button>
          </div>
          {recent.length > 0 && (
            <ul className="mt-2 space-y-1 px-4">
              {recent.map((m) => (
                <li key={m.id} className="truncate text-xs text-muted-foreground">
                  {m.content.replace(/\*\*/g, "")}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Tasks" count={activeTasks.length}>
          {activeTasks.map((t) => (
            <TaskRow key={t.id} t={t} agent={agents.find((a) => a.id === t.assigned_agent_id)} />
          ))}
          {doneTasks.map((t) => (
            <TaskRow key={t.id} t={t} agent={agents.find((a) => a.id === t.assigned_agent_id)} />
          ))}
          {!tasks.length && <Empty>Tasks appear here when agents start work.</Empty>}
        </Section>

        <Section
          title="Agents"
          count={convAgents.length}
          action={
            others.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-6 w-6" aria-label="Add agent">
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {others.map((a) => (
                    <DropdownMenuItem key={a.id} onSelect={() => addAgent(a.id)}>
                      <AgentAvatar agent={a} size="xs" />
                      {a.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )
          }
        >
          {convAgents.map((a) => {
            const act = parts.find((p) => p.agent_id === a.id)?.activity;
            return (
              <div
                key={a.id}
                className="group flex items-center gap-2.5 px-4 py-1.5 transition-ui hover:bg-hover"
              >
                <button
                  className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                  onClick={() => props.onOpenAgent(a)}
                >
                  <AgentAvatar agent={a} size="sm" showStatus={false} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-[13px] font-medium">
                      <span className="truncate">{a.name}</span>
                      <AgentTag />
                    </div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {a.capabilities.join(", ") || providerLabel[a.provider]}
                    </div>
                  </div>
                </button>
                <AgentStatus status={a.status} activity={act} />
                <button
                  className="text-muted-foreground opacity-0 transition-ui hover:text-foreground group-hover:opacity-100"
                  onClick={() => removeAgent(a.id)}
                  aria-label={`Remove ${a.name}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
          {!convAgents.length && <Empty>No agents in this conversation.</Empty>}
        </Section>

        <Section title="People" count={humans.length}>
          {humans.map((h) => {
            const p = profiles.find((x) => x.id === h.user_id);
            return (
              <div key={h.id} className="flex items-center gap-2.5 px-4 py-1.5">
                <HumanAvatar profile={p} size="sm" online={h.user_id === myId} />
                <span className="text-[13px]">
                  {p?.display_name}
                  {h.user_id === myId && <span className="text-muted-foreground"> (you)</span>}
                </span>
              </div>
            );
          })}
        </Section>

        <Section title="Shared context" count={data.memory.data?.length ?? 0}>
          {(data.memory.data ?? []).map((m) => (
            <div key={m.id} className="group flex gap-2 px-4 py-1 text-[13px]">
              <span className="w-16 shrink-0 text-[11px] capitalize leading-5 text-muted-foreground">
                {m.kind}
              </span>
              <span className="flex-1">{m.content}</span>
              <button
                className="text-muted-foreground opacity-0 transition-ui hover:text-foreground group-hover:opacity-100"
                aria-label="Delete note"
                onClick={async () => {
                  await supabase.from("conversation_memory").delete().eq("id", m.id);
                  qc.invalidateQueries({ queryKey: ["conv", conv.id, "memory"] });
                }}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <div className="px-4 pt-1">
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addNote()}
              placeholder="Add a decision or note, press Enter"
              className="h-8 text-[13px]"
            />
          </div>
        </Section>

        <Section title="Files" count={files.length}>
          {files.map((m) => {
            const a = m.attachment as { name: string; path: string };
            return (
              <button
                key={m.id}
                className="flex w-full items-center gap-2.5 px-4 py-1.5 text-left text-[13px] transition-ui hover:bg-hover"
                onClick={async () => {
                  const { data: s } = await supabase.storage
                    .from("attachments")
                    .createSignedUrl(a.path, 300);
                  if (s) window.open(s.signedUrl, "_blank", "noopener");
                  else toast.error("Couldn't open file");
                }}
              >
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{a.name}</span>
              </button>
            );
          })}
          {!files.length && <Empty>No files shared yet.</Empty>}
        </Section>
      </div>
    </aside>
  );
}

function TaskRow({
  t,
  agent,
}: {
  t: { id: string; title: string; status: string; progress: number; is_demo: boolean };
  agent?: Agent | undefined;
}) {
  const [Icon, color, label] = taskIcon[t.status as keyof typeof taskIcon] ?? taskIcon.pending;
  return (
    <div className="flex items-start gap-2.5 px-4 py-1.5" title={label}>
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", color)} />
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "truncate text-[13px]",
            t.status === "completed" && "text-muted-foreground line-through decoration-border",
          )}
        >
          {t.title}
        </div>
        <div className="text-[11px] text-muted-foreground">
          {agent?.name ?? "Unassigned"} · {label}
          {t.status === "running" ? ` ${t.progress}%` : ""}
          {t.is_demo ? " · demo" : ""}
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  count,
  action,
  children,
}: {
  title: string;
  count?: number;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b py-5 last:border-b-0">
      <div className="mb-1.5 flex h-6 items-center gap-1.5 px-4">
        <h2 className="text-[11px] font-medium text-muted-foreground">{title}</h2>
        {count !== undefined && <span className="text-[11px] text-subtle-foreground">{count}</span>}
        <div className="ml-auto">{action}</div>
      </div>
      {children}
    </section>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-1 text-xs text-subtle-foreground">{children}</div>;
}
