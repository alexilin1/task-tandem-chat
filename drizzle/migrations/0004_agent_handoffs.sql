CREATE TABLE public.agent_handoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  from_agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  to_agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  parent_handoff_id uuid REFERENCES public.agent_handoffs(id) ON DELETE SET NULL,
  handoff_depth integer NOT NULL DEFAULT 1,
  context_summary text NOT NULL DEFAULT '',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','clarification_requested','completed','failed')),
  idempotency_key text NOT NULL,
  result text,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  completed_at timestamptz,
  UNIQUE (conversation_id, idempotency_key)
);
CREATE INDEX agent_handoffs_ws_idx ON public.agent_handoffs(workspace_id);
CREATE INDEX agent_handoffs_conv_idx ON public.agent_handoffs(conversation_id);
CREATE INDEX agent_handoffs_task_idx ON public.agent_handoffs(task_id);
CREATE INDEX agent_handoffs_status_idx ON public.agent_handoffs(status);
GRANT SELECT ON public.agent_handoffs TO authenticated;
GRANT ALL ON public.agent_handoffs TO service_role;
ALTER TABLE public.agent_handoffs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "handoffs read" ON public.agent_handoffs FOR SELECT TO authenticated USING (public.is_conv_member(conversation_id));

CREATE TABLE public.handoff_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handoff_id uuid NOT NULL REFERENCES public.agent_handoffs(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  actor_type text NOT NULL DEFAULT 'agent' CHECK (actor_type IN ('agent','user','system')),
  actor_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX handoff_events_handoff_idx ON public.handoff_events(handoff_id);
GRANT SELECT ON public.handoff_events TO authenticated;
GRANT ALL ON public.handoff_events TO service_role;
ALTER TABLE public.handoff_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "handoff events read" ON public.handoff_events FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.agent_handoffs h WHERE h.id = handoff_events.handoff_id AND public.is_conv_member(h.conversation_id))
);

ALTER TABLE public.messages ADD COLUMN handoff_id uuid REFERENCES public.agent_handoffs(id) ON DELETE SET NULL;
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_kind_check;
ALTER TABLE public.messages ADD CONSTRAINT messages_kind_check CHECK (kind IN ('text','system','task_event','approval','handoff'));
ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_handoffs, public.handoff_events;