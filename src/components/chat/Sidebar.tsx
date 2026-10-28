import { useState } from "react";
import {
  Play,
  Search,
  SquarePen,
  ChevronsUpDown,
  LogOut,
  Moon,
  Sun,
  BookOpen,
  UserPlus,
  Users,
  MessageSquare,
  Bot,
  Inbox,
  Link2,
  Check,
  ListChecks,
  ShieldCheck,
  Activity,
  Gauge,
  ChevronDown,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { BrandMark } from "./BrandMark";
import { AgentAvatar, AgentStatus, HumanAvatar, providerLabel } from "./Avatars";
import { EmptyState } from "./EmptyState";
import { useTheme } from "@/hooks/use-theme";
import type { Agent, Profile } from "@/hooks/use-chat-data";

export interface ConvItem {
  id: string;
  title: string;
  kind: string;
  paused: boolean;
  updated_at: string;
  conversation_participants: { agent_id: string | null; user_id: string | null }[];
}
export interface Preview {
  conversation_id: string;
  content: string;
  kind: string;
  sender_user_id: string | null;
  sender_agent_id: string | null;
  created_at: string;
}

type Tab = "all" | "dm" | "group" | "agents";

export function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const diff = (now.getTime() - d.getTime()) / 86_400_000;
  if (diff < 7) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { day: "numeric", month: "short" });
}

