import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAgents } from "@/hooks/use-chat-data";
import { WorkspaceShell, useActiveWorkspace } from "@/components/workspace/WorkspaceShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/usage")({
  head: () => ({
    meta: [
      { title: "Usage & budgets — AgentChat" },
      { name: "description", content: "See what your agents spend and set limits." },
      { property: "og:title", content: "Usage & budgets — AgentChat" },
      { property: "og:description", content: "See what your agents spend and set limits." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UsagePage,
});

const usd = (n: number) => `$${n.toFixed(n < 1 ? 4 : 2)}`;

function UsagePage() {
  const { wsId, wsName } = useActiveWorkspace();
  const { data: agents } = useAgents(wsId);
  const qc = useQueryClient();
  const monthStart = useMemo(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString(); }, []);
  const runs = useQuery({
    enabled: !!wsId,
    queryKey: ["usage-runs", wsId],
    queryFn: async () => {
      const { data, error } = await supabase.from("agent_runs").select("id, agent_id, conversation_id, tokens, model, status, estimated_cost_usd, created_at, conversations(title)").eq("workspace_id", wsId!).gte("created_at", monthStart).order("created_at", { ascending: false }).limit(2000);
      if (error) throw error;
      return data;
    },
  });
  const budgets = useQuery({
    enabled: !!wsId,
    queryKey: ["budgets", wsId],
    queryFn: async () => (await supabase.from("agent_budgets").select("*").eq("workspace_id", wsId!)).data ?? [],
  });

  const r = runs.data ?? [];
  const known = r.filter((x) => x.estimated_cost_usd != null);
  const total = known.reduce((s, x) => s + Number(x.estimated_cost_usd), 0);
  const unknown = r.length - known.length;
  const wsBudget = budgets.data?.find((b) => !b.agent_id);
  const group = (key: (x: (typeof r)[number]) => string) => {
    const m = new Map<string, { cost: number; runs: number; tokens: number }>();
    for (const x of r) { const k = key(x); const v = m.get(k) ?? { cost: 0, runs: 0, tokens: 0 }; v.cost += Number(x.estimated_cost_usd ?? 0); v.runs++; v.tokens += x.tokens; m.set(k, v); }
    return [...m.entries()].sort((a, b) => b[1].cost - a[1].cost);
  };
  const byAgent = group((x) => agents?.find((a) => a.id === x.agent_id)?.name ?? "Removed agent");
  const byModel = group((x) => x.model ?? "Not recorded");
  const byConv = group((x) => (x.conversations as any)?.title ?? "—");
  const days = useMemo(() => {
    const out: { day: string; cost: number }[] = [];
    const now = new Date();
    for (let d = 1; d <= now.getDate(); d++) {
      const key = new Date(now.getFullYear(), now.getMonth(), d).toDateString();
      out.push({ day: String(d), cost: r.filter((x) => new Date(x.created_at).toDateString() === key).reduce((s, x) => s + Number(x.estimated_cost_usd ?? 0), 0) });
    }
    return out;
  }, [r]);
  const maxDay = Math.max(...days.map((d) => d.cost), 0.0001);
  const refresh = () => qc.invalidateQueries({ queryKey: ["budgets", wsId] });

  return (
    <WorkspaceShell title="Usage & budgets" wsName={wsName} wide>
      {runs.isLoading || !wsId ? <Skeleton className="h-40" /> : (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-4">
            <Stat label="Spent this month (est.)" value={usd(total)} />
            <Stat label="Monthly budget" value={wsBudget ? usd(Number(wsBudget.monthly_limit_usd)) : "Not set"} />
            <Stat label="Remaining" value={wsBudget ? usd(Math.max(0, Number(wsBudget.monthly_limit_usd) - total)) : "—"} />
            <Stat label="Agent runs" value={String(r.length)} hint={unknown ? `${unknown} without usage data` : undefined} />
          </div>
          <p className="text-xs text-muted-foreground">All amounts are in USD and are estimates worked out from the tokens each run used. They're not what you're billed, and actual costs may differ. Runs made before usage tracking started have no cost recorded.</p>

          <div className="rounded-xl border border-border p-4">
            <div className="mb-3 text-[13px] font-medium">Usage over time (est. USD per day)</div>
            <div className="flex h-24 items-end gap-1">
              {days.map((d) => <div key={d.day} title={`Day ${d.day}: ${usd(d.cost)}`} className="flex-1 rounded-sm bg-primary/70" style={{ height: `${Math.max(2, (d.cost / maxDay) * 100)}%`, opacity: d.cost ? 1 : 0.25 }} />)}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <Breakdown title="By agent" rows={byAgent} />
            <Breakdown title="By model" rows={byModel} />
            <Breakdown title="By conversation" rows={byConv} />
          </div>

          <div className="rounded-xl border border-border">
            <div className="border-b border-border px-4 py-2.5 text-[13px] font-medium">Budgets</div>
            <BudgetRow wsId={wsId} agentId={null} label="Whole workspace" budget={wsBudget} onSaved={refresh} />
            {(agents ?? []).map((a) => <BudgetRow key={a.id} wsId={wsId} agentId={a.id} label={a.name} budget={budgets.data?.find((b) => b.agent_id === a.id)} onSaved={refresh} />)}
          </div>

          <div className="rounded-xl border border-border">
            <div className="border-b border-border px-4 py-2.5 text-[13px] font-medium">Recent runs</div>
            {r.slice(0, 15).map((x) => (
              <div key={x.id} className="flex items-center gap-3 border-b border-border px-4 py-2 text-[13px] last:border-0">
                <span className="w-28 shrink-0 text-xs text-muted-foreground">{new Date(x.created_at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}</span>
                <span className="min-w-0 flex-1 truncate">{agents?.find((a) => a.id === x.agent_id)?.name ?? "Agent"} <span className="text-muted-foreground">· {(x.conversations as any)?.title}</span></span>
                <span className={cn("text-xs", x.status === "error" && "text-destructive")}>{x.status}</span>
                <span className="w-20 text-right text-xs tabular-nums">{x.tokens ? `${x.tokens} tok` : "—"}</span>
                <span className="w-20 text-right tabular-nums">{x.estimated_cost_usd != null ? usd(Number(x.estimated_cost_usd)) : "n/a"}</span>
              </div>
            ))}
            {r.length === 0 && <p className="p-4 text-sm text-muted-foreground">No runs this month.</p>}
          </div>
        </div>
      )}
    </WorkspaceShell>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string | undefined }) {
  return <div className="rounded-xl border border-border p-3"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>{hint && <div className="text-xs text-muted-foreground">{hint}</div>}</div>;
}

function Breakdown({ title, rows }: { title: string; rows: [string, { cost: number; runs: number }][] }) {
  const max = Math.max(...rows.map(([, v]) => v.cost), 0.0001);
  return (
    <div className="rounded-xl border border-border p-4">
      <div className="mb-2 text-[13px] font-medium">{title}</div>
      {rows.length === 0 && <p className="text-xs text-muted-foreground">No data</p>}
      {rows.slice(0, 6).map(([k, v]) => (
        <div key={k} className="mb-2 text-[13px]">
          <div className="flex justify-between gap-2"><span className="truncate">{k}</span><span className="tabular-nums text-muted-foreground">{usd(v.cost)} · {v.runs}</span></div>
          <div className="mt-1 h-1 rounded bg-secondary"><div className="h-1 rounded bg-primary" style={{ width: `${(v.cost / max) * 100}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

function BudgetRow({ wsId, agentId, label, budget, onSaved }: { wsId: string; agentId: string | null; label: string; budget: any; onSaved: () => void }) {
  const [limit, setLimit] = useState<string>(budget ? String(budget.monthly_limit_usd) : "");
  const [perRun, setPerRun] = useState<string>(budget?.max_cost_per_run_usd != null ? String(budget.max_cost_per_run_usd) : "");
  const [warn, setWarn] = useState<string>(String(budget?.warn_at_percent ?? 80));
  const [hard, setHard] = useState<boolean>(budget?.hard_limit ?? true);
  const [busy, setBusy] = useState(false);

  async function save() {
    const l = Number(limit);
    if (!limit || Number.isNaN(l) || l < 0) { toast.error("Enter a monthly limit in USD"); return; }
    const w = Math.min(100, Math.max(1, Number(warn) || 80));
    setBusy(true);
    const row = { workspace_id: wsId, agent_id: agentId, monthly_limit_usd: l, max_cost_per_run_usd: perRun ? Number(perRun) : null, warn_at_percent: w, hard_limit: hard, updated_at: new Date().toISOString() };
    const { error } = budget ? await supabase.from("agent_budgets").update(row).eq("id", budget.id) : await supabase.from("agent_budgets").insert(row);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Budget saved for ${label}`);
    onSaved();
  }
  async function remove() {
    if (!budget) return;
    await supabase.from("agent_budgets").delete().eq("id", budget.id);
    setLimit(""); setPerRun("");
    onSaved();
  }

  return (
    <div className="grid grid-cols-2 items-end gap-2 border-b border-border px-4 py-3 last:border-0 md:grid-cols-[1fr_130px_130px_90px_110px_auto]">
      <div className="col-span-2 text-[13px] font-medium md:col-span-1 md:self-center">{label}</div>
      <div className="space-y-1"><Label className="text-xs">Monthly (USD)</Label><Input className="h-8" inputMode="decimal" value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="No limit" /></div>
      <div className="space-y-1"><Label className="text-xs">Max per run (USD)</Label><Input className="h-8" inputMode="decimal" value={perRun} onChange={(e) => setPerRun(e.target.value)} placeholder="Optional" /></div>
      <div className="space-y-1"><Label className="text-xs">Warn at %</Label><Input className="h-8" inputMode="numeric" value={warn} onChange={(e) => setWarn(e.target.value)} /></div>
      <label className="flex h-8 items-center gap-2 text-xs"><Switch checked={hard} onCheckedChange={setHard} />Hard stop</label>
      <div className="flex gap-1">
        <Button size="sm" className="h-8" disabled={busy} onClick={save}>Save</Button>
        {budget && <Button size="sm" variant="ghost" className="h-8" onClick={remove}>Clear</Button>}
      </div>
    </div>
  );
}
