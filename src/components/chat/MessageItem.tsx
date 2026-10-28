import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Reply, SmilePlus, Paperclip, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AgentAvatar, AgentBadge, HumanAvatar } from "./Avatars";
import type { Agent, Approval, Message, Profile, Reaction } from "@/hooks/use-chat-data";

const EMOJIS = ["👍", "🎉", "👀", "❤️"];

export function MessageItem(props: {
  m: Message;
  agent?: Agent | undefined;
  profile?: Profile | undefined;
  isMe: boolean;
  replyTarget?: { name: string; content: string } | undefined;
  reactions: Reaction[];
  myId: string;
  approval?: Approval | undefined;
  onReply: () => void;
  onReact: (emoji: string) => void;
  onDecide: (id: string, d: "approved" | "rejected") => void;
  onOpenAttachment: (path: string) => void;
}) {
  const { m, agent, isMe } = props;
  const time = new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  if (m.kind === "system") {
    return (
      <div className="my-2 flex justify-center animate-msg-in">
        <div className="prose-chat max-w-lg rounded-full bg-muted px-4 py-1 text-center text-xs text-muted-foreground"><ReactMarkdown>{m.content}</ReactMarkdown></div>
      </div>
    );
  }
  if (m.kind === "task_event") {
    return (
      <div className="my-1.5 flex justify-center animate-msg-in">
        <div className="prose-chat flex items-center gap-2 rounded-xl border bg-card px-3 py-1.5 text-xs text-muted-foreground">
          <CheckCircle2 className="h-3.5 w-3.5 text-agent" />
          <ReactMarkdown>{m.content}</ReactMarkdown>
          {m.is_demo && <DemoTag />}
        </div>
      </div>
    );
  }

  const grouped = props.reactions.reduce<Record<string, Reaction[]>>((acc, r) => ((acc[r.emoji] ??= []).push(r), acc), {});
  const name = agent?.name ?? props.profile?.display_name ?? "Unknown";
  const att = m.attachment as { path: string; name: string; size: number } | null;

  return (
    <div className={cn("group flex gap-2.5 py-1.5 animate-msg-in", isMe && "flex-row-reverse")}>
      {agent ? <AgentAvatar agent={agent} /> : <HumanAvatar profile={props.profile} />}
      <div className={cn("flex max-w-[72%] flex-col", isMe && "items-end")}>
        <div className={cn("mb-0.5 flex items-center gap-1.5 text-xs", isMe && "flex-row-reverse")}>
          <span className="font-semibold">{isMe ? "You" : name}</span>
          {agent ? <AgentBadge /> : <span className="text-muted-foreground">Human</span>}
          <span className="text-muted-foreground">{time}</span>
          {m.is_demo && <DemoTag />}
          {m.depth > 0 && agent && <span className="text-muted-foreground" title="Agent-to-agent depth">↳{m.depth}</span>}
        </div>
        <div
          className={cn(
            "rounded-2xl px-3.5 py-2 text-sm shadow-soft",
            isMe ? "rounded-tr-md bg-bubble-me text-bubble-me-foreground" : agent ? "rounded-tl-md bg-bubble-agent" : "rounded-tl-md border bg-bubble-human",
          )}
        >
          {props.replyTarget && (
            <div className="mb-1.5 border-l-2 border-current/40 pl-2 text-xs opacity-75">
              <div className="font-semibold">{props.replyTarget.name}</div>
              <div className="line-clamp-2">{props.replyTarget.content}</div>
            </div>
          )}
          <div className="prose-chat break-words">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
          </div>
          {att && (
            <button onClick={() => props.onOpenAttachment(att.path)} className="mt-1.5 flex items-center gap-2 rounded-lg bg-background/60 px-2 py-1 text-xs text-foreground">
              <Paperclip className="h-3.5 w-3.5" /> {att.name} <span className="text-muted-foreground">{Math.ceil(att.size / 1024)} KB</span>
            </button>
          )}
          {m.kind === "approval" && props.approval && (
            <div className="mt-2 rounded-xl border border-warning/60 bg-warning/10 p-2.5">
              <div className="text-xs font-semibold text-warning-foreground">Approval required</div>
              {props.approval.status === "pending" ? (
                <div className="mt-2 flex gap-2">
                  <Button size="sm" onClick={() => props.onDecide(props.approval!.id, "approved")}>Approve</Button>
                  <Button size="sm" variant="outline" onClick={() => props.onDecide(props.approval!.id, "rejected")}>Reject</Button>
                </div>
              ) : (
                <div className="mt-1 text-xs">{props.approval.status === "approved" ? "✅ Approved" : "❌ Rejected"}</div>
              )}
            </div>
          )}
        </div>
        {Object.keys(grouped).length > 0 && (
          <div className="mt-1 flex gap-1">
            {Object.entries(grouped).map(([e, rs]) => (
              <button key={e} onClick={() => props.onReact(e)} className={cn("rounded-full border bg-card px-1.5 text-xs", rs.some((r) => r.user_id === props.myId) && "border-primary")}>
                {e} {rs.length}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-start gap-0.5 self-center opacity-0 transition-opacity group-hover:opacity-100">
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={props.onReply} title="Reply"><Reply className="h-3.5 w-3.5" /></Button>
        <div className="relative">
          <div className="peer"><Button size="icon" variant="ghost" className="h-7 w-7" title="React"><SmilePlus className="h-3.5 w-3.5" /></Button></div>
          <div className="absolute bottom-full left-1/2 z-10 hidden -translate-x-1/2 gap-0.5 rounded-full border bg-popover p-1 shadow-soft hover:flex peer-hover:flex">
            {EMOJIS.map((e) => (
              <button key={e} className="rounded-full px-1 hover:bg-muted" onClick={() => props.onReact(e)}>{e}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DemoTag() {
  return <span className="rounded bg-warning/30 px-1 text-[10px] font-medium text-warning-foreground">Demo</span>;
}
