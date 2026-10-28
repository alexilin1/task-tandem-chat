<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Agent routing runs server-side in `src/lib/agents/router.server.ts`, invoked from server functions and `/api/public/agents/*`; agent-authored writes use the admin client only after the caller is verified (why: agents are not auth users).
- Loop/limit rules live as pure functions in `src/lib/agents/safeguards.ts` with tests beside them (why: keep safety limits testable).
- External agent tokens are stored only as SHA-256 hashes in `agent_credentials` (service-role only) (why: never expose secrets to the browser).
- Demo workspace is seeded per user by the `handle_new_user` signup trigger (why: no seeding from app code).
- Workspace membership changes go through server functions in `src/lib/workspace.functions.ts` using the admin client after validating the invite; `workspace_members` has no client INSERT policy (why: invites must be validated server-side).
- Agents receive routed work only when `status` is `online` (`canReceiveWork`); external agents become online only via a passing connection test or authenticated API call, and `offline` means switched off by a human (why: never send work to unreachable or paused agents).
- Agent work is queued in `agent_jobs` (service-role only) and processed by `src/lib/agents/queue.server.ts`: the client kicks `runAgentQueue` after a send, and a once-a-minute scheduled sweep at `/api/public/jobs/agent-queue` catches leftovers; jobs are claimed atomically via `claim_agent_jobs` and retried up to the limit in safeguards (why: keep the send fast and never lose or double-run agent work).
