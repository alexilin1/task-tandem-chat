import { cn } from "@/lib/utils";
import type { Agent, Profile } from "@/hooks/use-chat-data";

const colorClass: Record<string, string> = {
  violet: "bg-av-violet",
  blue: "bg-av-blue",
  emerald: "bg-av-emerald",
  amber: "bg-av-amber",
  rose: "bg-av-rose",
};

export function AgentAvatar({ agent, size = "md" }: { agent: Pick<Agent, "avatar_emoji" | "color" | "status">; size?: "sm" | "md" | "lg" }) {
  const s = size === "sm" ? "h-7 w-7 text-sm" : size === "lg" ? "h-12 w-12 text-2xl" : "h-9 w-9 text-lg";
  return (
    <div className="relative shrink-0">
      <div className={cn("grid place-items-center rounded-xl ring-1 ring-agent/30", s, colorClass[agent.color] ?? "bg-av-blue")}>{agent.avatar_emoji}</div>
      <StatusDot status={agent.status} />
    </div>
  );
}

export function HumanAvatar({ profile, size = "md", online }: { profile?: Pick<Profile, "display_name" | "avatar_color">; size?: "sm" | "md"; online?: boolean }) {
  const s = size === "sm" ? "h-7 w-7 text-xs" : "h-9 w-9 text-sm";
  return (
    <div className="relative shrink-0">
      <div className={cn("grid place-items-center rounded-full font-semibold text-foreground", s, colorClass[profile?.avatar_color ?? "violet"])}>
        {(profile?.display_name ?? "?").slice(0, 1).toUpperCase()}
      </div>
      {online && <StatusDot status="online" />}
    </div>
  );
}

export function StatusDot({ status }: { status: string }) {
  const c = status === "online" ? "bg-success" : status === "offline" ? "bg-muted-foreground" : "bg-warning";
  return <span className={cn("absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-background", c)} />;
}

export function AgentBadge() {
  return <span className="rounded-md bg-agent px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-agent-foreground">Agent</span>;
}

export function statusLabel(s: string) {
  return s === "online" ? "Online" : s === "offline" ? "Offline" : "Not connected";
}