export function AppSidebar(props: {
  workspaceName: string;
  workspaces: { id: string; name: string }[];
  conversations: ConvItem[];
  agents: Agent[];
  profiles: Profile[];
  me?: Profile | undefined;
  myId: string;
  previews: Map<string, Preview>;
  unread: Map<string, number>;
  activeId?: string | undefined;
  onSelect: (id: string) => void;
  onSwitchWorkspace: (id: string) => void;
  onInvite: () => void;
  onCreateGroup: () => void;
  onAddAgent: () => void;
  onOpenAgent: (agent: Agent) => void;
  onSearch: () => void;
  onSignOut: () => void;
  onShowDemo?: () => void;
  className?: string;
}) {
  const [tab, setTab] = useState<Tab>("all");
  const { dark, toggle } = useTheme();
  const convs = props.conversations.filter((c) => tab === "all" || c.kind === tab);
  const sorted = [...convs].sort((a, b) =>
    (props.previews.get(b.id)?.created_at ?? b.updated_at).localeCompare(
      props.previews.get(a.id)?.created_at ?? a.updated_at,
    ),
  );

  return (
    <aside className={cn("flex h-full flex-col border-r bg-sidebar", props.className)}>
      <div className="flex h-16 shrink-0 items-center gap-1 px-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1 text-left transition-ui hover:bg-hover">
              <BrandMark size={26} />
              <span className="truncate text-[15px] font-semibold">{props.workspaceName}</span>
              <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
              Workspaces
            </DropdownMenuLabel>
            {props.workspaces.map((w) => (
              <DropdownMenuItem
                key={w.id}
                onSelect={() => props.onSwitchWorkspace(w.id)}
                className="flex items-center gap-2"
              >
                <span className="min-w-0 flex-1 truncate">{w.name}</span>
                {w.name === props.workspaceName && (
                  <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            {props.onShowDemo && (
              <DropdownMenuItem onSelect={props.onShowDemo}>
                <Play className="h-4 w-4" />
                Take the interactive tour
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={props.onInvite}>
              <Link2 className="h-4 w-4" />
              Invite people
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={props.onAddAgent}>
              <UserPlus className="h-4 w-4" />
              Register agent
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/docs">
                <BookOpen className="h-4 w-4" />
                Agent API docs
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={props.onCreateGroup}
          aria-label="New conversation"
        >
          <SquarePen className="h-4 w-4" />
        </Button>
      </div>

      <div className="px-5 pb-4">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-[28px] font-semibold tracking-tight">Messages</h1>
          <span className="text-xs text-muted-foreground">{props.conversations.length} chats</span>
        </div>
        <button
          onClick={props.onSearch}
          className="flex h-11 w-full items-center gap-2.5 rounded-xl bg-secondary px-3.5 text-sm text-muted-foreground transition-ui hover:bg-hover"
        >
          <Search className="h-3.5 w-3.5" /> Search conversations
          <kbd className="ml-auto hidden rounded md:inline border px-1 font-sans text-[10px] text-muted-foreground">
            ⌘K
          </kbd>
        </button>
        <div className="mt-4 flex gap-1.5" role="tablist" aria-label="Conversation filters">
          {(
            [
              ["all", "All"],
              ["dm", "Direct"],
              ["group", "Groups"],
              ["agents", "Agents"],
            ] as const
          ).map(([v, l]) => (
            <button
              key={v}
              role="tab"
              aria-selected={tab === v}
              onClick={() => setTab(v)}
              className={cn(
                "h-8 rounded-full px-3 text-[13px] font-medium text-muted-foreground transition-ui hover:bg-hover hover:text-foreground",
                tab === v && "bg-selected text-primary",
              )}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        {tab === "agents" ? (
          <>
            <div className="flex items-center justify-between px-2 py-1.5">
              <span className="text-[11px] font-medium text-muted-foreground">Agent directory</span>
              <span className="flex items-center gap-3">
                <Link
                  to="/agents"
                  className="text-[12px] font-medium text-muted-foreground hover:text-foreground hover:underline"
                >
                  Manage
                </Link>
                <button
                  onClick={props.onAddAgent}
                  className="text-[12px] font-medium text-primary hover:underline"
                >
                  Register
                </button>
              </span>
            </div>
            {props.agents.map((a) => (
              <button
                key={a.id}
                onClick={() => props.onOpenAgent(a)}
                className="flex w-full items-center gap-3.5 rounded-xl px-3 py-3.5 text-left transition-ui hover:bg-hover"
              >
                <AgentAvatar agent={a} size="lg" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{a.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {providerLabel[a.provider]} · @{a.handle}
                  </div>
                </div>
                <AgentStatus status={a.status} />
              </button>
            ))}
          </>
        ) : sorted.length ? (
          sorted.map((c) => (
            <ConversationListItem
              key={c.id}
              conv={c}
              active={c.id === props.activeId}
              preview={props.previews.get(c.id)}
              unread={props.unread.get(c.id) ?? 0}
              agents={props.agents}
              profiles={props.profiles}
              myId={props.myId}
              onClick={() => props.onSelect(c.id)}
            />
          ))
        ) : (
          <EmptyState
            icon={tab === "dm" ? MessageSquare : tab === "group" ? Users : Inbox}
            title={tab === "dm" ? "No direct messages" : "No conversations"}
            description={
              tab === "dm"
                ? "Open an agent from the directory to message it directly."
                : "Create a group and add agents to start."
            }
            action={
              <Button
                size="sm"
                variant="outline"
                onClick={tab === "dm" ? () => setTab("agents") : props.onCreateGroup}
              >
                {tab === "dm" ? (
                  <>
                    <Bot className="h-4 w-4" />
                    Browse agents
                  </>
                ) : (
                  "New group"
                )}
              </Button>
            }
          />
        )}
      </nav>

      <WorkspaceLinks />

      <div className="flex shrink-0 items-center gap-3 border-t px-5 py-4">
        <HumanAvatar profile={props.me} size="sm" online />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium">
            {props.me?.display_name ?? "Your profile"}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">Personal account</div>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={toggle}
          aria-label="Toggle theme"
        >
          {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={props.onSignOut}
          aria-label="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </aside>
  );
}

function ConversationListItem(props: {
  conv: ConvItem;
  active: boolean;
  preview?: Preview | undefined;
  unread: number;
  agents: Agent[];
  profiles: Profile[];
  myId: string;
  onClick: () => void;
}) {
  const { conv, preview } = props;
  const dmAgent =
    conv.kind === "dm"
      ? props.agents.find(
          (a) => a.id === conv.conversation_participants.find((p) => p.agent_id)?.agent_id,
        )
      : undefined;
  let sender = "";
  if (preview && preview.kind === "text") {
    if (preview.sender_user_id === props.myId && !preview.sender_agent_id) sender = "You: ";
    else if (conv.kind === "group") {
      const n = preview.sender_agent_id
        ? props.agents.find((a) => a.id === preview.sender_agent_id)?.name
        : props.profiles.find((p) => p.id === preview.sender_user_id)?.display_name;
      if (n) sender = `${n}: `;
    }
  }
  const text = preview
    ? preview.content.replace(/[*_`#>]/g, "").replace(/\s+/g, " ")
    : "No messages yet";

  return (
    <button
      onClick={props.onClick}
      aria-current={props.active ? "page" : undefined}
      className={cn(
        "flex w-full items-center gap-3.5 rounded-xl px-3 py-3.5 text-left transition-ui hover:bg-hover",
        props.active && "bg-selected hover:bg-selected",
      )}
    >
      {dmAgent ? (
        <AgentAvatar agent={dmAgent} size="lg" />
      ) : (
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-av-emerald text-primary">
          <Users className="h-5 w-5" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-baseline gap-2">
          <span
            className={cn("truncate text-[15px]", props.unread ? "font-semibold" : "font-medium")}
          >
            {conv.title}
          </span>
          {preview && (
            <span
              className={cn(
                "ml-auto shrink-0 text-[11px]",
                props.unread ? "text-primary" : "text-subtle-foreground",
              )}
            >
              {formatTime(preview.created_at)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="truncate text-[13px] text-muted-foreground">
            {conv.paused ? "Paused · " : ""}
            {sender}
            {text}
          </span>
          {props.unread > 0 && (
            <span className="ml-auto grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
              {props.unread > 99 ? "99+" : props.unread}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function WorkspaceLinks() {
  const [open, setOpen] = useState(false);
  const { data: pending } = useQuery({
    queryKey: ["pending-approvals-count"],
    queryFn: async () => (await supabase.from("approvals").select("id", { count: "exact", head: true }).eq("status", "pending").gt("expires_at", new Date().toISOString())).count ?? 0,
    refetchInterval: 30_000,
  });
  const links = [
    { to: "/tasks", label: "Task inbox", icon: ListChecks },
    { to: "/approvals", label: "Approvals", icon: ShieldCheck, badge: pending },
    { to: "/activity", label: "Activity", icon: Activity },
    { to: "/usage", label: "Usage & budgets", icon: Gauge },
    { to: "/agents", label: "Manage agents", icon: Bot },
  ] as const;
  return (
    <div className="shrink-0 border-t px-2 py-2">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-[11px] font-medium text-muted-foreground transition-ui hover:bg-hover" aria-expanded={open}>
        <span className="flex items-center gap-1.5">Workspace{!open && !!pending && <span className="rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">{pending}</span>}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>
      {open && links.map((l) => (
        <Link key={l.to} to={l.to} className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] transition-ui hover:bg-hover">
          <l.icon className="h-4 w-4 text-muted-foreground" />
          <span className="flex-1">{l.label}</span>
          {"badge" in l && !!l.badge && <span className="rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">{l.badge}</span>}
        </Link>
      ))}
    </div>
  );
}
