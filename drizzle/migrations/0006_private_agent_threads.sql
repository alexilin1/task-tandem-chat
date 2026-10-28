ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS conversations_kind_check;
ALTER TABLE public.conversations ADD CONSTRAINT conversations_kind_check CHECK (kind IN ('group','dm','thread'));
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS parent_conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS thread_status text NOT NULL DEFAULT 'open';
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS thread_result text;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS started_by_agent_id uuid REFERENCES public.agents(id) ON DELETE SET NULL;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS thread_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL;