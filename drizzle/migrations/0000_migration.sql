
create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'You',
  avatar_color text not null default 'violet',
  created_at timestamptz not null default now()
);
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null,
  created_at timestamptz not null default now()
);
create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null,
  role text not null default 'member',
  primary key (workspace_id, user_id)
);
create table public.agents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  handle text not null,
  description text not null default '',
  provider text not null default 'builtin' check (provider in ('builtin','webhook','rest')),
  capabilities text[] not null default '{}',
  system_prompt text not null default '',
  avatar_emoji text not null default '🤖',
  color text not null default 'violet',
  permissions text[] not null default '{read_history,create_tasks,request_approval}',
  webhook_url text,
  status text not null default 'online',
  is_demo boolean not null default false,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workspace_id, handle)
);
create table public.agent_credentials (
  agent_id uuid primary key references public.agents(id) on delete cascade,
  token_hash text not null,
  webhook_secret text not null,
  created_at timestamptz not null default now()
);
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null,
  kind text not null default 'group' check (kind in ('group','dm')),
  description text not null default '',
  paused boolean not null default false,
  pause_reason text,
  max_depth int not null default 6,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.conversation_participants (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid,
  agent_id uuid references public.agents(id) on delete cascade,
  activity text,
  created_at timestamptz not null default now(),
  check ((user_id is null) <> (agent_id is null))
);
create unique index cp_user_uniq on public.conversation_participants(conversation_id, user_id) where user_id is not null;
create unique index cp_agent_uniq on public.conversation_participants(conversation_id, agent_id) where agent_id is not null;

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  title text not null,
  description text not null default '',
  assigned_agent_id uuid references public.agents(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','running','waiting_input','completed','failed')),
  progress int not null default 0,
  result text,
  depends_on uuid[] not null default '{}',
  requires_approval boolean not null default false,
  run_count int not null default 0,
  created_by_agent_id uuid,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_user_id uuid,
  sender_agent_id uuid references public.agents(id) on delete set null,
  content text not null default '',
  kind text not null default 'text' check (kind in ('text','system','task_event','approval')),
  mentions uuid[] not null default '{}',
  reply_to uuid references public.messages(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null,
  approval_id uuid,
  correlation_id uuid not null default gen_random_uuid(),
  depth int not null default 0,
  attachment jsonb,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);
create index messages_conv_idx on public.messages(conversation_id, created_at);
create table public.reactions (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null,
  emoji text not null,
  primary key (message_id, user_id, emoji)
);
create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  agent_id uuid references public.agents(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null,
  action text not null,
  details text not null default '',
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.conversation_memory (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  kind text not null default 'note',
  content text not null,
  created_by_agent_id uuid,
  created_by_user_id uuid,
  created_at timestamptz not null default now()
);
create table public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  agent_id uuid references public.agents(id) on delete set null,
  status text not null default 'ok',
  tokens int not null default 0,
  input_hash text,
  created_at timestamptz not null default now()
);

-- grants
grant select, insert, update, delete on public.profiles, public.workspaces, public.workspace_members, public.agents,
  public.conversations, public.conversation_participants, public.tasks, public.messages, public.reactions,
  public.approvals, public.conversation_memory to authenticated;
grant select on public.agent_runs to authenticated;
grant all on public.profiles, public.workspaces, public.workspace_members, public.agents, public.agent_credentials,
  public.conversations, public.conversation_participants, public.tasks, public.messages, public.reactions,
  public.approvals, public.conversation_memory, public.agent_runs to service_role;

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.agents enable row level security;
alter table public.agent_credentials enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.tasks enable row level security;
alter table public.messages enable row level security;
alter table public.reactions enable row level security;
alter table public.approvals enable row level security;
alter table public.conversation_memory enable row level security;
alter table public.agent_runs enable row level security;

create or replace function public.is_ws_member(_ws uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.workspace_members where workspace_id = _ws and user_id = auth.uid())
$$;
create or replace function public.is_conv_member(_conv uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.conversations c join public.workspace_members m on m.workspace_id = c.workspace_id
    where c.id = _conv and m.user_id = auth.uid())
$$;

create policy "profiles read" on public.profiles for select to authenticated using (true);
create policy "profiles update own" on public.profiles for update to authenticated using (id = auth.uid());
create policy "ws read" on public.workspaces for select to authenticated using (public.is_ws_member(id));
create policy "wsm read" on public.workspace_members for select to authenticated using (public.is_ws_member(workspace_id));
create policy "agents read" on public.agents for select to authenticated using (public.is_ws_member(workspace_id));
create policy "agents insert" on public.agents for insert to authenticated with check (public.is_ws_member(workspace_id));
create policy "agents update" on public.agents for update to authenticated using (public.is_ws_member(workspace_id));
create policy "agents delete" on public.agents for delete to authenticated using (public.is_ws_member(workspace_id));
create policy "conv read" on public.conversations for select to authenticated using (public.is_ws_member(workspace_id));
create policy "conv insert" on public.conversations for insert to authenticated with check (public.is_ws_member(workspace_id));
create policy "conv update" on public.conversations for update to authenticated using (public.is_ws_member(workspace_id));
create policy "cp all" on public.conversation_participants for all to authenticated using (public.is_conv_member(conversation_id)) with check (public.is_conv_member(conversation_id));
create policy "tasks read" on public.tasks for select to authenticated using (public.is_conv_member(conversation_id));
create policy "tasks write" on public.tasks for update to authenticated using (public.is_conv_member(conversation_id));
create policy "msg read" on public.messages for select to authenticated using (public.is_conv_member(conversation_id));
create policy "msg insert" on public.messages for insert to authenticated with check (public.is_conv_member(conversation_id) and sender_user_id = auth.uid() and sender_agent_id is null);
create policy "react read" on public.reactions for select to authenticated using (exists (select 1 from public.messages m where m.id = message_id and public.is_conv_member(m.conversation_id)));
create policy "react write" on public.reactions for insert to authenticated with check (user_id = auth.uid());
create policy "react delete" on public.reactions for delete to authenticated using (user_id = auth.uid());
create policy "approvals read" on public.approvals for select to authenticated using (public.is_conv_member(conversation_id));
create policy "mem read" on public.conversation_memory for select to authenticated using (public.is_conv_member(conversation_id));
create policy "mem insert" on public.conversation_memory for insert to authenticated with check (public.is_conv_member(conversation_id) and created_by_user_id = auth.uid());
create policy "mem delete" on public.conversation_memory for delete to authenticated using (public.is_conv_member(conversation_id));
create policy "runs read" on public.agent_runs for select to authenticated using (public.is_conv_member(conversation_id));

alter publication supabase_realtime add table public.messages, public.tasks, public.approvals, public.conversation_participants, public.conversations, public.reactions, public.agents;

-- demo seeding on signup
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  ws uuid; conv uuid; fe uuid; be uuid; re uuid; pm uuid; t1 uuid; t2 uuid; nm text;
  base timestamptz := now() - interval '20 minutes';
begin
  nm := coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1), 'You');
  insert into public.profiles(id, display_name) values (new.id, nm);
  insert into public.workspaces(name, owner_id) values (nm || '''s workspace', new.id) returning id into ws;
  insert into public.workspace_members(workspace_id, user_id, role) values (ws, new.id, 'owner');

  insert into public.agents(workspace_id,name,handle,description,capabilities,system_prompt,avatar_emoji,color,is_demo) values
   (ws,'Project Manager','ProjectManager','Coordinates tasks, identifies dependencies and tracks progress.','{planning,delegation,tracking}',
    'You are the Project Manager agent. Break objectives into concrete tasks, assign them to the right agents with @mentions, track dependencies and summarise progress. Keep messages short.','🧭','amber',true) returning id into pm;
  insert into public.agents(workspace_id,name,handle,description,capabilities,system_prompt,avatar_emoji,color,is_demo) values
   (ws,'Frontend Agent','FrontendAgent','Specialises in React, Next.js, CSS and UI development.','{react,css,ui-design}',
    'You are the Frontend Agent. You design and describe UI implementations in React and Tailwind. Ask @BackendAgent about APIs when needed. Use code blocks for code.','🎨','violet',true) returning id into fe;
  insert into public.agents(workspace_id,name,handle,description,capabilities,system_prompt,avatar_emoji,color,is_demo) values
   (ws,'Backend Agent','BackendAgent','Specialises in APIs, authentication, databases and server infrastructure.','{api,database,auth}',
    'You are the Backend Agent. You design APIs, schemas and auth. Request human approval before any production database change, deployment, deletion or spending.','🛠️','blue',true) returning id into be;
  insert into public.agents(workspace_id,name,handle,description,capabilities,system_prompt,avatar_emoji,color,is_demo) values
   (ws,'Research Agent','ResearchAgent','Searches information, analyses documents and prepares research summaries.','{research,analysis,summaries}',
    'You are the Research Agent. You produce concise, structured research summaries with bullet points. You cannot browse the live web; say so when relevant.','🔎','emerald',true) returning id into re;

  insert into public.conversations(workspace_id,title,description,created_by) values
   (ws,'Startup MVP','Build the MVP for a project tracking SaaS: dashboard UI, projects API and competitor research.', new.id) returning id into conv;
  insert into public.conversation_participants(conversation_id,user_id) values (conv,new.id);
  insert into public.conversation_participants(conversation_id,agent_id) values (conv,pm),(conv,fe),(conv,be),(conv,re);
  insert into public.conversation_memory(conversation_id,kind,content,created_by_user_id) values
   (conv,'decision','Stack: React + Tailwind frontend, REST API with GET /api/projects and POST /api/projects.', new.id);

  insert into public.tasks(conversation_id,title,description,assigned_agent_id,status,progress,created_by_agent_id,is_demo) values
   (conv,'Build dashboard interface','Projects dashboard with list + create form',fe,'running',40,pm,true) returning id into t1;
  insert into public.tasks(conversation_id,title,description,assigned_agent_id,status,progress,created_by_agent_id,is_demo) values
   (conv,'Projects API','GET/POST /api/projects',be,'running',55,pm,true) returning id into t2;

  insert into public.messages(conversation_id,sender_user_id,sender_agent_id,content,depth,is_demo,created_at) values
   (conv,new.id,null,'@ProjectManager split our MVP into development tasks.',0,true,base),
   (conv,null,pm,'I''ll assign the frontend to @FrontendAgent and API development to @BackendAgent.',1,true,base+interval '1 min'),
   (conv,null,pm,'@FrontendAgent build the dashboard interface.',1,true,base+interval '2 min'),
   (conv,null,fe,'Starting the dashboard. @BackendAgent which API endpoints will be available?',2,true,base+interval '3 min'),
   (conv,null,be,'I''ll expose `GET /api/projects` and `POST /api/projects`.',3,true,base+interval '4 min'),
   (conv,null,fe,'Perfect. I''ll build against those interfaces.',4,true,base+interval '5 min'),
   (conv,null,pm,'Both tasks are underway. I''ll review integration when they finish.',2,true,base+interval '6 min');
  insert into public.messages(conversation_id,sender_agent_id,content,kind,task_id,is_demo,created_at) values
   (conv,fe,'Frontend Agent started **Build dashboard interface**','task_event',t1,true,base+interval '5 min'),
   (conv,be,'Backend Agent started **Projects API**','task_event',t2,true,base+interval '5 min');
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();
