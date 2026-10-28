import { Users, Bot, SquarePen, UserPlus, Moon, PanelRight, BookOpen } from "lucide-react";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, CommandShortcut } from "@/components/ui/command";
import { AgentAvatar } from "./Avatars";
import type { Agent } from "@/hooks/use-chat-data";
import type { ConvItem } from "./Sidebar";

export function CommandMenu(props: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  conversations: ConvItem[];
  agents: Agent[];
  onSelectConversation: (id: string) => void;
  onOpenAgent: (a: Agent) => void;
  onCreateGroup: () => void;
  onAddAgent: () => void;
  onToggleTheme: () => void;
  onToggleDetails: () => void;
  onDocs: () => void;
}) {
  const run = (fn: () => void) => () => {
    props.onOpenChange(false);
    fn();
  };
  return (
    <CommandDialog open={props.open} onOpenChange={props.onOpenChange}>
      <CommandInput placeholder="Search conversations, agents and actions…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        <CommandGroup heading="Conversations">
          {props.conversations.map((c) => (
            <CommandItem key={c.id} value={`conv ${c.title}`} onSelect={run(() => props.onSelectConversation(c.id))}>
              <Users className="h-4 w-4 text-muted-foreground" />{c.title}
              <span className="ml-auto text-xs text-muted-foreground">{c.kind === "dm" ? "Direct" : "Group"}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Agents">
          {props.agents.map((a) => (
            <CommandItem key={a.id} value={`agent ${a.name} ${a.handle}`} onSelect={run(() => props.onOpenAgent(a))}>
              <AgentAvatar agent={a} size="xs" />{a.name}
              <span className="ml-auto text-xs text-muted-foreground">@{a.handle}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem onSelect={run(props.onCreateGroup)}><SquarePen className="h-4 w-4" />New group</CommandItem>
          <CommandItem onSelect={run(props.onAddAgent)}><UserPlus className="h-4 w-4" />Register agent</CommandItem>
          <CommandItem onSelect={run(props.onToggleDetails)}><PanelRight className="h-4 w-4" />Toggle details panel<CommandShortcut>⌘.</CommandShortcut></CommandItem>
          <CommandItem onSelect={run(props.onToggleTheme)}><Moon className="h-4 w-4" />Toggle dark mode</CommandItem>
          <CommandItem onSelect={run(props.onDocs)}><BookOpen className="h-4 w-4" />Agent API docs</CommandItem>
          <CommandItem onSelect={run(() => props.onOpenAgent(props.agents[0]!))} disabled={!props.agents.length}><Bot className="h-4 w-4" />Message an agent</CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
