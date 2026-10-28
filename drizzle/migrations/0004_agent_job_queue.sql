CREATE TABLE public.agent_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL UNIQUE REFERENCES public.messages(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','done','failed')),
  attempts int NOT NULL DEFAULT 0,
  locked_until timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX agent_jobs_pending_idx ON public.agent_jobs (status, created_at);
GRANT ALL ON public.agent_jobs TO service_role;
ALTER TABLE public.agent_jobs ENABLE ROW LEVEL SECURITY;

-- Atomically claim a bounded batch; stale "running" jobs (lease expired) are reclaimed.
CREATE OR REPLACE FUNCTION public.claim_agent_jobs(_limit int, _conversation_id uuid DEFAULT NULL)
RETURNS SETOF public.agent_jobs
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.agent_jobs j
  SET status = 'running', attempts = j.attempts + 1, locked_until = now() + interval '3 minutes', updated_at = now()
  WHERE j.id IN (
    SELECT id FROM public.agent_jobs
    WHERE (status = 'pending' OR (status = 'running' AND locked_until < now()))
      AND (_conversation_id IS NULL OR conversation_id = _conversation_id)
    ORDER BY created_at
    LIMIT LEAST(GREATEST(_limit, 1), 10)
    FOR UPDATE SKIP LOCKED
  )
  RETURNING j.*;
$$;
REVOKE ALL ON FUNCTION public.claim_agent_jobs(int, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_agent_jobs(int, uuid) TO service_role;