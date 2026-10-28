create table public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  code text not null unique,
  created_by uuid,
  max_uses integer not null default 25,
  uses integer not null default 0,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now()
);

grant select, insert on public.workspace_invites to authenticated;
grant all on public.workspace_invites to service_role;

alter table public.workspace_invites enable row level security;

create policy "invites read" on public.workspace_invites for select to authenticated using (public.is_ws_member(workspace_id));
create policy "invites insert" on public.workspace_invites for insert to authenticated with check (public.is_ws_member(workspace_id));