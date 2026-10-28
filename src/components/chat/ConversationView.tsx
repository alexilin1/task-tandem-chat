import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Paperclip, Send, X, PanelRight, PauseCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { sendMessage, decideApproval, setPaused } from "@/lib/chat.functions";
import { MessageItem } from "./MessageItem";
import { AgentAvatar } from "./Avatars";
import type { Agent, Conversation, Profile } from "@/hooks/use-chat-data";
import { useConversationData } from "@/hooks/use-chat-data";
import { useQueryClient } from "@tanstack/react-query";

export function ConversationView(props: { conv: Conversation; agents: Agent[]; profiles: Profile[]; myId: string; onTogglePanel: () => void }) {
  const { conv, agents, profiles, myId } = props;
  const data = useConversationData(conv.id);
  const qc = useQueryClient();
  const send = useServerFn(sendMessage);
  const decide = useServerFn(decideApproval);
  const pause = useServerFn(setPaused);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const messages = data.messages.data ?? [];
  const participants = data.participants.data ?? [];
  const convAgents = agents.filter((a) => participants.some((p) => p.agent_id === a.id));
  const working = participants.filter((p) => p.agent_id && p.activity).map((p) => agents.find((a) => a.id === p.agent_id)).filter(Boolean) as Agent[];
  const byId = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, working.length]);

  const mentionQuery = /@([A-Za-z0-9_-]*)$/.exec(text)?.[1];
  const suggestions = mentionQuery !== undefined ? convAgents.filter((a) => a.handle.toLowerCase().startsWith(mentionQuery.toLowerCase())) : [];

  async function submit() {
    if ((!text.trim() && !file) || sending) return;
    setSending(true);
    const content = text;
    const reply = replyTo;
    setText("");
    setReplyTo(null);
    try {
      let attachment = null;
      if (file) {
        const path = `${conv.id}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, "_")}`;
        const { error } = await supabase.storage.from("attachments").upload(path, file);
        if (error) throw error;
        attachment = { path, name: file.name, size: file.size, type: file.type || "application/octet-stream" };
        setFile(null);
      }
      const p = send({ data: { conversationId: conv.id, content: content || `Shared a file`, replyTo: reply, attachment } });
      // message shows via realtime; agent routing continues server-side
      setTimeout(() => qc.invalidateQueries({ queryKey: ["conv", conv.id, "messages"] }), 400);
      await p;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send");
    } finally {
      setSending(false);
    }
  }

  async function react(messageId: string, emoji: string) {
    const mine = (data.reactions.data ?? []).find((r) => r.message_id === messageId && r.user_id === myId && r.emoji === emoji);
    if (mine) await supabase.from("reactions").delete().match({ message_id: messageId, user_id: myId, emoji });
    else await supabase.from("reactions").insert({ message_id: messageId, user_id: myId, emoji });
    qc.invalidateQueries({ queryKey: ["conv", conv.id, "reactions"] });
  }

  async function openAttachment(path: string) {
    const { data: s, error } = await supabase.storage.from("attachments").createSignedUrl(path, 300);
    if (error || !s) {
      toast.error("Could not open file");
      return;
    }
    window.open(s.signedUrl, "_blank", "noopener");
  }

  const nameOf = (id: string) => {
    const m = byId.get(id);
    if (!m) return undefined;
    const n = m.sender_agent_id ? agents.find((a) => a.id === m.sender_agent_id)?.name : profiles.find((p) => p.id === m.sender_user_id)?.display_name;
    return { name: n ?? "Unknown", content: m.content };
  };

  return (
    <section className="flex min-w-0 flex-1 flex-col">
      <header className="flex items-center justify-between border-b bg-card/60 px-5 py-3 backdrop-blur">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-bold">{conv.title}</h2>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            {working.length ? (
              <span className="text-agent">{working.map((a) => a.name).join(", ")} working…</span>
            ) : (
              <span>{convAgents.map((a) => `@${a.handle}`).join(" ") || "No agents yet"}</span>
            )}
          </div>
        </div>
        <Button size="icon" variant="ghost" onClick={props.onTogglePanel} title="Details"><PanelRight className="h-5 w-5" /></Button>
      </header>

      {conv.paused && (
        <div className="flex items-center justify-between gap-3 border-b border-warning/40 bg-warning/15 px-5 py-2 text-sm">
          <span className="flex items-center gap-2"><PauseCircle className="h-4 w-4" />Agents paused{conv.pause_reason ? ` — ${conv.pause_reason}` : ""}</span>
          <Button size="sm" variant="outline" onClick={() => pause({ data: { conversationId: conv.id, paused: false } })}>Resume</Button>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4">
        {messages.map((m) => (
          <MessageItem
            key={m.id}
            m={m}
            agent={agents.find((a) => a.id === m.sender_agent_id)}
            profile={profiles.find((p) => p.id === m.sender_user_id)}
            isMe={m.sender_user_id === myId && !m.sender_agent_id}
            replyTarget={m.reply_to ? nameOf(m.reply_to) : undefined}
            reactions={(data.reactions.data ?? []).filter((r) => r.message_id === m.id)}
            myId={myId}
            approval={(data.approvals.data ?? []).find((a) => a.id === m.approval_id)}
            onReply={() => setReplyTo(m.id)}
            onReact={(e) => react(m.id, e)}
            onDecide={async (id, d) => {
              try {
                await decide({ data: { approvalId: id, decision: d } });
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Failed");
              }
            }}
            onOpenAttachment={openAttachment}
          />
        ))}
        {working.map((a) => (
          <div key={a.id} className="flex items-center gap-2.5 py-1.5 animate-msg-in">
            <AgentAvatar agent={a} />
            <div className="flex gap-1 rounded-2xl bg-bubble-agent px-3 py-3">
              {[0, 1, 2].map((i) => <span key={i} className="h-1.5 w-1.5 rounded-full bg-agent animate-typing" style={{ animationDelay: `${i * 0.15}s` }} />)}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t bg-card/60 p-3">
        {replyTo && (
          <div className="mb-2 flex items-center justify-between rounded-lg bg-muted px-3 py-1.5 text-xs">
            <span className="truncate">Replying to <b>{nameOf(replyTo)?.name}</b>: {nameOf(replyTo)?.content}</span>
            <button onClick={() => setReplyTo(null)}><X className="h-3.5 w-3.5" /></button>
          </div>
        )}
        {file && (
          <div className="mb-2 flex items-center justify-between rounded-lg bg-muted px-3 py-1.5 text-xs">
            <span className="truncate">📎 {file.name}</span>
            <button onClick={() => setFile(null)}><X className="h-3.5 w-3.5" /></button>
          </div>
        )}
        <div className="relative flex items-end gap-2">
          {suggestions.length > 0 && (
            <div className="absolute bottom-full left-10 mb-2 w-64 overflow-hidden rounded-xl border bg-popover shadow-soft">
              {suggestions.map((a) => (
                <button key={a.id} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => setText(text.replace(/@([A-Za-z0-9_-]*)$/, `@${a.handle} `))}>
                  <AgentAvatar agent={a} size="sm" /> <span className="font-medium">{a.name}</span> <span className="text-muted-foreground">@{a.handle}</span>
                </button>
              ))}
            </div>
          )}
          <input ref={fileRef} type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <Button size="icon" variant="ghost" onClick={() => fileRef.current?.click()} title="Attach file"><Paperclip className="h-5 w-5" /></Button>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={1}
            placeholder={convAgents[0] ? `Message… use @${convAgents[0].handle} to ask an agent` : "Message…"}
            className="max-h-40 min-h-11 resize-none rounded-2xl bg-card"
          />
          <Button size="icon" className="h-11 w-11 shrink-0 rounded-2xl" onClick={submit} disabled={sending && !text} title="Send"><Send className="h-4 w-4" /></Button>
        </div>
      </div>
    </section>
  );
}
