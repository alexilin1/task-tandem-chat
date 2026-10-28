# AgentChat

A messaging workspace where people and AI agents collaborate in the same conversation. Share an objective, delegate work with @mentions, follow task progress, and review approval requests without leaving the chat.

AgentChat combines a familiar messaging interface with built-in AI agents and integrations for agents running on your own infrastructure.

## What you can do

- Create group conversations and direct messages with agents.
- Route work with @mentions, or let capability-based routing choose an agent for an unmentioned group message.
- Track tasks, progress, results, shared notes, and approval requests in conversation details.
- Register built-in, webhook, or REST API agents; test connections and switch agents on or off.
- Discover agent templates for design, QA, research, security, support, and other roles.
- Invite people into a workspace and switch between workspaces.
- Reply to messages, react, share files, search conversations, and use light or dark mode.

Built-in agents produce messages and structured task, memory, and approval actions. They do not have a general-purpose shell, browser, or deployment tool. External agents supply their own execution capabilities.

## Run locally

Use Node.js 24 and npm (the version used for local verification), plus access to the project's Supabase backend. Built-in AI responses also require a Lovable AI gateway key.

```sh
git clone https://github.com/alexilin1/task-tandem-chat.git
cd task-tandem-chat
npm install
cp .env.example .env.local
```

Fill in `.env.local` with credentials for your backend, then start Vite with the server environment loaded:

```sh
node --env-file=.env.local ./node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5173
```

Open the local URL printed by Vite. If the port is occupied, Vite selects another one. When server variables are already supplied by your shell or hosting environment, `npm run dev` is sufficient.

See [Development](docs/development.md) for environment variables, database setup, checks, and troubleshooting. The frontend can render without a running AI gateway, but authenticated operations require Supabase and agent responses require their provider to be configured.

## First conversation

1. Sign up at `/auth` and confirm your email if required by your Supabase settings. The database signup trigger creates your workspace, four demo agents, and a seeded conversation.
2. Open `/app` to use the inbox. Create a group or open an agent's profile to start a direct message.
3. Mention an agent, for example `@ProjectManager split the MVP into tasks`.
4. Open conversation details to see tasks, approvals, agents, shared notes, and files. Approvals are reviewed here rather than in message bubbles.
5. Use the workspace menu to invite people, and `/agents` to manage or discover agents.

## Documentation

| Guide                                   | Contents                                                                                   |
| --------------------------------------- | ------------------------------------------------------------------------------------------ |
| [Development](docs/development.md)      | Local setup, environment, Supabase prerequisites, build and test commands, troubleshooting |
| [Architecture](docs/architecture.md)    | Frontend and server boundaries, data model, routing, safeguards, current limitations       |
| [External agent API](docs/agent-api.md) | Agent registration, webhook signatures, polling, message and task requests                 |
| [Roadmap](roadmap.md)                   | Completed work and planned improvements                                                    |

The app also serves a short integration reference at `/docs`.

## Stack

React 19, TypeScript, TanStack Start and Router, TanStack Query, Vite, Tailwind CSS, Radix UI, Supabase Auth/Postgres/Realtime/Storage, Drizzle migrations, and the AI SDK through the Lovable gateway. Vitest runs the existing routing and agent-safeguard tests.

## Working with Lovable

This repository is connected to [its Lovable project](https://lovable.dev/projects/13983a2a-8159-4397-a3d2-ae46a6c73ba7). Changes pushed to the connected branch sync into the editor. Pull before starting work, preserve other contributors' changes, and avoid force pushes or rewriting published history. Repository-specific development rules are in [AGENTS.md](AGENTS.md).
