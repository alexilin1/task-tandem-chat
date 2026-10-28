import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCheck,
  CircleCheck,
  FileText,
  GitBranch,
  Layers,
  MessageCircle,
  Pause,
  Play,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/chat/BrandMark";
import { cn } from "@/lib/utils";

const scenarios = {
  launch: {
    label: "Launch a product",
    brief: "Team, let's launch our new app. Turn the idea into a plan we can act on.",
    title: "The launch room",
    task: "Launch plan",
    artifact: "Your launch, mapped out",
    description: "A clear brief, focused tasks, and a team that knows what comes next.",
    messages: [
      {
        name: "Project Manager",
        initials: "PM",
        color: "amber",
        text: "On it. @Designer, shape the first-run experience. @Researcher, find our strongest positioning.",
      },
      {
        name: "Designer",
        initials: "D",
        color: "rose",
        text: "I'll sketch a focused welcome flow. @Researcher, what should we lead with?",
      },
      {
        name: "Researcher",
        initials: "R",
        color: "blue",
        text: "Clarity is the opportunity. Lead with the outcome, then show how the team gets there.",
      },
      {
        name: "Project Manager",
        initials: "PM",
        color: "amber",
        text: "Aligned. I've organized the launch plan. One decision needs your review before we go further.",
      },
    ],
  },
  research: {
    label: "Explore an idea",
    brief:
      "Team, help me explore a new product idea. Find the opportunity and propose a first experiment.",
    title: "The idea room",
    task: "Discovery plan",
    artifact: "An idea with a next step",
    description: "A research direction, a testable concept, and a first experiment you can review.",
    messages: [
      {
        name: "Project Manager",
        initials: "PM",
        color: "amber",
        text: "Let's make this concrete. @Researcher, map the questions. @Designer, shape a small experiment.",
      },
      {
        name: "Researcher",
        initials: "R",
        color: "blue",
        text: "I'll outline the audience and assumptions. @Designer, let's test the riskiest assumption first.",
      },
      {
        name: "Designer",
        initials: "D",
        color: "rose",
        text: "A concept page is a good first experiment. One idea, one audience, one clear action.",
      },
      {
        name: "Project Manager",
        initials: "PM",
        color: "amber",
        text: "The discovery plan is ready. Let's get your approval before inviting anyone outside the team.",
      },
    ],
  },
} as const;

const chapters = [
  {
    label: "The brief",
    title: "One message.\nA whole team in motion.",
    body: "Bring an idea, a question, or a goal. Your agents meet you in the conversation.",
  },
  {
    label: "The handoff",
    title: "Less coordinating.\nMore creating.",
    body: "Agents find the right teammate, share context, and turn the conversation into focused tasks.",
  },
  {
    label: "The checkpoint",
    title: "Their initiative.\nYour final say.",
    body: "When a decision needs you, the team asks. Review the request, approve it, or send it back.",
  },
  {
    label: "The outcome",
    title: "An idea becomes\na way forward.",
    body: "Tasks, decisions, and context stay together. Pick up the conversation whenever you're ready.",
  },
] as const;

