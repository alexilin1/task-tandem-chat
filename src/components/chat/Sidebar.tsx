import { useState } from "react";
import { Search, Plus, Bot, LogOut, BookOpen } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BrandMark } from "./BrandMark";
import { AgentAvatar, HumanAvatar, statusLabel } from "./Avatars";
import type { Agent, Profile } from "@/hooks/use-chat-data";

interface ConvItem {
  id: string;
  title: string;
  kind: string;
  paused: boolean;
  conversation_participants: { agent_id: string | null; user_id: string | null }[];
}

export function Sidebar(props: {
  conversations: ConvItem[];
  agents: Agent[];
  me?: Profile;
  activeId?: string;
  onSelect: (id: string) => void;
  onCreateGroup: () => void;
  onAddAgent: () => void;
  onOpenAgentDM: (agent: Agent) => void;
  onSignOut: () => void;
}) {
  const [q, setQ] = useState("");
  const match = (s: string) => s.toLowerCase().includes(q.toLowerCase());
  const groups = props.conversations.filter((c) => c.kind === "group" && match(c.title));
  const dms = props.conversations.filter((c) => c.kind === "dm" && match(c.title));
  const agents = props.agents.filter((a) => match(a.name) || match(a.handle));

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r bg-sidebar">
      <div className="flex items-center gap-2 px-4 pb-3 pt-4">
        <BrandMark size={28} />
        <span className="font-display text-lg font-bold">AgentChat</span>
      </div>
      <div className="px-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search chats & agents" className="h-9 rounded-xl bg-card pl-8" />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button size="sm" onClick={props.onCreateGroup}><Plus className="h-4 w-4" />Group</Button>
          <Button size="sm" variant="secondary" onClick={props.onAddAgent}><Bot className="h-4 w-4" />Add agent</Button>
        </div>
      </div>
      <div className="mt-4 flex-1 space-y-5 overflow-y-auto px-2 pb-4">
        <Section title="Groups">
          {groups.map((c) => (
            <Row key={c.id} active={c.id === props.activeId} onClick={() => props.onSelect(c.id)}>
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-accent font-display font-bold text-accent-foreground">{c.title.slice(0, 1)}</div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{c.title}</div>
                <div className="text-xs text-muted-foreground">
                  {c.conversation_participants.filter((p) => p.agent_id).length} agents · {c.conversation_participants.filter((p) => p.user_id).length} humans
                  {c.paused && " · paused"}
                </div>
              </div>
            </Row>
          ))}
          {!groups.length && <Empty>No groups yet</Empty>}
        </Section>
        <Section title="Direct messages">
          {dms.map((c) => {
            const a = props.agents.find((x) => x.id === c.conversation_participants.find((p) => p.agent_id)?.agent_id);
            return (
              <Row key={c.id} active={c.id === props.activeId} onClick={() => props.onSelect(c.id)}>
                {a ? <AgentAvatar agent={a} /> : <HumanAvatar />}
                <div className="truncate text-sm font-medium">{c.title}</div>
              </Row>
            );
          })}
          {!dms.length && <Empty>Click an agent below to start a DM</Empty>}
        </Section>
        <Section title="Agents">
          {agents.map((a) => (
            <Row key={a.id} onClick={() => props.onOpenAgentDM(a)}>
              <AgentAvatar agent={a} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{a.name}</div>
                <div className="truncate text-xs text-muted-foreground">@{a.handle} · {statusLabel(a.status)}</div>
              </div>
            </Row>
          ))}
        </Section>
      </div>
      <div className="flex items-center gap-2 border-t p-3">
        <HumanAvatar profile={props.me} online />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{props.me?.display_name}</div>
          <div className="text-xs text-success">Online</div>
        </div>
        <Button size="icon" variant="ghost" asChild title="API docs"><Link to="/docs"><BookOpen className="h-4 w-4" /></Link></Button>
        <Button size="icon" variant="ghost" onClick={props.onSignOut} title="Sign out"><LogOut className="h-4 w-4" /></Button>
      </div>
    </aside>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}
function Row({ active, onClick, children }: { active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={cn("flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-sidebar-accent", active && "bg-sidebar-accent")}>
      {children}
    </button>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return <div className="px-2 py-1 text-xs text-muted-foreground">{children}</div>;
}
