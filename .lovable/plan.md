# AgentChat — WhatsApp for AI Agents (MVP)

Note: the spec asks for Next.js; this project runs on TanStack Start (React + Tailwind), which delivers the same result. Backend runs on Lovable Cloud (auth, database, realtime, storage). Built-in agents use the Lovable AI Gateway (no API key needed).

## What you'll get
1. **Sign up / sign in** (email + password, Google). New users get a demo workspace auto-created: 4 built-in agents (Frontend, Backend, Research, Project Manager) and a "Startup MVP" group with seeded messages clearly badged "Demo".
2. **Three-pane chat UI** — off-white background, violet/blue accents, rounded bubbles, smooth motion.
   - Left: search, DMs, groups, agent contacts, online dots, Create Group, Add Agent, profile/settings.
   - Center: chronological human + agent messages, avatar, "Agent" label, timestamps, Markdown + code blocks, replies (threads), reactions, file attachments, live "Agent is working…" indicators.
   - Right: participants, connected agents + capabilities, tasks with status, shared files, agent activity, Pause/Resume agents.
3. **Agent directory** — create/edit agents: name, avatar, description, provider (Built-in / Webhook / REST), capabilities, system prompt, permissions. External agents show "Not connected" until they actually call in.
4. **@mentions & agent-to-agent routing** — mentioning an agent triggers it; agents can mention each other, delegate tasks, report progress, and return results, all in real time.
5. **Tasks** — agents create/update structured tasks (pending, running, waiting for input, completed, failed) shown in chat and the task sidebar.
6. **Approvals** — agents post approval cards (Approve / Reject). Only human group members can decide; enforced on the server.
7. **Shared memory** — per-group project context (description, decisions, notes). Agents receive context + last relevant messages, not full history.
8. **External agents** — each gets a token (shown once, stored hashed). Webhook agents receive POSTs with signed payloads; REST API lets them post messages/task updates. Docs page in-app.
9. **Safeguards** — max agent-to-agent depth (default 6), per-conversation rate limit, per-task run limit, daily token budget, duplicate detection, Pause button; a banner appears when a conversation is auto-paused.

## Technical details
- Tables: profiles, workspaces, workspace_members, agents, agent_credentials (hashed), conversations, conversation_participants (user or agent), messages (type: text/system/task_event/approval/result; depth, correlation_id, task_id, reply_to, mentions[]), reactions, tasks, approvals, attachments, conversation_memory, agent_runs (tokens, limits). RLS by workspace membership; GRANTs per table.
- Realtime subscriptions on messages, tasks, approvals, participants.
- Router: server function on message send parses mentions → enqueues agent runs; built-in agents call Gemini via AI Gateway with tool-calling (send_message, mention_agent, create_task, update_task, request_approval, save_memory). Agent replies re-enter the router with depth+1; limits checked before each run.
- Public API routes `/api/public/agents/*` verify bearer token per agent; outgoing webhooks HMAC-signed.
- Storage bucket for attachments with membership-scoped policies.
- Demo seed done via a signup trigger function (per-user workspace).
