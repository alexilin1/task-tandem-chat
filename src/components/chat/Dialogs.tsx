import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, MessageSquare } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { createAgent } from "@/lib/chat.functions";
import { createInvite } from "@/lib/workspace.functions";
import { AgentAvatar, AgentStatus, AgentTag, providerLabel } from "./Avatars";
import type { Agent } from "@/hooks/use-chat-data";

export function CreateGroupDialog(props: { open: boolean; onOpenChange: (o: boolean) => void; workspaceId: string; myId: string; agents: Agent[]; onCreated: (id: string) => void }) {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!title.trim()) return;
    setBusy(true);
    const { data, error } = await supabase.from("conversations").insert({ workspace_id: props.workspaceId, title: title.trim(), description: desc, created_by: props.myId }).select().single();
    if (error || !data) {
      setBusy(false);
      toast.error(error?.message ?? "Failed");
      return;
    }
    await supabase.from("conversation_participants").insert([{ conversation_id: data.id, user_id: props.myId }, ...picked.map((agent_id) => ({ conversation_id: data.id, agent_id }))]);
    if (desc.trim()) await supabase.from("conversation_memory").insert({ conversation_id: data.id, kind: "objective", content: desc.trim(), created_by_user_id: props.myId });
    setBusy(false);
    setTitle(""); setDesc(""); setPicked([]);
    props.onOpenChange(false);
    props.onCreated(data.id);
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create group</DialogTitle>
          <DialogDescription>Give it a shared objective and pick the agents that should collaborate.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Name</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Launch landing page" /></div>
          <div className="space-y-1.5"><Label>Shared objective</Label><Textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What should this group accomplish?" /></div>
          <div className="space-y-1.5">
            <Label>Agents</Label>
            <div className="grid grid-cols-2 gap-2">
              {props.agents.map((a) => {
                const on = picked.includes(a.id);
                return (
                  <button key={a.id} onClick={() => setPicked(on ? picked.filter((x) => x !== a.id) : [...picked, a.id])} className={cn("flex items-center gap-2 rounded-lg border p-2 text-left text-[13px] transition-ui hover:bg-hover", on && "border-primary bg-selected hover:bg-selected")}>
                    <AgentAvatar agent={a} size="sm" showStatus={false} /> <span className="truncate">{a.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <DialogFooter><Button onClick={create} disabled={busy || !title.trim()}>Create group</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const COLORS = ["violet", "blue", "emerald", "amber", "rose"] as const;
const PERMS = [
  { id: "read_history", label: "Read conversation history" },
  { id: "create_tasks", label: "Create & update tasks" },
  { id: "request_approval", label: "Request approvals" },
] as const;

export function AddAgentDialog(props: { open: boolean; onOpenChange: (o: boolean) => void; workspaceId: string }) {
  const create = useServerFn(createAgent);
  const [provider, setProvider] = useState<"builtin" | "webhook" | "rest">("builtin");
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [description, setDescription] = useState("");
  const [caps, setCaps] = useState("");
  const [prompt, setPrompt] = useState("");
    const [color, setColor] = useState<(typeof COLORS)[number]>("violet");
  const [perms, setPerms] = useState<string[]>(["read_history", "create_tasks", "request_approval"]);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [creds, setCreds] = useState<{ token: string; webhookSecret: string } | null>(null);

  function reset() {
    setName(""); setHandle(""); setDescription(""); setCaps(""); setPrompt(""); setUrl(""); setCreds(null); setProvider("builtin");
  }

  async function submit() {
    setBusy(true);
    try {
      const r = await create({
        data: {
          workspaceId: props.workspaceId, name, handle: handle || name.replace(/[^A-Za-z0-9]/g, ""), description, provider,
          capabilities: caps.split(",").map((s) => s.trim()).filter(Boolean), systemPrompt: prompt || `You are ${name}. ${description}`,
          avatarEmoji: "", color, permissions: perms as any, webhookUrl: provider === "webhook" ? url : null,
        },
      });
      if (r.token) setCreds({ token: r.token, webhookSecret: r.webhookSecret! });
      else { toast.success(`${name} is ready`); reset(); props.onOpenChange(false); }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={props.open} onOpenChange={(o) => { if (!o) reset(); props.onOpenChange(o); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{creds ? "Save your agent credentials" : "Add agent"}</DialogTitle>
          <DialogDescription>{creds ? "These are shown only once. The agent shows as Not connected until it calls the API." : "Built-in agents run on our AI. External agents connect over HTTPS."}</DialogDescription>
        </DialogHeader>
        {creds ? (
          <div className="space-y-3">
            <Secret label="API token (Bearer)" value={creds.token} />
            {provider === "webhook" && <Secret label="Webhook signing secret (HMAC-SHA256, header X-AgentChat-Signature)" value={creds.webhookSecret} />}
            <a href="/docs" target="_blank" className="text-sm text-primary underline">Read the API docs</a>
            <DialogFooter><Button onClick={() => { reset(); props.onOpenChange(false); }}>Done</Button></DialogFooter>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-1 rounded-lg bg-secondary p-1">
              {([["builtin", "Built-in"], ["webhook", "Webhook"], ["rest", "REST API"]] as const).map(([v, l]) => (
                <button key={v} type="button" onClick={() => setProvider(v)} className={cn("h-7 rounded-md text-[13px] font-medium text-muted-foreground transition-ui", provider === v && "bg-background text-foreground shadow-soft")}>{l}</button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="QA Agent" /></div>
              <div className="space-y-1.5"><Label>Handle</Label><Input value={handle} onChange={(e) => setHandle(e.target.value.replace(/[^A-Za-z0-9_-]/g, ""))} placeholder="QAAgent" /></div>
            </div>
            <div className="space-y-1.5"><Label>Description</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Writes and runs test plans" /></div>
            <div className="space-y-1.5"><Label>Capabilities (comma separated)</Label><Input value={caps} onChange={(e) => setCaps(e.target.value)} placeholder="testing, qa" /></div>
            {provider === "builtin" && <div className="space-y-1.5"><Label>Instructions</Label><Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="How should this agent behave?" /></div>}
            {provider === "webhook" && <div className="space-y-1.5"><Label>Webhook URL (https)</Label><Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://my-agent.example.com/hook" /></div>}
            <div className="space-y-1.5">
              <Label>Avatar colour</Label>
              <div className="flex items-center gap-2">
                <AgentAvatar agent={{ name: name || "Agent", color, status: "online" }} showStatus={false} />
                {COLORS.map((c) => <button key={c} type="button" aria-label={c} onClick={() => setColor(c)} className={cn("h-5 w-5 rounded-full ring-1 ring-border", `bg-av-${c}`, color === c && "ring-2 ring-primary ring-offset-2 ring-offset-background")} />)}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Permissions</Label>
              {PERMS.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={perms.includes(p.id)} onCheckedChange={(v) => setPerms(v ? [...perms, p.id] : perms.filter((x) => x !== p.id))} /> {p.label}
                </label>
              ))}
            </div>
            <DialogFooter><Button onClick={submit} disabled={busy || !name.trim()}>{busy ? "Creating…" : "Create agent"}</Button></DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function InviteDialog(props: { open: boolean; onOpenChange: (o: boolean) => void; workspaceId: string; workspaceName: string }) {
  const invite = useServerFn(createInvite);
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!props.open) return;
    setLink(null);
    setBusy(true);
    invite({ data: { workspaceId: props.workspaceId } })
      .then((r) => setLink(`${window.location.origin}/join?code=${r.code}`))
      .catch((e) => toast.error(e instanceof Error ? e.message : "Couldn't create an invite"))
      .finally(() => setBusy(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.open, props.workspaceId]);

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Invite people</DialogTitle>
          <DialogDescription>Anyone with this link can join {props.workspaceName}. It works for 7 days or 25 people.</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Input readOnly value={busy ? "Creating link…" : (link ?? "Couldn't create a link")} className="font-mono text-xs" />
          <Button size="icon" variant="outline" disabled={!link} aria-label="Copy invite link" onClick={() => { if (link) { navigator.clipboard.writeText(link); toast.success("Link copied"); } }}>
            <Copy className="h-4 w-4" />
          </Button>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => props.onOpenChange(false)}>Done</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Secret({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input readOnly value={value} className="font-mono text-xs" />
        <Button size="icon" variant="outline" onClick={() => { navigator.clipboard.writeText(value); toast.success("Copied"); }}><Copy className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}

export function AgentProfileDialog(props: { agent: Agent | null; onOpenChange: (o: boolean) => void; onMessage: (a: Agent) => void }) {
  const a = props.agent;
  return (
    <Dialog open={!!a} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-sm">
        {a && (
          <>
            <div className="flex items-center gap-3">
              <AgentAvatar agent={a} size="lg" showStatus={false} />
              <div className="min-w-0">
                <DialogTitle className="flex items-center gap-1.5 text-[15px]">{a.name}<AgentTag /></DialogTitle>
                <div className="text-xs text-muted-foreground">@{a.handle} · {providerLabel[a.provider]}</div>
              </div>
            </div>
            <DialogDescription className="text-[13px]">{a.description || "No description."}</DialogDescription>
            <dl className="grid grid-cols-[96px_1fr] gap-y-2 text-[13px]">
              <dt className="text-muted-foreground">Status</dt><dd><AgentStatus status={a.status} /></dd>
              <dt className="text-muted-foreground">Capabilities</dt><dd>{a.capabilities.join(", ") || "—"}</dd>
              <dt className="text-muted-foreground">Permissions</dt><dd>{a.permissions.map((p) => p.replace(/_/g, " ")).join(", ") || "—"}</dd>
            </dl>
            <DialogFooter><Button onClick={() => props.onMessage(a)}><MessageSquare className="h-4 w-4" />Message</Button></DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
