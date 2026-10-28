import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Reply,
  SmilePlus,
  FileText,
  Download,
  ListChecks,
  ChevronRight,
  Info,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { AgentAvatar, AgentTag, HumanAvatar } from "./Avatars";
import type { Agent, Message, Profile, Reaction, Task } from "@/hooks/use-chat-data";

const EMOJIS = ["👍", "✅", "👀", "🎉"];
const time = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export function SystemNotice({ m }: { m: Message }) {
  return (
    <div className="my-2 flex items-center justify-center gap-1.5 px-4 text-xs text-muted-foreground">
      <Info className="h-3.5 w-3.5 shrink-0" />
      <span className="prose-chat text-center [&_p]:m-0">
        <ReactMarkdown>{m.content}</ReactMarkdown>
      </span>
      <span className="text-[11px] text-subtle-foreground">· {time(m.created_at)}</span>
    </div>
  );
}

import { PrivateThread } from "./PrivateThread";
export function TaskEvent({
  m,
  task,
  agent,
}: {
  m: Message;
  task?: Task | undefined;
  agent?: Agent | undefined;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="my-1 pl-11 pr-4">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="group flex max-w-full items-center gap-1.5 rounded-md px-1.5 py-0.5 text-left text-xs text-muted-foreground transition-ui hover:bg-hover"
      >
        <ListChecks className="h-3.5 w-3.5 shrink-0" />
        <span className="prose-chat truncate [&_p]:m-0 [&_p]:inline">
          <ReactMarkdown>{m.content.split(" — ")[0] ?? m.content}</ReactMarkdown>
        </span>
        <span className="shrink-0 text-[11px] text-subtle-foreground">· {time(m.created_at)}</span>
        {m.is_demo && <span className="shrink-0 text-[11px] text-subtle-foreground">· demo</span>}
        <ChevronRight
          className={cn("h-3 w-3 shrink-0 transition-transform", open && "rotate-90")}
        />
      </button>
      {open && (
        <div className="ml-1.5 mt-1 border-l pl-3 text-xs text-muted-foreground animate-fade-in">
          {m.thread_id ? (
            <PrivateThread threadId={m.thread_id} />
          ) : task ? (
            <dl className="grid grid-cols-[80px_1fr] gap-x-2 gap-y-1">
              <dt className="text-subtle-foreground">Task</dt>
              <dd className="text-foreground">{task.title}</dd>
              <dt className="text-subtle-foreground">Assignee</dt>
              <dd>{agent?.name ?? "Unassigned"}</dd>
              <dt className="text-subtle-foreground">Status</dt>
              <dd>
                {task.status.replace("_", " ")} · {task.progress}%
              </dd>
              {task.description && (
                <>
                  <dt className="text-subtle-foreground">Details</dt>
                  <dd>{task.description}</dd>
                </>
              )}
              {task.result && (
                <>
                  <dt className="text-subtle-foreground">Result</dt>
                  <dd className="whitespace-pre-wrap">{task.result}</dd>
                </>
              )}
            </dl>
          ) : (
            <div className="prose-chat">
              <ReactMarkdown>{m.content}</ReactMarkdown>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ChatMessage(props: {
  m: Message;
  agent?: Agent | undefined;
  profile?: Profile | undefined;
  isMe: boolean;
  grouped: boolean;
  replyTarget?: { name: string; content: string } | undefined;
  reactions: Reaction[];
  myId: string;
  highlight?: boolean;
  onReply: () => void;
  onReact: (emoji: string) => void;
  onOpenAttachment: (path: string) => void;
}) {
  const { m, agent, isMe, grouped } = props;
  const [copied, setCopied] = useState(false);
  const name = agent?.name ?? props.profile?.display_name ?? "Unknown";
  const att = m.attachment as { path: string; name: string; size: number; type?: string } | null;
  const groupedReactions = props.reactions.reduce<Record<string, Reaction[]>>(
    (acc, r) => ((acc[r.emoji] ??= []).push(r), acc),
    {},
  );

  return (
    <div
      className={cn(
        "group relative flex gap-2.5 px-3 md:px-8 transition-ui",
        grouped ? "pt-0.5" : "pt-3",
        props.highlight && "bg-selected rounded-xl",
        isMe && "flex-row-reverse",
      )}
    >
      <div className={cn("w-8 shrink-0", isMe && "hidden")}>
        {!grouped &&
          !isMe &&
          (agent ? (
            <AgentAvatar agent={agent} showStatus={false} />
          ) : (
            <HumanAvatar profile={props.profile} />
          ))}
      </div>
      <div
        className={cn(
          "flex min-w-0 max-w-[85%] sm:max-w-[min(640px,78%)] flex-col pb-0.5",
          isMe && "items-end",
        )}
      >
        {!grouped && !isMe && (
          <div className="mb-1 flex items-center gap-1.5">
            <span className="text-[13px] font-semibold">{name}</span>
            {agent && <AgentTag />}
            <span className="text-[11px] text-subtle-foreground">{time(m.created_at)}</span>
            {m.is_demo && <span className="text-[11px] text-subtle-foreground">· demo</span>}
          </div>
        )}
        <div
          className={cn(
            "min-w-0 max-w-full rounded-2xl px-3.5 py-2.5 text-sm shadow-soft",
            isMe
              ? "rounded-tr-sm bg-bubble-me text-bubble-me-foreground"
              : agent
                ? "bg-bubble-agent"
                : "bg-bubble-human",
            !isMe && !grouped && "rounded-tl-sm",
          )}
        >
          {props.replyTarget && (
            <div className="mb-1.5 rounded-md border-l-2 border-primary/60 bg-background/60 px-2 py-1 text-xs">
              <div className="font-medium">{props.replyTarget.name}</div>
              <div className="line-clamp-2 text-muted-foreground">{props.replyTarget.content}</div>
            </div>
          )}
          <div className="prose-chat min-w-0 break-words [overflow-wrap:anywhere]">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
          </div>
          {att && (
            <button
              onClick={() => props.onOpenAttachment(att.path)}
              className="mt-2 flex w-64 max-w-full items-center gap-2.5 rounded-lg border bg-background p-2 text-left transition-ui hover:bg-hover"
            >
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-secondary text-muted-foreground">
                <FileText className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium text-foreground">{att.name}</div>
                <div className="text-[11px] text-muted-foreground">{fmtSize(att.size)}</div>
              </div>
              <Download className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          )}
          {isMe && (
            <div className="mt-0.5 text-right text-[11px] text-subtle-foreground">
              {time(m.created_at)}
            </div>
          )}
        </div>
        {Object.keys(groupedReactions).length > 0 && (
          <div className="mt-1 flex gap-1">
            {Object.entries(groupedReactions).map(([e, rs]) => (
              <button
                key={e}
                onClick={() => props.onReact(e)}
                className={cn(
                  "h-6 rounded-full border bg-background px-1.5 text-xs transition-ui hover:bg-hover",
                  rs.some((r) => r.user_id === props.myId) && "border-primary/50 bg-selected",
                )}
              >
                {e} <span className="text-muted-foreground">{rs.length}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div
        className={cn(
          "absolute -top-3 z-10 flex rounded-lg border bg-popover p-0.5 opacity-0 shadow-pop transition-ui focus-within:opacity-100 group-hover:opacity-100",
          isMe ? "left-4" : "right-4",
        )}
      >
        <Popover>
          <PopoverTrigger asChild>
            <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Add reaction">
              <SmilePlus className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="flex w-auto gap-0.5 p-1" side="top">
            {EMOJIS.map((e) => (
              <button
                key={e}
                className="rounded-md px-1.5 py-1 text-base hover:bg-hover"
                onClick={() => props.onReact(e)}
              >
                {e}
              </button>
            ))}
          </PopoverContent>
        </Popover>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={props.onReply}
          aria-label="Reply"
        >
          <Reply className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          aria-label="Copy text"
          onClick={() => {
            navigator.clipboard.writeText(m.content);
            setCopied(true);
            toast.success("Copied");
            setTimeout(() => setCopied(false), 1200);
          }}
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

function fmtSize(b: number) {
  return b < 1024 * 1024
    ? `${Math.max(1, Math.round(b / 1024))} KB`
    : `${(b / 1024 / 1024).toFixed(1)} MB`;
}
