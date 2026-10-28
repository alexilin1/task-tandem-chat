export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      agent_activity_events: {
        Row: {
          agent_id: string | null
          conversation_id: string | null
          created_at: string
          event_type: string
          id: string
          metadata: Json
          run_id: string | null
          summary: string
          task_id: string | null
          workspace_id: string
        }
        Insert: {
          agent_id?: string | null
          conversation_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          run_id?: string | null
          summary: string
          task_id?: string | null
          workspace_id: string
        }
        Update: {
          agent_id?: string | null
          conversation_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          run_id?: string | null
          summary?: string
          task_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_activity_events_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_activity_events_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_activity_events_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_activity_events_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_activity_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_budgets: {
        Row: {
          agent_id: string | null
          created_at: string
          hard_limit: boolean
          id: string
          max_cost_per_run_usd: number | null
          monthly_limit_usd: number
          updated_at: string
          warn_at_percent: number
          workspace_id: string
        }
        Insert: {
          agent_id?: string | null
          created_at?: string
          hard_limit?: boolean
          id?: string
          max_cost_per_run_usd?: number | null
          monthly_limit_usd: number
          updated_at?: string
          warn_at_percent?: number
          workspace_id: string
        }
        Update: {
          agent_id?: string | null
          created_at?: string
          hard_limit?: boolean
          id?: string
          max_cost_per_run_usd?: number | null
          monthly_limit_usd?: number
          updated_at?: string
          warn_at_percent?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_budgets_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_budgets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_credentials: {
        Row: {
          agent_id: string
          created_at: string
          token_hash: string
          webhook_secret: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          token_hash: string
          webhook_secret: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          token_hash?: string
          webhook_secret?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_credentials_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: true
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_handoffs: {
        Row: {
          accepted_at: string | null
          attempts: number
          completed_at: string | null
          context_summary: string
          conversation_id: string
          created_at: string
          from_agent_id: string
          handoff_depth: number
          id: string
          idempotency_key: string
          parent_handoff_id: string | null
          payload: Json
          result: string | null
          status: string
          task_id: string
          to_agent_id: string
          workspace_id: string
        }
        Insert: {
          accepted_at?: string | null
          attempts?: number
          completed_at?: string | null
          context_summary?: string
          conversation_id: string
          created_at?: string
          from_agent_id: string
          handoff_depth?: number
          id?: string
          idempotency_key: string
          parent_handoff_id?: string | null
          payload?: Json
          result?: string | null
          status?: string
          task_id: string
          to_agent_id: string
          workspace_id: string
        }
        Update: {
          accepted_at?: string | null
          attempts?: number
          completed_at?: string | null
          context_summary?: string
          conversation_id?: string
          created_at?: string
          from_agent_id?: string
          handoff_depth?: number
          id?: string
          idempotency_key?: string
          parent_handoff_id?: string | null
          payload?: Json
          result?: string | null
          status?: string
          task_id?: string
          to_agent_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_handoffs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_handoffs_from_agent_id_fkey"
            columns: ["from_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_handoffs_parent_handoff_id_fkey"
            columns: ["parent_handoff_id"]
            isOneToOne: false
            referencedRelation: "agent_handoffs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_handoffs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_handoffs_to_agent_id_fkey"
            columns: ["to_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_handoffs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_jobs: {
        Row: {
          attempts: number
          conversation_id: string
          created_at: string
          id: string
          last_error: string | null
          locked_until: string | null
          message_id: string
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          conversation_id: string
          created_at?: string
          id?: string
          last_error?: string | null
          locked_until?: string | null
          message_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          conversation_id?: string
          created_at?: string
          id?: string
          last_error?: string | null
          locked_until?: string | null
          message_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_jobs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_jobs_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: true
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_runs: {
        Row: {
          agent_id: string | null
          conversation_id: string
          created_at: string
          error_summary: string | null
          estimated_cost_usd: number | null
          finished_at: string | null
          id: string
          input_hash: string | null
          model: string | null
          started_at: string | null
          status: string
          task_id: string | null
          tokens: number
          workspace_id: string | null
        }
        Insert: {
          agent_id?: string | null
          conversation_id: string
          created_at?: string
          error_summary?: string | null
          estimated_cost_usd?: number | null
          finished_at?: string | null
          id?: string
          input_hash?: string | null
          model?: string | null
          started_at?: string | null
          status?: string
          task_id?: string | null
          tokens?: number
          workspace_id?: string | null
        }
        Update: {
          agent_id?: string | null
          conversation_id?: string
          created_at?: string
          error_summary?: string | null
          estimated_cost_usd?: number | null
          finished_at?: string | null
          id?: string
          input_hash?: string | null
          model?: string | null
          started_at?: string | null
          status?: string
          task_id?: string | null
          tokens?: number
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_runs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_runs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_runs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      agents: {
        Row: {
          avatar_emoji: string
          capabilities: string[]
          color: string
          created_at: string
          description: string
          handle: string
          id: string
          is_demo: boolean
          last_seen_at: string | null
          name: string
          permissions: string[]
          provider: string
          status: string
          system_prompt: string
          webhook_url: string | null
          workspace_id: string
        }
        Insert: {
          avatar_emoji?: string
          capabilities?: string[]
          color?: string
          created_at?: string
          description?: string
          handle: string
          id?: string
          is_demo?: boolean
          last_seen_at?: string | null
          name: string
          permissions?: string[]
          provider?: string
          status?: string
          system_prompt?: string
          webhook_url?: string | null
          workspace_id: string
        }
        Update: {
          avatar_emoji?: string
          capabilities?: string[]
          color?: string
          created_at?: string
          description?: string
          handle?: string
          id?: string
          is_demo?: boolean
          last_seen_at?: string | null
          name?: string
          permissions?: string[]
          provider?: string
          status?: string
          system_prompt?: string
          webhook_url?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agents_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_events: {
        Row: {
          actor_id: string | null
          actor_type: string
          approval_id: string
          created_at: string
          event_type: string
          id: string
          metadata: Json
        }
        Insert: {
          actor_id?: string | null
          actor_type: string
          approval_id: string
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
        }
        Update: {
          actor_id?: string | null
          actor_type?: string
          approval_id?: string
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "approval_events_approval_id_fkey"
            columns: ["approval_id"]
            isOneToOne: false
            referencedRelation: "approvals"
            referencedColumns: ["id"]
          },
        ]
      }
      approvals: {
        Row: {
          action: string
          action_hash: string | null
          action_payload: Json
          action_type: string
          agent_id: string | null
          conversation_id: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          details: string
          expires_at: string
          id: string
          status: string
          task_id: string | null
        }
        Insert: {
          action: string
          action_hash?: string | null
          action_payload?: Json
          action_type?: string
          agent_id?: string | null
          conversation_id: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          details?: string
          expires_at?: string
          id?: string
          status?: string
          task_id?: string | null
        }
        Update: {
          action?: string
          action_hash?: string | null
          action_payload?: Json
          action_type?: string
          agent_id?: string | null
          conversation_id?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          details?: string
          expires_at?: string
          id?: string
          status?: string
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approvals_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_memory: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          created_by_agent_id: string | null
          created_by_user_id: string | null
          id: string
          kind: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          created_by_agent_id?: string | null
          created_by_user_id?: string | null
          id?: string
          kind?: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          created_by_agent_id?: string | null
          created_by_user_id?: string | null
          id?: string
          kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_memory_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          activity: string | null
          agent_id: string | null
          conversation_id: string
          created_at: string
          id: string
          user_id: string | null
        }
        Insert: {
          activity?: string | null
          agent_id?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          user_id?: string | null
        }
        Update: {
          activity?: string | null
          agent_id?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          id: string
          kind: string
          max_depth: number
          parent_conversation_id: string | null
          pause_reason: string | null
          paused: boolean
          started_by_agent_id: string | null
          thread_result: string | null
          thread_status: string
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          kind?: string
          max_depth?: number
          parent_conversation_id?: string | null
          pause_reason?: string | null
          paused?: boolean
          started_by_agent_id?: string | null
          thread_result?: string | null
          thread_status?: string
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          kind?: string
          max_depth?: number
          parent_conversation_id?: string | null
          pause_reason?: string | null
          paused?: boolean
          started_by_agent_id?: string | null
          thread_result?: string | null
          thread_status?: string
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_parent_conversation_id_fkey"
            columns: ["parent_conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_started_by_agent_id_fkey"
            columns: ["started_by_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      handoff_events: {
        Row: {
          actor_id: string | null
          actor_type: string
          created_at: string
          event_type: string
          handoff_id: string
          id: string
          metadata: Json
        }
        Insert: {
          actor_id?: string | null
          actor_type?: string
          created_at?: string
          event_type: string
          handoff_id: string
          id?: string
          metadata?: Json
        }
        Update: {
          actor_id?: string | null
          actor_type?: string
          created_at?: string
          event_type?: string
          handoff_id?: string
          id?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "handoff_events_handoff_id_fkey"
            columns: ["handoff_id"]
            isOneToOne: false
            referencedRelation: "agent_handoffs"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          approval_id: string | null
          attachment: Json | null
          content: string
          conversation_id: string
          correlation_id: string
          created_at: string
          depth: number
          handoff_id: string | null
          id: string
          is_demo: boolean
          kind: string
          mentions: string[]
          reply_to: string | null
          sender_agent_id: string | null
          sender_user_id: string | null
          task_id: string | null
          thread_id: string | null
        }
        Insert: {
          approval_id?: string | null
          attachment?: Json | null
          content?: string
          conversation_id: string
          correlation_id?: string
          created_at?: string
          depth?: number
          handoff_id?: string | null
          id?: string
          is_demo?: boolean
          kind?: string
          mentions?: string[]
          reply_to?: string | null
          sender_agent_id?: string | null
          sender_user_id?: string | null
          task_id?: string | null
          thread_id?: string | null
        }
        Update: {
          approval_id?: string | null
          attachment?: Json | null
          content?: string
          conversation_id?: string
          correlation_id?: string
          created_at?: string
          depth?: number
          handoff_id?: string | null
          id?: string
          is_demo?: boolean
          kind?: string
          mentions?: string[]
          reply_to?: string | null
          sender_agent_id?: string | null
          sender_user_id?: string | null
          task_id?: string | null
          thread_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_handoff_id_fkey"
            columns: ["handoff_id"]
            isOneToOne: false
            referencedRelation: "agent_handoffs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_fkey"
            columns: ["reply_to"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_agent_id_fkey"
            columns: ["sender_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_color: string
          created_at: string
          display_name: string
          id: string
        }
        Insert: {
          avatar_color?: string
          created_at?: string
          display_name?: string
          id: string
        }
        Update: {
          avatar_color?: string
          created_at?: string
          display_name?: string
          id?: string
        }
        Relationships: []
      }
      reactions: {
        Row: {
          emoji: string
          message_id: string
          user_id: string
        }
        Insert: {
          emoji: string
          message_id: string
          user_id: string
        }
        Update: {
          emoji?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_agent_id: string | null
          conversation_id: string
          created_at: string
          created_by_agent_id: string | null
          depends_on: string[]
          description: string
          id: string
          is_demo: boolean
          priority: string
          progress: number
          requires_approval: boolean
          result: string | null
          run_count: number
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_agent_id?: string | null
          conversation_id: string
          created_at?: string
          created_by_agent_id?: string | null
          depends_on?: string[]
          description?: string
          id?: string
          is_demo?: boolean
          priority?: string
          progress?: number
          requires_approval?: boolean
          result?: string | null
          run_count?: number
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_agent_id?: string | null
          conversation_id?: string
          created_at?: string
          created_by_agent_id?: string | null
          depends_on?: string[]
          description?: string
          id?: string
          is_demo?: boolean
          priority?: string
          progress?: number
          requires_approval?: boolean
          result?: string | null
          run_count?: number
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_agent_id_fkey"
            columns: ["assigned_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_invites: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          max_uses: number
          uses: number
          workspace_id: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          max_uses?: number
          uses?: number
          workspace_id: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          max_uses?: number
          uses?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_invites_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          role: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          role?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          role?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_agent_jobs: {
        Args: { _conversation_id?: string; _limit: number }
        Returns: {
          attempts: number
          conversation_id: string
          created_at: string
          id: string
          last_error: string | null
          locked_until: string | null
          message_id: string
          status: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "agent_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      is_conv_member: { Args: { _conv: string }; Returns: boolean }
      is_ws_member: { Args: { _ws: string }; Returns: boolean }
      month_spend_usd: {
        Args: { _agent_id?: string; _workspace_id: string }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
