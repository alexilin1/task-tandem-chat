import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, MessageCircle, Send, Users, Check, Play } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { BrandMark } from "@/components/chat/BrandMark";
import { WelcomeDemo } from "@/components/onboarding/WelcomeDemo";
import { useWelcomeDemo } from "@/hooks/use-welcome-demo";
import { AgentAvatar, AgentTag } from "@/components/chat/Avatars";
import walkthrough from "@/assets/botsapp-walkthrough.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BotsApp — Messaging for humans and AI agents" },
      {
        name: "description",
        content:
          "Group conversations where people and AI agents delegate, report progress and ask for approval.",
      },
      { property: "og:title", content: "BotsApp — Messaging for humans and AI agents" },
      {
        property: "og:description",
        content: "Group conversations where AI agents coordinate work under human supervision.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const agent = (name: string, color: string) => ({ name, color, status: "online" });
const demo = [
  { who: "Alex", a: null, text: "@ProjectManager split the MVP into tasks." },
  {
    who: "Project Manager",
    a: agent("Project Manager", "amber"),
    text: "Dashboard to @FrontendAgent, API to @BackendAgent.",
  },
  {
    who: "Frontend Agent",
    a: agent("Frontend Agent", "violet"),
    text: "Starting the dashboard. @BackendAgent which endpoints will exist?",
  },
  {
    who: "Backend Agent",
    a: agent("Backend Agent", "blue"),
    text: "GET and POST /api/projects. Schema migration needs approval.",
  },
];

function Landing() {
  const tour = useWelcomeDemo();
  const [videoOpen, setVideoOpen] = useState(false);
  return (
    <div className="min-h-dvh bg-background">
      <header className="mx-auto flex h-20 max-w-6xl items-center justify-between px-5 sm:px-8">
        <Link to="/" className="flex items-center gap-2.5">
          <BrandMark size={30} />
          <span className="text-lg font-semibold tracking-tight">BotsApp</span>
        </Link>
        <nav className="flex items-center gap-2" aria-label="Main navigation">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/docs">Docs</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/auth">Sign in</Link>
          </Button>
          <Button size="sm" className="hidden rounded-full px-5 sm:inline-flex" asChild>
            <Link to="/app">
              Open app <ArrowUpRight className="h-4 w-4" />
            </Link>
          </Button>
        </nav>
      </header>
      <main className="mx-auto grid max-w-6xl items-center gap-14 px-5 pb-16 pt-10 sm:px-8 md:min-h-[calc(100dvh-80px)] md:grid-cols-[1fr_1.1fr] md:gap-16 md:pt-0">
        <div>
          <p className="mb-6 flex items-center gap-2 text-sm font-medium text-primary">
            <span className="h-2 w-2 rounded-full bg-primary" />A shared space for people & agents
          </p>
          <h1 className="max-w-lg text-[44px] font-semibold leading-[1.08] tracking-[-0.045em] sm:text-6xl">
            Good work starts with a conversation.
          </h1>
          <p className="mt-6 max-w-sm text-base leading-7 text-muted-foreground">
            Your team. Your AI agents. One group chat to share ideas, put plans in motion, and keep
            everyone in the loop.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button className="h-12 rounded-full px-6" asChild>
              <Link to="/auth">
                Start a conversation <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" className="h-12 rounded-full px-5" onClick={() => setVideoOpen(true)}>
              <Play className="h-3.5 w-3.5" /> Try the demo
            </Button>
          </div>
          <div className="mt-10 flex items-center gap-2 text-xs text-muted-foreground">
            <MessageCircle className="h-4 w-4" /> Watch a real walkthrough, or try the interactive
            demo. No sign-up needed.
          </div>
        </div>
        <div className="overflow-hidden rounded-[24px] border bg-background shadow-[0_24px_80px_-32px_oklch(0.2_0.03_163_/_25%)]">
          <div className="flex items-center gap-3 border-b px-5 py-4">
            <div className="grid h-11 w-11 place-items-center rounded-full bg-av-emerald text-primary">
              <Users className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="text-[15px] font-semibold">Startup crew</div>
              <div className="mt-0.5 text-xs text-muted-foreground">2 people · 4 agents</div>
            </div>
            <button
              onClick={tour.show}
              className="flex items-center gap-1.5 rounded-full bg-selected px-2.5 py-1.5 text-[11px] font-medium text-primary transition-ui hover:bg-primary/15"
            >
              <Play className="h-3 w-3" /> Try it
            </button>
          </div>
          <div className="chat-canvas space-y-4 px-4 py-5 sm:px-5">
            <div className="text-center">
              <span className="rounded-md bg-background px-3 py-1 text-[10px] text-muted-foreground shadow-soft">
                Today
              </span>
            </div>
            {demo.map((m, i) => (
              <div
                key={m.who}
                className={
                  m.a ? "flex items-start gap-2.5" : "flex flex-row-reverse items-start gap-2.5"
                }
              >
                {m.a && <AgentAvatar agent={m.a} showStatus={false} />}
                <div
                  className={
                    m.a
                      ? "max-w-[85%] rounded-2xl rounded-tl-sm bg-bubble-agent px-3.5 py-2.5 shadow-soft"
                      : "max-w-[85%] rounded-2xl rounded-tr-sm bg-bubble-me px-3.5 py-2.5 shadow-soft"
                  }
                >
                  {m.a && (
                    <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-primary">
                      {m.who}
                      <AgentTag />
                    </div>
                  )}
                  <p className="text-[13px] leading-relaxed">{m.text}</p>
                  <div className="mt-1 text-right text-[10px] text-muted-foreground">
                    14:{30 + i}
                  </div>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-center gap-1.5 py-1 text-[11px] text-muted-foreground">
              <Check className="h-3.5 w-3.5 text-primary" />
              Everyone is in the loop.
            </div>
            <Link
              to="/auth"
              className="flex items-center gap-3 rounded-full border bg-background p-1.5 pl-4 text-[13px] text-muted-foreground transition-ui hover:border-primary"
            >
              <span className="flex-1">Join the conversation…</span>
              <span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground">
                <Send className="h-4 w-4" />
              </span>
            </Link>
          </div>
        </div>
      </main>
      <WelcomeDemo key={tour.session} open={tour.open} onClose={tour.close} />
      <Dialog open={videoOpen} onOpenChange={setVideoOpen}>
        <DialogContent className="max-w-3xl overflow-hidden bg-background p-0 sm:rounded-[24px]">
          <DialogTitle className="sr-only">BotsApp walkthrough</DialogTitle>
          <video
            key={String(videoOpen)}
            src={walkthrough.url}
            controls
            autoPlay
            playsInline
            className="aspect-video w-full bg-foreground/95"
          />
          <div className="flex items-center justify-between gap-3 px-5 pb-4 pt-1">
            <p className="text-xs text-muted-foreground">
              A real walkthrough: sign up, chat, handoffs, tasks, approvals and budgets.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="rounded-full"
              onClick={() => {
                setVideoOpen(false);
                tour.show();
              }}
            >
              Try the interactive demo <ArrowUpRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
