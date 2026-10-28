import { Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { getActiveWorkspaceId, useWorkspaces } from "@/hooks/use-chat-data";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function useActiveWorkspace() {
  const { data: workspaces } = useWorkspaces();
  const [wsId, setWsId] = useState<string | undefined>();
  useEffect(() => {
    if (!workspaces?.length) return;
    const saved = getActiveWorkspaceId();
    setWsId(workspaces.find((w) => w.id === saved)?.id ?? workspaces[0]!.id);
  }, [workspaces]);
  return { wsId, wsName: workspaces?.find((w) => w.id === wsId)?.name };
}

const NAV = [
  { to: "/tasks", label: "Tasks" },
  { to: "/approvals", label: "Approvals" },
  { to: "/activity", label: "Activity" },
  { to: "/usage", label: "Usage & budgets" },
  { to: "/agents", label: "Agents" },
] as const;

export function WorkspaceShell(props: { title: string; wsName?: string | undefined; actions?: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <div className="min-h-screen bg-background">
      <div className={cn("mx-auto px-4 py-6 sm:px-6", props.wide ? "max-w-6xl" : "max-w-4xl")}>
        <div className="mb-4 flex items-center gap-3">
          <Button asChild variant="ghost" size="icon" aria-label="Back to chats">
            <Link to="/app"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold">{props.title}</h1>
            <p className="text-[13px] text-muted-foreground">{props.wsName ?? "Workspace"}</p>
          </div>
          {props.actions}
        </div>
        <nav className="mb-5 flex gap-1 overflow-x-auto border-b border-border">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} className="-mb-px whitespace-nowrap border-b-2 px-3 pb-2 text-[13px] font-medium transition-ui hover:text-foreground" activeProps={{ className: "border-primary text-foreground" }} inactiveProps={{ className: "border-transparent text-muted-foreground" }}>
              {n.label}
            </Link>
          ))}
        </nav>
        {props.children}
      </div>
    </div>
  );
}

export function timeAgo(iso: string) {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}
