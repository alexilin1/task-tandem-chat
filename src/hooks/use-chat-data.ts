import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Agent = Database["public"]["Tables"]["agents"]["Row"];
export type Conversation = Database["public"]["Tables"]["conversations"]["Row"];
export type Message = Database["public"]["Tables"]["messages"]["Row"];
export type Task = Database["public"]["Tables"]["tasks"]["Row"];
export type Approval = Database["public"]["Tables"]["approvals"]["Row"];
export type Participant = Database["public"]["Tables"]["conversation_participants"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Memory = Database["public"]["Tables"]["conversation_memory"]["Row"];
export type Reaction = Database["public"]["Tables"]["reactions"]["Row"];

const uid = () => Math.random().toString(36).slice(2);

export function useWorkspaces() {
  return useQuery({
    queryKey: ["workspaces"],
    queryFn: async () => {
      const { data, error } = await supabase.from("workspaces").select("*").order("created_at");
      if (error) throw error;
      return data;
    },
  });
}

const WS_KEY = "ac-active-workspace";
export function getActiveWorkspaceId(): string | null {
  try {
    return localStorage.getItem(WS_KEY);
  } catch {
    return null;
  }
}
export function setActiveWorkspaceId(id: string) {
  try {
    localStorage.setItem(WS_KEY, id);
  } catch {
    /* ignore */
  }
}

export function useConversations(workspaceId?: string) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!workspaceId) return;
    const ch = supabase
      .channel(`ws-${uid()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => qc.invalidateQueries({ queryKey: ["conversations"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "agents" }, () => qc.invalidateQueries({ queryKey: ["agents"] }))
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [workspaceId, qc]);
  return useQuery({
    enabled: !!workspaceId,
    queryKey: ["conversations", workspaceId],
    queryFn: async () => {
      const { data, error } = await supabase.from("conversations").select("*, conversation_participants(agent_id, user_id)").eq("workspace_id", workspaceId!).neq("kind", "thread").order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useAgents(workspaceId?: string) {
  return useQuery({
    enabled: !!workspaceId,
    queryKey: ["agents", workspaceId],
    queryFn: async () => {
      const { data, error } = await supabase.from("agents").select("*").eq("workspace_id", workspaceId!).order("created_at");
      if (error) throw error;
      return data as Agent[];
    },
  });
}

export function useProfiles() {
  return useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*");
      if (error) throw error;
      return data as Profile[];
    },
  });
}

export function useConversationData(conversationId?: string) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!conversationId) return;
    const f = `conversation_id=eq.${conversationId}`;
    const inv = (k: string) => () => qc.invalidateQueries({ queryKey: ["conv", conversationId, k] });
    const ch = supabase
      .channel(`conv-${conversationId}-${uid()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: f }, () => { inv("messages")(); inv("memory")(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks", filter: f }, inv("tasks"))
      .on("postgres_changes", { event: "*", schema: "public", table: "approvals", filter: f }, inv("approvals"))
      .on("postgres_changes", { event: "*", schema: "public", table: "conversation_participants", filter: f }, inv("participants"))
      .on("postgres_changes", { event: "*", schema: "public", table: "reactions" }, inv("reactions"))
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [conversationId, qc]);

  const enabled = !!conversationId;
  const messages = useQuery({
    enabled,
    queryKey: ["conv", conversationId, "messages"],
    queryFn: async () => {
      const { data, error } = await supabase.from("messages").select("*").eq("conversation_id", conversationId!).order("created_at").limit(500);
      if (error) throw error;
      return data as Message[];
    },
  });
  const participants = useQuery({
    enabled,
    queryKey: ["conv", conversationId, "participants"],
    queryFn: async () => {
      const { data, error } = await supabase.from("conversation_participants").select("*").eq("conversation_id", conversationId!);
      if (error) throw error;
      return data as Participant[];
    },
  });
  const tasks = useQuery({
    enabled,
    queryKey: ["conv", conversationId, "tasks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks").select("*").eq("conversation_id", conversationId!).order("created_at");
      if (error) throw error;
      return data as Task[];
    },
  });
  const approvals = useQuery({
    enabled,
    queryKey: ["conv", conversationId, "approvals"],
    queryFn: async () => {
      const { data, error } = await supabase.from("approvals").select("*").eq("conversation_id", conversationId!);
      if (error) throw error;
      return data as Approval[];
    },
  });
  const memory = useQuery({
    enabled,
    queryKey: ["conv", conversationId, "memory"],
    queryFn: async () => {
      const { data, error } = await supabase.from("conversation_memory").select("*").eq("conversation_id", conversationId!).order("created_at");
      if (error) throw error;
      return data as Memory[];
    },
  });
  const reactions = useQuery({
    enabled,
    queryKey: ["conv", conversationId, "reactions"],
    queryFn: async () => {
      const ids = (messages.data ?? []).map((m) => m.id);
      if (!ids.length) return [] as Reaction[];
      const { data, error } = await supabase.from("reactions").select("*").in("message_id", ids);
      if (error) throw error;
      return data as Reaction[];
    },
  });
  return { messages, participants, tasks, approvals, memory, reactions };
}

/** Most recent messages across the given conversations, for sidebar previews and unread counts. */
export function useRecentMessages(conversationIds: string[]) {
  const qc = useQueryClient();
  const key = conversationIds.slice().sort().join(",");
  useEffect(() => {
    if (!key) return;
    const ch = supabase
      .channel(`recent-${uid()}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => qc.invalidateQueries({ queryKey: ["recent"] }))
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [key, qc]);
  return useQuery({
    enabled: !!key,
    queryKey: ["recent", key],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("id, conversation_id, content, kind, sender_user_id, sender_agent_id, created_at")
        .in("conversation_id", conversationIds)
        .order("created_at", { ascending: false })
        .limit(400);
      if (error) throw error;
      return data;
    },
  });
}

const READ_KEY = "ac-last-read";
export function getLastRead(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(READ_KEY) ?? "{}");
  } catch {
    return {};
  }
}
export function markRead(conversationId: string) {
  const m = getLastRead();
  m[conversationId] = new Date().toISOString();
  localStorage.setItem(READ_KEY, JSON.stringify(m));
}