export function WelcomeDemo({
  open,
  onClose,
  authenticated = false,
}: {
  open: boolean;
  onClose: () => void;
  authenticated?: boolean;
}) {
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const [scenario, setScenario] = useState<keyof typeof scenarios>("launch");
  const [beat, setBeat] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [reduced, setReduced] = useState(false);
  const [visible, setVisible] = useState(true);
  const [decision, setDecision] = useState<"approved" | "revised" | null>(null);
  const story = scenarios[scenario];

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    const visibility = () => setVisible(!document.hidden);
    update();
    media.addEventListener("change", update);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      media.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);

  useEffect(() => {
    if (!open || step !== 1 || !playing || !visible || reduced || beat >= 4) return;
    const timer = window.setTimeout(() => setBeat((value) => value + 1), beat === 0 ? 550 : 1450);
    return () => window.clearTimeout(timer);
  }, [open, step, playing, visible, reduced, beat]);

  function go(next: number) {
    setStep(Math.max(0, Math.min(3, next)) as 0 | 1 | 2 | 3);
    setBeat(0);
    setPlaying(true);
  }
  function replay() {
    setDecision(null);
    go(0);
  }
  const shown = reduced ? 4 : beat;

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent
        className="welcome-demo flex max-h-[94dvh] w-[calc(100%-24px)] max-w-[1080px] flex-col gap-0 overflow-y-auto rounded-[24px] border-0 p-0 sm:rounded-[24px]"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          document.getElementById("demo-skip")?.focus();
        }}
      >
        <div className="flex shrink-0 items-center justify-between border-b px-5 py-4 sm:px-7">
          <div className="flex items-center gap-2.5">
            <BrandMark size={26} />
            <span className="text-sm font-semibold">BotsApp</span>
            <span className="mx-1 h-4 w-px bg-border" />
            <span className="hidden text-xs text-muted-foreground sm:inline">
              The interactive tour
            </span>
            <span className="text-xs text-muted-foreground sm:hidden">Tour</span>
          </div>
          <button
            id="demo-skip"
            onClick={onClose}
            className="mr-5 whitespace-nowrap rounded-md px-2 py-1 text-xs text-muted-foreground transition-ui hover:bg-hover hover:text-foreground"
          >
            Skip tour
          </button>
        </div>
        <div className="grid min-h-0 md:grid-cols-[0.8fr_1.2fr]">
          <div className="flex flex-col px-6 py-6 sm:px-9 md:py-10">
            <div className="mb-5 hidden items-center gap-2 text-[11px] sm:flex font-medium uppercase tracking-[0.16em] text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />A little conversation. A lot
              of possibility.
            </div>
            <div key={step} className="demo-chapter">
              <DialogTitle className="whitespace-pre-line text-[26px] font-semibold leading-[1.12] tracking-[-0.04em] sm:text-[38px]">
                {chapters[step].title}
              </DialogTitle>
              <DialogDescription className="mt-3 max-w-sm text-xs leading-5 sm:mt-4 sm:text-sm sm:leading-6">
                {chapters[step].body}
              </DialogDescription>
            </div>
            <div
              className="mt-4 flex gap-2 md:mt-auto md:flex-col md:gap-1 md:pt-8"
              aria-label="Tour chapters"
            >
              {chapters.map((chapter, index) => (
                <button
                  key={chapter.label}
                  onClick={() => go(index)}
                  aria-current={step === index ? "step" : undefined}
                  aria-label={`Step ${index + 1}: ${chapter.label}`}
                  className={cn(
                    "flex flex-1 items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs transition-ui md:flex-none",
                    step === index
                      ? "bg-selected font-medium text-primary"
                      : "text-muted-foreground hover:bg-hover",
                  )}
                >
                  <span
                    className={cn(
                      "grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[10px]",
                      index < step && "border-primary bg-primary text-primary-foreground",
                      index === step && "border-primary/30",
                    )}
                  >
                    {index < step ? <Check className="h-3 w-3" /> : `0${index + 1}`}
                  </span>
                  <span className="hidden sm:inline">{chapter.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="demo-stage relative m-3 mt-0 flex min-h-[410px] flex-col overflow-hidden rounded-[20px] p-4 sm:m-4 sm:min-h-[480px] sm:p-6 md:ml-0 md:mt-4">
            <div className="demo-stage-glow" aria-hidden />
            <div className="relative z-10 mb-5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-xl border border-white/10 bg-white/5">
                  <Users className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs font-medium">{story.title}</p>
                  <p className="mt-0.5 text-[10px] text-white/45">You + 3 agents</p>
                </div>
              </div>
              <span className="flex items-center gap-1.5 rounded-full border border-white/10 px-2 py-1 text-[9px] uppercase tracking-widest text-white/60">
                <span className="h-1 w-1 rounded-full bg-emerald-300" />
                Interactive demo
              </span>
            </div>

            {step === 0 && (
              <div className="relative z-10 flex flex-1 flex-col justify-center demo-chapter">
                <div
                  className="demo-team mb-7 flex justify-center -space-x-2"
                  aria-label="Your demo team"
                >
                  <DemoAvatar initials="You" color="green" large />
                  <DemoAvatar initials="PM" color="amber" large />
                  <DemoAvatar initials="D" color="rose" large />
                  <DemoAvatar initials="R" color="blue" large />
                </div>
                <p className="mb-4 text-center text-[11px] text-white/50">
                  A team ready to think with you.
                </p>
                <div className="rounded-2xl border border-white/15 bg-white/[0.07] p-4 shadow-xl">
                  <div className="mb-3 flex items-center gap-2 text-[10px] text-emerald-200">
                    <MessageCircle className="h-3 w-3" />
                    Your first message
                  </div>
                  <p className="text-[15px] leading-6">
                    {story.brief}
                    <span className="demo-caret ml-0.5 inline-block h-4 w-px bg-emerald-200 align-middle" />
                  </p>
                  <button
                    onClick={() => go(1)}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-200 px-4 py-3 text-xs font-semibold text-emerald-950 transition-ui hover:bg-emerald-100"
                  >
                    Send the brief <Send className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="mt-4 flex justify-center gap-2" aria-label="Choose a demo scenario">
                  {Object.entries(scenarios).map(([key, item]) => (
                    <button
                      key={key}
                      aria-pressed={scenario === key}
                      onClick={() => setScenario(key as keyof typeof scenarios)}
                      className={cn(
                        "rounded-full border px-3 py-2 text-[10px] transition-ui",
                        scenario === key
                          ? "border-emerald-200/50 bg-emerald-200/10 text-emerald-100"
                          : "border-white/10 text-white/50 hover:bg-white/5",
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="relative z-10 flex flex-1 flex-col">
                <div className="mb-4 ml-8 rounded-2xl rounded-tr-sm bg-emerald-200 px-3.5 py-2.5 text-xs leading-5 text-emerald-950">
                  {story.brief}
                  <CheckCheck className="ml-auto mt-1 h-3 w-3 opacity-50" />
                </div>
                <div className="flex-1 space-y-3" aria-live="polite" aria-label="Demo conversation">
                  {story.messages.slice(0, shown).map((message) => (
                    <div key={message.text} className="demo-message flex items-start gap-2">
                      <DemoAvatar initials={message.initials} color={message.color} />
                      <div className="min-w-0 flex-1 rounded-2xl rounded-tl-sm border border-white/10 bg-white/[0.06] px-3 py-2.5">
                        <p className="mb-1 text-[10px] font-semibold text-emerald-100">
                          {message.name}
                          <span className="ml-1.5 font-normal text-white/30">Agent</span>
                        </p>
                        <p className="text-xs leading-5 text-white/80">{message.text}</p>
                      </div>
                    </div>
                  ))}
                  {shown < 4 && (
                    <div className="flex items-center gap-2 py-2 text-[10px] text-white/50">
                      <span className="flex gap-1" aria-hidden>
                        {[0, 1, 2].map((i) => (
                          <span
                            key={i}
                            className="h-1 w-1 animate-typing rounded-full bg-emerald-200"
                            style={{ animationDelay: `${i * 150}ms` }}
                          />
                        ))}
                      </span>
                      {story.messages[shown]?.name ?? "Your team"} is thinking…
                    </div>
                  )}
                </div>
                {shown >= 3 && (
                  <div className="demo-message mt-4 flex items-center gap-2 rounded-xl border border-emerald-200/15 bg-emerald-200/5 px-3 py-2.5 text-[10px] text-emerald-100">
                    <GitBranch className="h-3.5 w-3.5" />
                    Context shared. Work handed to the right teammate.
                  </div>
                )}
              </div>
            )}

            {step === 2 && (
              <div className="relative z-10 flex flex-1 flex-col justify-center demo-chapter">
                <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl border border-emerald-200/20 bg-emerald-200/10">
                  <ShieldCheck className="h-7 w-7 text-emerald-200" />
                </div>
                <div className="rounded-2xl border border-white/15 bg-white/[0.07] p-5">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="text-[10px] uppercase tracking-widest text-emerald-200">
                      Your checkpoint
                    </span>
                    <span className="rounded-full bg-white/10 px-2 py-1 text-[9px] text-white/60">
                      {decision ? "Reviewed" : "Needs your review"}
                    </span>
                  </div>
                  <h3 className="text-lg font-medium tracking-tight">Invite outside reviewers?</h3>
                  <p className="mt-2 text-xs leading-5 text-white/60">
                    The team would like to share the concept with five early reviewers. You decide
                    what happens next.
                  </p>
                  <div className="my-4 flex items-center gap-2 border-y border-white/10 py-3 text-[10px] text-white/50">
                    <DemoAvatar initials="PM" color="amber" />
                    Requested by Project Manager
                  </div>
                  {!decision ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => setDecision("approved")}
                        className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-200 px-3 py-3 text-xs font-semibold text-emerald-950 hover:bg-emerald-100"
                      >
                        <Check className="h-3.5 w-3.5" />
                        Approve
                      </button>
                      <button
                        onClick={() => setDecision("revised")}
                        className="flex-1 rounded-xl border border-white/20 px-3 py-3 text-xs text-white/80 hover:bg-white/10"
                      >
                        Request changes
                      </button>
                    </div>
                  ) : (
                    <div
                      role="status"
                      className="demo-message flex items-start gap-2 rounded-xl border border-emerald-200/20 bg-emerald-200/10 p-3"
                    >
                      <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-200" />
                      <p className="text-xs leading-5 text-emerald-100">
                        {decision === "approved"
                          ? "Approved. The team can plan the next step with your permission."
                          : "Changes requested. The team will keep the concept internal and revise the plan."}
                      </p>
                    </div>
                  )}
                </div>
                <p className="mt-4 text-center text-[10px] text-white/40">
                  This is a simulation. No invitations are sent.
                </p>
              </div>
            )}

            {step === 3 && (
              <div className="relative z-10 flex flex-1 flex-col justify-center demo-chapter">
                <div className="demo-success mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full border border-emerald-200/30 bg-emerald-200/10">
                  <Sparkles className="h-7 w-7 text-emerald-200" />
                </div>
                <h3 className="text-center text-2xl font-medium tracking-tight">
                  {story.artifact}
                </h3>
                <p className="mx-auto mt-2 max-w-xs text-center text-xs leading-5 text-white/55">
                  {story.description}
                </p>
                <div className="mt-6 space-y-2">
                  {[
                    [FileText, story.task, "Project Manager"],
                    [
                      Layers,
                      scenario === "launch" ? "Welcome flow concept" : "First experiment concept",
                      "Designer",
                    ],
                    [
                      ShieldCheck,
                      decision === "revised"
                        ? "Feedback captured"
                        : decision === "approved"
                          ? "Your approval recorded"
                          : "Human review built in",
                      "You",
                    ],
                  ].map(([Icon, title, owner]) => {
                    const RowIcon = Icon as typeof FileText;
                    return (
                      <div
                        key={String(title)}
                        className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3"
                      >
                        <RowIcon className="h-4 w-4 text-emerald-200" />
                        <div className="flex-1">
                          <p className="text-xs text-white/90">{String(title)}</p>
                          <p className="mt-0.5 text-[10px] text-white/40">{String(owner)}</p>
                        </div>
                        <CircleCheck className="h-4 w-4 text-emerald-200/70" />
                      </div>
                    );
                  })}
                </div>
                <p className="mt-5 text-center text-[10px] text-white/40">
                  Sample outcome · Your workspace is where the real work begins.
                </p>
              </div>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center justify-between gap-3 border-t px-5 py-4 sm:px-7">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full"
              onClick={step ? () => go(step - 1) : replay}
              aria-label={step ? "Previous step" : "Restart demo"}
            >
              {step ? <ArrowLeft className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
            </Button>
            <span className="text-xs tabular-nums text-muted-foreground">{step + 1} / 4</span>
            {step === 1 && !reduced && (
              <Button
                variant="ghost"
                size="icon"
                className="ml-1 h-9 w-9 rounded-full"
                onClick={() => setPlaying(!playing)}
                aria-label={playing ? "Pause demo" : "Play demo"}
              >
                {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              </Button>
            )}
          </div>
          {step < 3 ? (
            <Button
              className="h-10 rounded-full px-5"
              onClick={() => go(step + 1)}
              disabled={step === 2 && !decision}
            >
              {step === 0 ? "Let's try it" : step === 2 ? "See the outcome" : "Your turn"}
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="ghost" className="rounded-full" onClick={replay}>
                Replay
              </Button>
              {authenticated ? (
                <Button className="rounded-full px-5" onClick={onClose}>
                  Open my workspace <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              ) : (
                <Button className="rounded-full px-5" asChild>
                  <Link to="/auth" onClick={onClose}>
                    Build your team <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DemoAvatar({
  initials,
  color,
  large = false,
}: {
  initials: string;
  color: string;
  large?: boolean;
}) {
  const colors: Record<string, string> = {
    green: "bg-emerald-200 text-emerald-950",
    amber: "bg-amber-200 text-amber-950",
    rose: "bg-rose-200 text-rose-950",
    blue: "bg-sky-200 text-sky-950",
  };
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-semibold ring-4 ring-[oklch(0.22_0.025_163)]",
        large ? "h-14 w-14 text-sm sm:h-16 sm:w-16" : "h-7 w-7 text-[9px]",
        colors[color],
      )}
    >
      {initials}
    </span>
  );
}
