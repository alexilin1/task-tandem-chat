import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/chat/BrandMark";
import { joinWorkspace, previewInvite } from "@/lib/workspace.functions";

export const Route = createFileRoute("/_authenticated/join")({
  validateSearch: (s: Record<string, unknown>): { code?: string | undefined } => ({ code: typeof s["code"] === "string" ? (s["code"] as string) : undefined }),
  head: () => ({
    meta: [
      { title: "Join a workspace — BotsApp" },
      { name: "description", content: "Accept an invite to join an BotsApp workspace." },
      { property: "og:title", content: "Join a workspace — BotsApp" },
      { property: "og:description", content: "Accept an invite to join an BotsApp workspace." },
    ],
  }),
  component: JoinPage,
});

function JoinPage() {
  const { code } = Route.useSearch();
  const navigate = useNavigate();
  const preview = useServerFn(previewInvite);
  const join = useServerFn(joinWorkspace);
  const [state, setState] = useState<{ loading: boolean; name?: string; error?: string }>({ loading: true });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!code) {
      setState({ loading: false, error: "This invite link is missing its code." });
      return;
    }
    preview({ data: { code } })
      .then((r) => setState({ loading: false, name: r.name }))
      .catch((e) => setState({ loading: false, error: e instanceof Error ? e.message : "This invite link is not valid." }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  async function accept() {
    if (!code) return;
    setBusy(true);
    try {
      const r = await join({ data: { code } });
      toast.success(r.alreadyMember ? `You're already in ${r.name}` : `Welcome to ${r.name}`);
      navigate({ to: "/app", replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't join the workspace");
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-background px-4">
      <div className="w-full max-w-sm rounded-xl border bg-card p-6 text-center shadow-soft">
        <div className="mx-auto mb-4 grid h-11 w-11 place-items-center rounded-full bg-secondary ring-1 ring-border">
          {state.name ? <Users className="h-5 w-5 text-muted-foreground" /> : <BrandMark size={22} />}
        </div>
        {state.loading ? (
          <p className="text-sm text-muted-foreground">Checking your invite…</p>
        ) : state.error ? (
          <>
            <h1 className="text-[15px] font-semibold">Invite not valid</h1>
            <p className="mt-1 text-[13px] text-muted-foreground">{state.error}</p>
            <Button className="mt-5 w-full" variant="outline" onClick={() => navigate({ to: "/app" })}>Go to your chats</Button>
          </>
        ) : (
          <>
            <h1 className="text-[15px] font-semibold">You've been invited</h1>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Join <span className="font-medium text-foreground">{state.name}</span> to chat with its people and agents.
            </p>
            <Button className="mt-5 w-full" onClick={accept} disabled={busy}>{busy ? "Joining…" : "Join workspace"}</Button>
          </>
        )}
      </div>
    </div>
  );
}
