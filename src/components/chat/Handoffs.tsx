import ReactMarkdown from "react-markdown";
import { ArrowRightLeft, ChevronRight } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { AgentAvatar } from "./Avatars";
import type { Agent, Handoff, HandoffEvent as HEvent, Message, Task } from "@/hooks/use-chat-data";

const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const STATUS: Record<string, { label: string; tone: string }> = {
  pending: { label: "Pending", tone: "text-muted-foreground" },
  accepted: { label: "In progress", tone: "text-primary" },
  clarification_requested: { label: "Needs clarification", tone: "text-warning" },
  completed: { label: "Completed", tone: "text-success" },
  rejected: { label: "Declined", tone: "text-destructive" },
  failed: { label: "Failed", tone: "text-destructive" },
};

export function HandoffStatus({ status }: { status: string }) {
  const s = STATUS[status] ?? { label: status, tone: "text-muted-foreground" };
  return <span className={cn("text-[11px] font-medium", s.tone)}>{s.label}</span>;
}

/** Compact inline row shown in the chat stream. */
export function HandoffRow({ m, handoff, task, agents, onOpen }: { m: Message; handoff?: Handoff; task?: Task; agents: Agent[]; onOpen: () => void }) {
  const from = agents.find((a) => a.id === handoff?.from_agent_id);
  const to = agents.find((a) => a.id === handoff?.to_agent_id);
  return (
    <div className="my-1 pl-11 pr-4">
      <button onClick={onOpen} className="group flex w-full max-w-md flex-col gap-1 rounded-md border bg-card px-2.5 py-1.5 text-left text-xs transition-ui hover:bg-hover">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <ArrowRightLeft className="h-3.5 w-3.5 shrink-0" />
          <span className="prose-chat min-w-0 flex-1 truncate [&_p]:m-0 [&_p]:inline"><ReactMarkdown>{m.content.replace(/@(\w+)/g, (_, h) => agents.find((a) => a.handle === h)?.name ?? h)}</ReactMarkdown></span>
          <span className="shrink-0 text-[11px] text-subtle-foreground">{time(m.created_at)}</span>
        </span>
        {handoff && (
          <span className="flex items-center gap-2 pl-5">
            <span className="truncate font-medium text-foreground">{task?.title ?? "Task"}</span>
            <span className="shrink-0 text-subtle-foreground">{from?.name} → {to?.name}</span>
            <span className="ml-auto shrink-0"><HandoffStatus status={handoff.status} /></span>
            <ChevronRight className="h-3 w-3 shrink-0 text-subtle-foreground" />
          </span>
        )}
      </button>
    </div>
  );
}

export function HandoffDrawer(props: {
  handoff: Handoff | null;
  onClose: () => void;
  agents: Agent[];
  tasks: Task[];
  events: HEvent[];
  messages: Message[];
}) {
  const h = props.handoff;
  const name = (id: string | null) => props.agents.find((a) => a.id === id)?.name ?? "System";
  const task = props.tasks.find((t) => t.id === h?.task_id);
  const owner = props.agents.find((a) => a.id === task?.assigned_agent_id);
  const events = props.events.filter((e) => e.handoff_id === h?.id);
  const related = props.messages.filter((m) => m.handoff_id === h?.id || (task && m.task_id === task.id));
  return (
    <Sheet open={!!h} onOpenChange={(o) => !o && props.onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {h && (
          <>
            <SheetHeader className="text-left">
              <SheetTitle className="text-base">{task?.title ?? "Handoff"}</SheetTitle>
              <SheetDescription>{name(h.from_agent_id)} → {name(h.to_agent_id)} · <HandoffStatus status={h.status} /></SheetDescription>
            </SheetHeader>
            <div className="mt-4 space-y-5 text-sm">
              <dl className="grid grid-cols-[96px_1fr] gap-x-3 gap-y-1.5 text-[13px]">
                <dt className="text-muted-foreground">Current owner</dt>
                <dd className="flex items-center gap-1.5">{owner && <AgentAvatar agent={owner} size="xs" showStatus={false} />}{owner?.name ?? "Unassigned"}</dd>
                <dt className="text-muted-foreground">Execution</dt><dd>{task ? `${task.status.replace("_", " ")} · ${task.progress}%` : "—"}</dd>
                <dt className="text-muted-foreground">Chain depth</dt><dd>{h.handoff_depth}</dd>
                <dt className="text-muted-foreground">Handoff ID</dt><dd className="truncate font-mono text-[11px] text-muted-foreground">{h.id}</dd>
              </dl>
              {task?.description && <Section title="Task description"><p className="whitespace-pre-wrap text-[13px]">{task.description}</p></Section>}
              {h.context_summary && <Section title="Shared context"><p className="whitespace-pre-wrap text-[13px]">{h.context_summary}</p></Section>}
              {(h.result || task?.result) && (
                <Section title="Result"><div className="prose-chat text-[13px]"><ReactMarkdown>{h.result ?? task?.result ?? ""}</ReactMarkdown></div></Section>
              )}
              <Section title="History">
                <ol className="space-y-2 border-l pl-3">
                  {events.map((e) => (
                    <li key={e.id} className="text-[13px]">
                      <span className="font-medium">{e.event_type.replace("_", " ")}</span>
                      <span className="text-muted-foreground"> · {e.actor_type === "agent" ? name(e.actor_id) : "System"} · {time(e.created_at)}</span>
                      {typeof (e.metadata as { note?: string; error?: string })?.note === "string" && <p className="text-muted-foreground">{(e.metadata as { note: string }).note}</p>}
                      {typeof (e.metadata as { error?: string })?.error === "string" && <p className="text-destructive">{(e.metadata as { error: string }).error}</p>}
                    </li>
                  ))}
                  {!events.length && <li className="text-[13px] text-muted-foreground">No events yet</li>}
                </ol>
              </Section>
              <Section title="Related messages">
                <ul className="space-y-1.5">
                  {related.map((m) => (
                    <li key={m.id} className="text-[13px]"><span className="text-muted-foreground">{name(m.sender_agent_id)}:</span> <span className="prose-chat [&_p]:inline"><ReactMarkdown>{m.content}</ReactMarkdown></span></li>
                  ))}
                </ul>
              </Section>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}
