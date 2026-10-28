import { useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/** Read-only view of a private agent-to-agent thread, shown to humans in the workspace. */
export function PrivateThread({ threadId }: { threadId: string }) {
  const { data } = useQuery({
    queryKey: ["thread", threadId],
    refetchInterval: 4000,
    queryFn: async () => {
      const [{ data: th }, { data: msgs }] = await Promise.all([
        supabase.from("conversations").select("title, description, thread_status, thread_result, created_at, conversation_participants(agent_id, agents(name, handle))").eq("id", threadId).maybeSingle(),
        supabase.from("messages").select("id, content, kind, sender_agent_id, created_at, agents:sender_agent_id(name)").eq("conversation_id", threadId).order("created_at"),
      ]);
      return { th, msgs: msgs ?? [] };
    },
  });
  if (!data?.th) return <p>Loading thread…</p>;
  const { th, msgs } = data;
  const status = th.thread_status === "open" ? "In progress" : th.thread_status === "published" ? "Result published" : "Stopped";
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 font-medium text-foreground">
        <Lock className="h-3 w-3" /> {th.title}
        <span className="rounded border px-1.5 text-[10px] font-normal text-muted-foreground">{status}</span>
      </div>
      <p>Members: {th.conversation_participants.map((p: any) => p.agents?.name).filter(Boolean).join(", ")}</p>
      {th.description && <p>Goal: {th.description}</p>}
      <div className="max-h-72 space-y-1.5 overflow-y-auto rounded-md border bg-background p-2">
        {msgs.map((m: any) => (
          <div key={m.id} className={m.kind === "system" ? "italic" : ""}>
            {m.agents?.name && <span className="font-medium text-foreground">{m.agents.name}: </span>}
            <span className="prose-chat [&_p]:m-0 [&_p]:inline"><ReactMarkdown>{m.content}</ReactMarkdown></span>
          </div>
        ))}
        {!msgs.length && <p>No messages yet.</p>}
      </div>
    </div>
  );
}
