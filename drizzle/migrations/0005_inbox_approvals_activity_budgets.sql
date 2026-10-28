-- Restore handoff schema in migration history (already present in the database; idempotent).
CREATE TABLE IF NOT EXISTS public.agent_handoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  from_agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  to_agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  parent_handoff_id uuid REFERENCES public.agent_handoffs(id) ON DELETE SET NULL,
  handoff_depth int NOT NULL DEFAULT 1,
  context_summary text NOT NULL DEFAULT '',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','clarification_requested','completed','failed')),
  idempotency_key text NOT NULL,
  result text,
  attempts int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  completed_at timestamptz,
  UNIQUE (conversation_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS agent_handoffs_ws_idx ON public.agent_handoffs (workspace_id);
CREATE INDEX IF NOT EXISTS agent_handoffs_conv_idx ON public.agent_handoffs (conversation_id);
CREATE INDEX IF NOT EXISTS agent_handoffs_task_idx ON public.agent_handoffs (task_id);
CREATE INDEX IF NOT EXISTS agent_handoffs_status_idx ON public.agent_handoffs (status);
CREATE TABLE IF NOT EXISTS public.handoff_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handoff_id uuid NOT NULL REFERENCES public.agent_handoffs(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  actor_type text NOT NULL DEFAULT 'agent' CHECK (actor_type IN ('agent','user','system')),
  actor_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS handoff_events_handoff_idx ON public.handoff_events (handoff_id);
GRANT SELECT ON public.agent_handoffs, public.handoff_events TO authenticated;
GRANT ALL ON public.agent_handoffs, public.handoff_events TO service_role;
ALTER TABLE public.agent_handoffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.handoff_events ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='agent_handoffs' AND policyname='handoffs read') THEN
    CREATE POLICY "handoffs read" ON public.agent_handoffs FOR SELECT TO authenticated USING (public.is_conv_member(conversation_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='handoff_events' AND policyname='handoff events read') THEN
    CREATE POLICY "handoff events read" ON public.handoff_events FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.agent_handoffs h WHERE h.id = handoff_events.handoff_id AND public.is_conv_member(h.conversation_id)));
  END IF;
END $$;

-- Tasks: priority
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal';
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_priority_check;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_priority_check CHECK (priority IN ('low','normal','high','urgent'));

-- Approvals: bound to an exact action, expiry, request-changes, audit log
ALTER TABLE public.approvals ADD COLUMN IF NOT EXISTS action_type text NOT NULL DEFAULT 'other';
ALTER TABLE public.approvals ADD COLUMN IF NOT EXISTS action_payload jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.approvals ADD COLUMN IF NOT EXISTS action_hash text;
ALTER TABLE public.approvals ADD COLUMN IF NOT EXISTS expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days');
ALTER TABLE public.approvals ADD COLUMN IF NOT EXISTS decision_note text;
ALTER TABLE public.approvals DROP CONSTRAINT IF EXISTS approvals_status_check;
ALTER TABLE public.approvals ADD CONSTRAINT approvals_status_check CHECK (status IN ('pending','approved','rejected','changes_requested','expired'));
CREATE INDEX IF NOT EXISTS approvals_status_idx ON public.approvals (status, created_at DESC);
CREATE TABLE public.approval_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_id uuid NOT NULL REFERENCES public.approvals(id) ON DELETE CASCADE,
  actor_type text NOT NULL CHECK (actor_type IN ('agent','user','system')),
  actor_id uuid,
  event_type text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX approval_events_approval_idx ON public.approval_events (approval_id, created_at);
GRANT SELECT ON public.approval_events TO authenticated;
GRANT ALL ON public.approval_events TO service_role;
ALTER TABLE public.approval_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "approval events read" ON public.approval_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.approvals a WHERE a.id = approval_events.approval_id AND public.is_conv_member(a.conversation_id)));

-- Executions: extend agent_runs with real timing/usage
ALTER TABLE public.agent_runs ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.agent_runs ADD COLUMN IF NOT EXISTS task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL;
ALTER TABLE public.agent_runs ADD COLUMN IF NOT EXISTS model text;
ALTER TABLE public.agent_runs ADD COLUMN IF NOT EXISTS started_at timestamptz;
ALTER TABLE public.agent_runs ADD COLUMN IF NOT EXISTS finished_at timestamptz;
ALTER TABLE public.agent_runs ADD COLUMN IF NOT EXISTS error_summary text;
ALTER TABLE public.agent_runs ADD COLUMN IF NOT EXISTS estimated_cost_usd numeric(12,6);
UPDATE public.agent_runs r SET workspace_id = c.workspace_id FROM public.conversations c WHERE c.id = r.conversation_id AND r.workspace_id IS NULL;
CREATE INDEX IF NOT EXISTS agent_runs_ws_time_idx ON public.agent_runs (workspace_id, created_at DESC);

-- Activity timeline
CREATE TABLE public.agent_activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES public.agents(id) ON DELETE SET NULL,
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  run_id uuid REFERENCES public.agent_runs(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  summary text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX agent_activity_ws_time_idx ON public.agent_activity_events (workspace_id, created_at DESC);
CREATE INDEX agent_activity_agent_idx ON public.agent_activity_events (agent_id, created_at DESC);
CREATE INDEX agent_activity_task_idx ON public.agent_activity_events (task_id);
GRANT SELECT ON public.agent_activity_events TO authenticated;
GRANT ALL ON public.agent_activity_events TO service_role;
ALTER TABLE public.agent_activity_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "activity read" ON public.agent_activity_events FOR SELECT TO authenticated USING (public.is_ws_member(workspace_id));

-- Budgets (USD, estimated)
CREATE TABLE public.agent_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES public.agents(id) ON DELETE CASCADE,
  monthly_limit_usd numeric(12,2) NOT NULL CHECK (monthly_limit_usd >= 0),
  max_cost_per_run_usd numeric(12,4),
  warn_at_percent int NOT NULL DEFAULT 80 CHECK (warn_at_percent BETWEEN 1 AND 100),
  hard_limit boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX agent_budgets_scope_uniq ON public.agent_budgets (workspace_id, agent_id) NULLS NOT DISTINCT;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_budgets TO authenticated;
GRANT ALL ON public.agent_budgets TO service_role;
ALTER TABLE public.agent_budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "budgets read" ON public.agent_budgets FOR SELECT TO authenticated USING (public.is_ws_member(workspace_id));
CREATE POLICY "budgets insert" ON public.agent_budgets FOR INSERT TO authenticated WITH CHECK (public.is_ws_member(workspace_id));
CREATE POLICY "budgets update" ON public.agent_budgets FOR UPDATE TO authenticated USING (public.is_ws_member(workspace_id)) WITH CHECK (public.is_ws_member(workspace_id));
CREATE POLICY "budgets delete" ON public.agent_budgets FOR DELETE TO authenticated USING (public.is_ws_member(workspace_id));

-- Month-to-date estimated spend for a scope (workspace, optionally one agent).
CREATE OR REPLACE FUNCTION public.month_spend_usd(_workspace_id uuid, _agent_id uuid DEFAULT NULL)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(sum(estimated_cost_usd), 0) FROM public.agent_runs
  WHERE workspace_id = _workspace_id AND (_agent_id IS NULL OR agent_id = _agent_id)
    AND created_at >= date_trunc('month', now());
$$;
REVOKE ALL ON FUNCTION public.month_spend_usd(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.month_spend_usd(uuid, uuid) TO service_role;

ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_activity_events;