import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import {
  Paperclip,
  Send,
  Users,
  X,
  PanelRightOpen,
  PanelRightClose,
  Search,
  ChevronLeft,
  Pause,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { sendMessage, setPaused } from "@/lib/chat.functions";
import { ChatMessage, SystemNotice, TaskEvent } from "./MessageItem";
import { AgentAvatar, HumanAvatar } from "./Avatars";
import { EmptyState } from "./EmptyState";
import {
  markRead,
  useConversationData,
  type Agent,
  type Conversation,
  type Message,
  type Profile,
} from "@/hooks/use-chat-data";

const GROUP_WINDOW_MS = 5 * 60_000;

export function ConversationView(props: {
  conv: Conversation;
  agents: Agent[];
  profiles: Profile[];
  myId: string;
  detailsOpen: boolean;
  onToggleDetails: () => void;
  onBack: () => void;
}) {
  const { conv, agents, profiles, myId } = props;
  const data = useConversationData(conv.id);
  const qc = useQueryClient();
  const pause = useServerFn(setPaused);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const messages = data.messages.data ?? [];
  const participants = data.participants.data ?? [];
  const convAgents = agents.filter((a) => participants.some((p) => p.agent_id === a.id));
  const humans = participants.filter((p) => p.user_id);
  const working = participants
    .filter((p) => p.agent_id && p.activity)
    .map((p) => agents.find((a) => a.id === p.agent_id))
    .filter(Boolean) as Agent[];
  const byId = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages]);
  const q = query.trim().toLowerCase();
  const matches = q ? messages.filter((m) => m.content.toLowerCase().includes(q)).length : 0;

  useEffect(() => {
    markRead(conv.id);
    if (!q) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length, working.length, conv.id, q]);

  async function react(messageId: string, emoji: string) {
    const mine = (data.reactions.data ?? []).find(
      (r) => r.message_id === messageId && r.user_id === myId && r.emoji === emoji,
    );
    const { error } = mine
      ? await supabase
          .from("reactions")
          .delete()
          .match({ message_id: messageId, user_id: myId, emoji })
      : await supabase.from("reactions").insert({ message_id: messageId, user_id: myId, emoji });
    if (error) toast.error("Couldn't update reaction");
    qc.invalidateQueries({ queryKey: ["conv", conv.id, "reactions"] });
  }

  async function openAttachment(path: string) {
    const { data: s, error } = await supabase.storage
      .from("attachments")
      .createSignedUrl(path, 300);
    if (error || !s) {
      toast.error("Couldn't open this file. You may not have access.");
      return;
    }
    window.open(s.signedUrl, "_blank", "noopener");
  }

  const senderName = (m: Message) =>
    (m.sender_agent_id
      ? agents.find((a) => a.id === m.sender_agent_id)?.name
      : profiles.find((p) => p.id === m.sender_user_id)?.display_name) ?? "Unknown";
  const replyInfo = (id: string) => {
    const m = byId.get(id);
    return m ? { name: senderName(m), content: m.content } : undefined;
  };
  const senderKey = (m: Message) =>
    m.kind === "text" || m.kind === "approval" ? (m.sender_agent_id ?? m.sender_user_id ?? "") : "";

  return (
    <section className="flex h-full min-w-0 flex-1 flex-col chat-canvas">
      <header className="flex h-[76px] shrink-0 items-center gap-3 border-b bg-background px-3 md:px-6">
        <Button
          size="icon"
          variant="ghost"
          className="h-10 w-10 md:hidden"
          onClick={props.onBack}
          aria-label="Back to conversations"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-av-emerald text-primary"
          aria-hidden
        >
          {conv.kind === "dm" && convAgents[0] ? (
            <AgentAvatar agent={convAgents[0]} size="lg" showStatus={false} />
          ) : (
            <Users className="h-5 w-5" />
          )}
        </div>
        <button className="min-w-0 flex-1 text-left" onClick={props.onToggleDetails}>
          <h1 className="truncate text-[16px] font-semibold">{conv.title}</h1>
          <div className="mt-0.5 truncate text-xs text-muted-foreground">
            {working.length ? (
              <span className="text-primary">
                {working.map((a) => a.name).join(", ")} {working.length > 1 ? "are" : "is"} working…
              </span>
            ) : (
              <>
                {humans.length} {humans.length === 1 ? "person" : "people"} · {convAgents.length}{" "}
                {convAgents.length === 1 ? "agent" : "agents"}
              </>
            )}
          </div>
        </button>
        <div className="mr-1 hidden -space-x-1.5 sm:flex">
          {convAgents.slice(0, 4).map((a) => (
            <div key={a.id} className="rounded-full ring-2 ring-background">
              <AgentAvatar agent={a} size="xs" />
            </div>
          ))}
          {humans.slice(0, 2).map((h) => (
            <div key={h.id} className="rounded-full ring-2 ring-background">
              <HumanAvatar profile={profiles.find((p) => p.id === h.user_id)} size="xs" />
            </div>
          ))}
        </div>
        <Button
          size="icon"
          variant="ghost"
          className={cn("h-8 w-8", searching && "bg-hover")}
          onClick={() => {
            setSearching(!searching);
            setQuery("");
          }}
          aria-label="Search in conversation"
        >
          <Search className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="hidden h-8 w-8 md:inline-flex"
          onClick={props.onToggleDetails}
          aria-label="Conversation details"
        >
          {props.detailsOpen ? (
            <PanelRightClose className="h-4 w-4" />
          ) : (
            <PanelRightOpen className="h-4 w-4" />
          )}
        </Button>
      </header>

      {searching && (
        <div className="flex items-center gap-2 border-b px-4 py-2 animate-fade-in">
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && (setSearching(false), setQuery(""))}
            placeholder="Search messages"
            className="h-8"
          />
          <span className="shrink-0 text-xs text-muted-foreground">
            {q ? `${matches} found` : ""}
          </span>
        </div>
      )}

      {conv.paused && (
        <div className="flex items-center gap-2 border-b bg-secondary px-4 py-2 text-[13px]">
          <Pause className="h-3.5 w-3.5 text-warning" />
          <span className="min-w-0 flex-1 truncate">
            <span className="font-medium">Agents paused</span>
            <span className="text-muted-foreground">
              {conv.pause_reason ? ` — ${conv.pause_reason}` : ""}
            </span>
          </span>
          <Button
            size="sm"
            variant="outline"
            className="h-7"
            onClick={() => pause({ data: { conversationId: conv.id, paused: false } })}
          >
            Resume
          </Button>
        </div>
      )}

      <div
        ref={scrollRef}
        className="chat-timeline min-h-0 flex-1 overflow-x-hidden overflow-y-auto py-6"
        role="log"
        aria-live="polite"
      >
        {data.messages.isLoading ? (
          <MessageSkeleton />
        ) : data.messages.isError ? (
          <EmptyState
            icon={MessageSquare}
            title="Couldn't load messages"
            description="Check your connection and try again."
            action={
              <Button size="sm" variant="outline" onClick={() => data.messages.refetch()}>
                Retry
              </Button>
            }
          />
        ) : !messages.length ? (
          <EmptyState
            icon={MessageSquare}
            title="No messages yet"
            description={
              convAgents[0]
                ? `Say hello, or mention @${convAgents[0].handle} to put an agent to work.`
                : "Send the first message."
            }
          />
        ) : (
          messages
            .filter((m) => m.kind !== "approval" && (!q || m.content.toLowerCase().includes(q)))
            .map((m, i, arr) => {
              const prev = arr[i - 1];
              const newDay =
                !prev ||
                new Date(prev.created_at).toDateString() !== new Date(m.created_at).toDateString();
              const grouped =
                !newDay &&
                !q &&
                !!prev &&
                senderKey(prev) === senderKey(m) &&
                senderKey(m) !== "" &&
                new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() <
                  GROUP_WINDOW_MS &&
                !m.reply_to;
              return (
                <Fragment key={m.id}>
                  {newDay && (
                    <div className="flex justify-center py-4">
                      <span className="rounded-lg border bg-background px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-soft">
                        {new Date(m.created_at).toDateString() === new Date().toDateString()
                          ? "Today"
                          : new Date(m.created_at).toLocaleDateString([], {
                              month: "long",
                              day: "numeric",
                              year: "numeric",
                            })}
                      </span>
                    </div>
                  )}
                  {m.kind === "system" ? (
                    <SystemNotice m={m} />
                  ) : m.kind === "task_event" ? (
                    <TaskEvent
                      m={m}
                      task={data.tasks.data?.find((t) => t.id === m.task_id)}
                      agent={agents.find(
                        (a) =>
                          a.id ===
                          data.tasks.data?.find((t) => t.id === m.task_id)?.assigned_agent_id,
                      )}
                    />
                  ) : (
                    <ChatMessage
                      m={m}
                      agent={agents.find((a) => a.id === m.sender_agent_id)}
                      profile={profiles.find((p) => p.id === m.sender_user_id)}
                      isMe={m.sender_user_id === myId && !m.sender_agent_id}
                      grouped={grouped}
                      highlight={!!q}
                      replyTarget={m.reply_to ? replyInfo(m.reply_to) : undefined}
                      reactions={(data.reactions.data ?? []).filter((r) => r.message_id === m.id)}
                      myId={myId}
                      onReply={() => setReplyTo(m.id)}
                      onReact={(e) => react(m.id, e)}
                      onOpenAttachment={openAttachment}
                    />
                  )}
                </Fragment>
              );
            })
        )}
        {working.map((a) => (
          <div key={a.id} className="flex items-center gap-3 px-4 pt-3 animate-fade-in">
            <AgentAvatar agent={a} showStatus={false} />
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="flex gap-0.5">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="h-1 w-1 animate-typing rounded-full bg-muted-foreground"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </span>
              {a.name} is working
            </div>
          </div>
        ))}
      </div>

      <MessageComposer
        conv={conv}
        agents={convAgents}
        replyTo={
          replyTo ? { id: replyTo, ...(replyInfo(replyTo) ?? { name: "", content: "" }) } : null
        }
        onClearReply={() => setReplyTo(null)}
      />
    </section>
  );
}

