# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Next.js 16 warning (from `AGENTS.md`):** APIs, conventions, and file structure may differ from training data. Consult `node_modules/next/dist/docs/` before editing framework-level code. One concrete example already in the repo: the auth middleware lives in `src/proxy.ts` (exporting `proxy`), not `middleware.ts`.

## Commands

```bash
npm run dev            # start Next.js dev server on :3000
npm run build          # prisma generate && next build
npm start              # serve the production build
npm run lint           # eslint (flat config in eslint.config.mjs)

# Database
npm run db:push        # prisma migrate dev — creates+applies a migration against DIRECT_URL
npm run db:studio      # prisma studio
npm run seed           # tsx prisma/seed.ts — seeds super admin + demo org
npx prisma migrate deploy   # apply pending migrations (use in prod / CI)
npx prisma generate         # regenerate client after schema edits (also runs postinstall)
```

No test runner is configured — there are no unit / e2e test scripts. Don't invent a `npm test` command; if tests are needed, add the framework explicitly.

### Prisma + Supabase gotcha

`prisma.config.ts` deliberately points the migration datasource at `DIRECT_URL` (port 5432), while `src/lib/prisma.ts` uses `DATABASE_URL` (pooler, port 6543) at runtime. Supabase's Supavisor pooler rejects DDL, so **never run migrations against `DATABASE_URL`**. Local `.env.local` is loaded for dev; `.env.production` is parsed manually when `DEPLOY_ENV=production`.

## Architecture

### Routing layout (App Router)

- `src/app/(auth)/` — login (public).
- `src/app/(dashboard)/` — tenant app (projects, cases, generator, executions, reports, bugs, settings). Shared layout provides nav and org context.
- `src/app/admin/` — Super Admin panel (orgs, admins, AI config). Separate layout; super-admin-only.
- `src/app/api/` — all server routes. Organized by resource; nested `[id]/` segments follow REST conventions.
- `src/app/pending/` — holding page for users with no org membership.

### Auth & authorization flow

1. NextAuth v5 (JWT strategy) in `src/lib/auth.ts`. Credentials provider hits Prisma, pulls the first `OrgMember`, and embeds `orgId`, `orgRole`, `isSuperAdmin` into the token / session.
2. `src/proxy.ts` (Next 16's middleware equivalent) gates every non-static path:
   - Unauthenticated → JSON 401 for `/api/*`, redirect to `/login` for pages.
   - Super admins are redirected **out of** tenant pages into `/admin`.
   - Non-super-admin users without an `orgId` are funneled to `/pending`.
   - `/settings/members` and `/settings/projects` require `OWNER` or `ADMIN`.
3. Inside API routes, extract the session user via `sessionUser(session.user)` from `src/lib/permissions.ts`.

### Multi-tenant data scoping

Every tenant query must filter by `organizationId`. Visibility within an org is further narrowed by project membership:

- `getProjectsForUser(userId, orgId, orgRole)` returns `null` for `OWNER`/`ADMIN` (meaning "no project filter"), or an explicit `string[]` of `projectId`s the user has been added to for `MEMBER`/`VIEWER`.
- `getLinkedProjects(userId, orgId)` always returns only explicit project memberships — use this in dashboard contexts where everyone (including owners) should see only projects they're attached to.

Treat `null` from `getProjectsForUser` as "skip the `projectId in […]` clause", not as "no access".

### AI providers

`src/lib/ai-config.ts` reads the active provider from a singleton `Setting` row with key `ai_provider_config` (managed from `/admin/ai`). If the row is missing, it falls back to `OPENAI_API_KEY` / `MANUS_API_KEY` / `ANTHROPIC_API_KEY` env vars. With no config and no keys, the generator returns mock cases rather than erroring — preserve that fallback when changing generator code.

### Customizable terminology

12+ domain terms (projeto, bug, casoDeTeste, execucao, etc. — see `src/lib/term-config.ts` and `src/contexts/terms-context.tsx`) are editable per org in `/settings/terms` and persisted in `localStorage` by language. UI strings should go through the terms context rather than being hardcoded, otherwise rebranding breaks.

### Shared libs (`src/lib/`)

- `prisma.ts` — singleton Prisma client using `@prisma/adapter-pg` + `pg.Pool` (SSL auto-enabled for Supabase hosts).
- `auth.ts` — NextAuth config + exported `handlers`, `auth`, `signIn`, `signOut`.
- `permissions.ts` — the scoping helpers above; also `SessionUser` type.
- `ai-config.ts`, `email.ts`, `i18n.ts`, `term-config.ts`, `enum-config.ts`, `openapi.ts`, `utils.ts` — self-descriptive.

### UI stack conventions

- Radix primitives live under `src/components/ui/`; compose them rather than pulling new headless libs.
- Server state goes through TanStack Query v5 (note: v5 dropped `onSuccess` / `onError` from `useQuery` — use `useEffect` or `useMutation` callbacks; recent commits fix regressions from that migration).
- Forms: React Hook Form + Zod resolvers.
- Global client state: Zustand.
- Context providers (`lang`, `terms`, `theme`) wrap the app in `src/components/providers.tsx`.

### API surface

OpenAPI spec is generated in `src/lib/openapi.ts` and served at `/api-docs` (Swagger UI). Keep that spec updated when adding or renaming endpoints under `src/app/api/`.

Always check the @AGENTS.md to implement new features