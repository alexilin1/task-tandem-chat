# Development

## Environment

The quick start in [README](../README.md#run-locally) uses Node.js 24. Dependencies are declared in `package.json`; the repository also includes the original Bun lockfile. The npm setup uses `npm install` because there is no committed npm lockfile.

Copy `.env.example` to `.env.local`, which is ignored by Git. Values in the example are placeholders. The existing `.env` may describe the connected deployment; use `.env.local` to override browser settings for your own backend.

| Variable                        | Used by           | Purpose                                                             |
| ------------------------------- | ----------------- | ------------------------------------------------------------------- |
| `VITE_SUPABASE_URL`             | Browser           | Public Supabase API URL                                             |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Browser           | Supabase publishable key                                            |
| `SUPABASE_URL`                  | Server            | Backend URL for authenticated server functions and admin operations |
| `SUPABASE_PUBLISHABLE_KEY`      | Server            | Key used by authenticated server middleware                         |
| `SUPABASE_SERVICE_ROLE_KEY`     | Server            | Privileged operations after caller authorization                    |
| `LOVABLE_API_KEY`               | Server            | Built-in agents and LLM routing through the Lovable gateway         |
| `LOVABLE_DB_MIGRATION_URL`      | Migration tooling | Postgres connection read by `drizzle.config.ts`                     |

Keep the browser and server configuration pointed at the same Supabase project, unless deliberately using the client's supported runtime URL override. Never put a service-role key, agent token, webhook secret, or AI gateway key in a `VITE_*` variable: those variables ship to the browser.

Vite loads browser variables from environment files. Server code reads `process.env`, so the documented startup command explicitly loads `.env.local` into Node as well:

```sh
node --env-file=.env.local ./node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5173
```

Restart the process after changing environment values.

## Supabase prerequisites

An existing configured backend is the shortest route to running the app. A new Supabase project needs more than frontend keys:

1. Review and apply the SQL migrations in `drizzle/migrations` in order, recording them with your migration workflow. They define the schema, membership policies, signup trigger, Realtime publication, attachment policies, invites, and restricted profile visibility. Do not reapply them blindly to an existing database.
2. Ensure Supabase Auth is enabled. Configure allowed site/redirect URLs for the local origin you actually use. Signup sends its confirmation redirect to `/app`.
3. Ensure a private Storage bucket named `attachments` exists, with the intended 10 MB file limit. The checked-in SQL adds object access policies but does not create the bucket. Object paths begin with the conversation UUID.
4. Verify the Realtime publication includes the tables listed in migration `0000_migration.sql`.
5. Configure the Lovable gateway credentials if you want built-in agent responses. Google sign-in uses the Lovable OAuth integration and needs that deployment's OAuth configuration; email/password is a separate Supabase flow.

The `handle_new_user` trigger seeds a profile, workspace membership, four agents, conversation, tasks, messages, and shared memory on signup. It does not backfill existing auth users. A local Vite server still uses whichever backend your environment points to; it does not start a local Supabase instance.

Drizzle uses `drizzle/schema.ts`, writes migrations to `drizzle/migrations`, and reads its connection from `LOVABLE_DB_MIGRATION_URL`. SQL also contains triggers, policies, and publication changes, so review database changes alongside the schema rather than relying on generated table definitions alone.

## Commands

| Command              | Purpose                                                         |
| -------------------- | --------------------------------------------------------------- |
| `npm run dev`        | Start Vite when server environment variables are already loaded |
| `npm run build`      | Build client and server output under `.output`                  |
| `npm run preview`    | Preview a production build with the configured runtime          |
| `npm test`           | Run existing Vitest tests                                       |
| `npm run test:watch` | Run Vitest in watch mode                                        |
| `npx tsc --noEmit`   | Type-check the application                                      |
| `npm run lint`       | Run ESLint and its formatting rules                             |
| `npm run format`     | Format the repository; inspect the resulting diff               |

For build or preview commands requiring local server credentials, use Node's `--env-file=.env.local` with the Vite executable as in the startup example, replacing the Vite arguments with `build` or `preview`. Production hosting must supply server variables at runtime and browser variables when building. The shared Vite configuration currently produces a Nitro Cloudflare target; inspect generated runtime configuration before deploying elsewhere.

`vite.config.ts` uses Lovable's shared configuration, which already includes React, Tailwind, TanStack Start, path aliases, and Nitro. Adding those plugins again can break the build. `src/routeTree.gen.ts` is generated; add or change route files instead.

## Troubleshooting

| Symptom                                     | Check                                                                                                                                          |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Missing Supabase environment error          | Both browser and server variables are set; Node received `.env.local`                                                                          |
| No workspace after signing in               | The signup trigger exists and ran for this user                                                                                                |
| Messages appear but an agent does not reply | Agent is online, belongs to the conversation, conversation is resumed, provider credentials are set, and the details panel has no pause reason |
| External agent stays not connected          | Its connection test or authenticated API call succeeded; see the [integration guide](agent-api.md)                                             |
| Files fail to upload                        | Bucket exists, size limit is configured, and the user has access to the conversation                                                           |
| Google sign-in fails locally                | Lovable OAuth and local redirect origin are configured                                                                                         |
| Updates do not appear live                  | Realtime publication and membership policies are applied                                                                                       |
| Port changes on startup                     | Use the actual URL Vite prints and update auth redirects if necessary                                                                          |

Before pushing, fetch and merge remote changes without rewriting published history. Changes on the connected branch also sync to Lovable.