function MessageSkeleton() {
  return (
    <div className="space-y-5 px-4 py-2">
      {[60, 40, 75, 50].map((w, i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-10 rounded-xl" style={{ width: `${w}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function MessageComposer(props: {
  conv: Conversation;
  agents: Agent[];
  replyTo: { id: string; name: string; content: string } | null;
  onClearReply: () => void;
}) {
  const { conv, agents } = props;
  const send = useServerFn(sendMessage);
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [sel, setSel] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const mentionQuery = /(?:^|\s)@([A-Za-z0-9_-]*)$/.exec(text)?.[1];
  const suggestions =
    mentionQuery !== undefined
      ? agents.filter(
          (a) =>
            a.handle.toLowerCase().startsWith(mentionQuery.toLowerCase()) ||
            a.name.toLowerCase().startsWith(mentionQuery.toLowerCase()),
        )
      : [];

  useEffect(() => setSel(0), [mentionQuery]);
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "0px";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }, [text]);
  useEffect(() => taRef.current?.focus(), [conv.id, props.replyTo?.id]);

  function pick(a: Agent) {
    setText(text.replace(/@([A-Za-z0-9_-]*)$/, `@${a.handle} `));
    taRef.current?.focus();
  }

  async function submit() {
    if ((!text.trim() && !file) || sending) return;
    setSending(true);
    const content = text;
    const reply = props.replyTo?.id ?? null;
    setText("");
    props.onClearReply();
    try {
      let attachment = null;
      if (file) {
        const path = `${conv.id}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, "_")}`;
        const { error } = await supabase.storage.from("attachments").upload(path, file);
        if (error) throw new Error("File upload failed. Files must be under 10 MB.");
        attachment = {
          path,
          name: file.name,
          size: file.size,
          type: file.type || "application/octet-stream",
        };
        setFile(null);
      }
      const p = send({
        data: {
          conversationId: conv.id,
          content: content || "Shared a file",
          replyTo: reply,
          attachment,
        },
      });
      setTimeout(() => qc.invalidateQueries({ queryKey: ["conv", conv.id, "messages"] }), 300);
      await p;
    } catch (e) {
      setText(content);
      toast.error(e instanceof Error ? e.message : "Message not sent. Try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="chat-composer shrink-0 px-3 pt-3 md:px-6">
      <div className="composer-input relative mx-auto max-w-[960px] rounded-[24px] border bg-background p-1 shadow-soft transition-ui focus-within:border-ring/60 focus-within:ring-2 focus-within:ring-ring/15">
        {suggestions.length > 0 && (
          <div
            className="absolute bottom-full left-0 z-20 mb-2 w-72 overflow-hidden rounded-xl border bg-popover p-1 shadow-pop"
            role="listbox"
          >
            <div className="px-2 py-1 text-[11px] font-medium text-muted-foreground">
              Agents in this conversation
            </div>
            {suggestions.map((a, i) => (
              <button
                key={a.id}
                role="option"
                aria-selected={i === sel}
                onMouseEnter={() => setSel(i)}
                onClick={() => pick(a)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
                  i === sel && "bg-hover",
                )}
              >
                <AgentAvatar agent={a} size="sm" showStatus={false} />
                <span className="font-medium">{a.name}</span>
                <span className="ml-auto text-xs text-muted-foreground">@{a.handle}</span>
              </button>
            ))}
          </div>
        )}
        {(props.replyTo || file) && (
          <div className="composer-context mx-3 flex flex-col gap-1 border-b py-2">
            {props.replyTo && (
              <div className="flex items-center gap-2 text-xs">
                <span className="min-w-0 flex-1 truncate text-muted-foreground">
                  Replying to{" "}
                  <span className="font-medium text-foreground">{props.replyTo.name}</span> —{" "}
                  {props.replyTo.content}
                </span>
                <button
                  onClick={props.onClearReply}
                  aria-label="Cancel reply"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            {file && (
              <div className="flex items-center gap-2 text-xs">
                <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{file.name}</span>
                <button
                  onClick={() => setFile(null)}
                  aria-label="Remove attachment"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
        <textarea
          ref={taRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (suggestions.length) {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSel((sel + 1) % suggestions.length);
                return;
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setSel((sel - 1 + suggestions.length) % suggestions.length);
                return;
              }
              if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
                pick(suggestions[sel]!);
                return;
              }
              if (e.key === "Escape") {
                e.preventDefault();
                setText(text + " ");
                return;
              }
            }
            if (e.key === "Escape" && props.replyTo) props.onClearReply();
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={1}
          aria-label="Message"
          placeholder={agents.length ? "Message… type @ to mention an agent" : "Message…"}
          className="block max-h-[200px] w-full resize-none bg-transparent px-3 pt-2.5 text-sm placeholder:text-subtle-foreground focus:outline-none focus-visible:outline-none"
        />
        <div className="composer-controls">
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              e.target.value = "";
            }}
          />
          <Button
            size="icon"
            variant="ghost"
            className="composer-attach h-9 w-9 rounded-full text-muted-foreground"
            onClick={() => fileRef.current?.click()}
            aria-label="Attach file"
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            className="composer-send h-9 w-9 rounded-full"
            onClick={submit}
            disabled={sending || (!text.trim() && !file)}
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
