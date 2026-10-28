import { Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Agent, Profile } from "@/hooks/use-chat-data";

const tint: Record<string, string> = {
  violet: "bg-av-violet",
  blue: "bg-av-blue",
  emerald: "bg-av-emerald",
  amber: "bg-av-amber",
  rose: "bg-av-rose",
};

const sizes = {
  xs: "h-5 w-5 text-[9px]",
  sm: "h-7 w-7 text-[11px]",
  md: "h-8 w-8 text-xs",
  lg: "h-10 w-10 text-sm",
} as const;
type Size = keyof typeof sizes;

export function initials(name: string) {
  const words = name.replace(/agent$/i, "").trim().split(/\s+/).filter(Boolean);
  const w = words.length ? words : [name];
  return ((w[0]?.[0] ?? "") + (w[1]?.[0] ?? "")).toUpperCase() || "?";
}

export function AgentAvatar({ agent, size = "md", showStatus = true }: { agent: Pick<Agent, "name" | "color" | "status">; size?: Size; showStatus?: boolean }) {
  return (
    <div className="relative shrink-0" aria-hidden>
      <div className={cn("grid place-items-center rounded-full font-semibold text-av-ink", sizes[size], tint[agent.color] ?? "bg-av-blue")}>
        {initials(agent.name)}
      </div>
      {size !== "xs" && (
        <span className="absolute -bottom-0.5 -right-0.5 grid h-3.5 w-3.5 place-items-center rounded-full bg-foreground text-background ring-2 ring-background">
          <Bot className="h-2.5 w-2.5" strokeWidth={2.5} />
        </span>
      )}
      {showStatus && size !== "xs" && agent.status !== "online" && (
        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-subtle-foreground ring-2 ring-background" />
      )}
    </div>
  );
}

export function HumanAvatar({ profile, size = "md", online }: { profile?: Pick<Profile, "display_name"> | undefined; size?: Size; online?: boolean }) {
  return (
    <div className="relative shrink-0" aria-hidden>
      <div className={cn("grid place-items-center rounded-full bg-secondary font-semibold text-muted-foreground ring-1 ring-border", sizes[size])}>
        {initials(profile?.display_name ?? "?")}
      </div>
      {online && size !== "xs" && <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-success ring-2 ring-background" />}
    </div>
  );
}

export function AgentTag() {
  return <span className="rounded border border-border px-1 text-[10px] font-medium leading-4 text-muted-foreground">Agent</span>;
}

export type ExecState = "working" | "waiting" | "completed" | "failed" | "idle";

export function AgentStatus({ status, activity }: { status: string; activity?: string | null | undefined }) {
  if (activity) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-primary">
        <span className="h-1.5 w-1.5 animate-typing rounded-full bg-primary" /> Working
      </span>
    );
  }
  const map: Record<string, [string, string]> = {
    online: ["bg-success", "Online"],
    offline: ["bg-subtle-foreground", "Offline"],
    not_connected: ["bg-warning", "Not connected"],
  };
  const [dot, label] = map[status] ?? map["offline"]!;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className={cn("h-1.5 w-1.5 rounded-full", dot)} /> {label}
    </span>
  );
}

export function statusLabel(s: string) {
  return s === "online" ? "Online" : s === "offline" ? "Offline" : "Not connected";
}

export const providerLabel: Record<string, string> = { builtin: "Built-in · GPT", webhook: "Webhook", rest: "REST API" };
