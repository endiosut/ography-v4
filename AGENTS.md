# AGENTS.md — OGraphy V4

> Place this file at the **repository root**. Claude Code, Codex, Cursor and most coding
> agents read it automatically at session start. Keep a copy named `CLAUDE.md` alongside it
> (or symlink) if your agent looks for that name instead.

You are working on the OGraphy V4 studio platform. Read this file completely before your
first action. These rules exist because ten weeks of production changes were previously
lost to untracked CLI deploys. Do not repeat that.

---

## Rule 0 — the one that catches everything else

**After any change, re-query the exact property you claimed to change.
A success message is not evidence.**

This rule is not theoretical. Each of these reported success and changed nothing:

| Claimed | What the re-query found |
|---|---|
| `export const dynamic = 'force-dynamic'` fixes the stale cache | `next build` still marked the route `○ Static` — segment config is ignored in `'use client'` files |
| Magic link removed | 2 orphaned `sent` references; caught by `tsc`, not by reading |
| `revoke execute … from anon, authenticated` | `has_function_privilege('anon', …)` still `true` — Postgres grants to `PUBLIC` and `anon` inherits it |
| Catalog fallback deleted | 2 chunks still carried `Echo Launch Kit`; traced to a *different* file |
| `lib/supabase.ts` swapped to a session-aware client | The rewrite silently deleted 8 exports and broke 6 admin pages |

**What a re-query looks like, by layer:**

- **Database** — `select` the property itself (`has_function_privilege`, `pg_policies`, a row count), never the migration's return value.
- **Build config** — read the `next build` route table (`○` static vs `ƒ` dynamic). Compiling is not configuring.
- **Deleted code** — grep the **shipped bundle** (`.next/static`), not the source. Source is intent; the bundle is fact.
- **Deleted data** — check for orphans, not just the absence of the row you targeted.
- **Refactored module** — diff the export list against the previous commit before and after.
- **Anything deployed** — `curl -I` the live URL. A green build is not a deployed change.

**Corollary — a test that can pass for the wrong reason is worse than no test.**
"Open `/admin`, do payment links render?" was proposed as proof that locking down RLS was safe. They render *because* `anon` can read everything. The test would have returned green and the lockdown would have blanked seven pages.
Before trusting a check, ask: **what else would make this pass?**

**Corollary — prefer the surgical change to the rewrite.**
`lib/supabase.ts` needed one line changed. It was rewritten instead, and 8 exports went with it. When the goal is "swap X for Y", change X. Do not retype the file.

---

## Hard rules — never violate

1. **Never deploy from a dirty working tree.**
   Run `git status` before any deploy. If it is not clean, stop and commit or discard first.
   A deploy carrying `gitDirty: "1"` means production no longer matches the repository.

2. **Commit and push before you deploy.**
   Order is always: `git add` → `git commit` → `git push` → deploy. Never the reverse,
   never a CLI deploy that skips git.

3. **Append to `WORKLOG.md` before you end a session.**
   One block per session, in the format below. If you changed nothing, write that.
   A session with changes and no worklog entry is an incomplete session.

4. **Never touch the production Supabase project without explicit written approval
   of the exact statement.**
   Project ref `unzwefrtgsgmtljlbavf`. Schema migrations, data updates and policy changes
   all require approval. Reads for diagnosis are fine.

5. **Never commit a secret.**
   No `service_role` key, Stripe key, or model API key enters this repository — not in code,
   not in a comment, not in a test fixture, not in `WORKLOG.md`.
   If you exposed one by accident, say so immediately and loudly. Do not quietly fix it.

6. **Never widen an RLS policy to `USING (true)`.**
   This codebase has already shipped a live data exposure that way. Every policy must be
   scoped to `auth.uid()` or to an explicit admin check.

7. **Do not create new files unless the task requires them.**
   Prefer editing what exists. This repository has a history of parallel half-built surfaces.

---

## Project facts

| | |
|---|---|
| Repository | `github.com/endiosut/ography-v4` (private) |
| Branch | `main` |
| Framework | Next.js 16.2.4 App Router · React 19 · TypeScript |
| Bundler | Turbopack · Node 24.x |
| Hosting | Vercel — project `prj_qX4FDHcYWM4o9xqAp4Mn5AsdM9bM`, team `team_13jt67FRZuxmI61XguOarC2s` |
| Production | `ography-v4.vercel.app` |
| Database | Supabase `unzwefrtgsgmtljlbavf` (shared with V3) |
| Auth | `@supabase/ssr` — Google OAuth, magic link, password |
| Marketing site | V3 `ography-site.vercel.app` — separate project, same database |

---

## Known traps in this codebase

These have each cost real time. Check them before you conclude anything.

- **Never construct a Supabase client at module scope.** Always inside a handler,
  `useEffect`, or a request-scoped server function. Module-scope construction has broken
  the admin page and the login page separately.
- **Middleware must return the response object that carries the rotated auth cookies.**
  Creating a fresh `NextResponse` after `createServerClient` silently discards them and
  produces `refresh_token_already_used`.
- **Nothing may be awaited between `createServerClient` and `getUser()`.**
- **The middleware matcher must exclude static assets.** Otherwise every asset request
  triggers a token refresh and concurrent requests race to consume one refresh token.
- **Auth gates must redirect, not rewrite.** A rewrite returns HTTP 200 with login content
  under the protected URL, and the edge caches it.
- **`x-vercel-cache: HIT` with a large `age` means a stale prerender.** Fix with
  `export const dynamic = 'force-dynamic'` at page level.
- **`NEXT_PUBLIC_*` env vars on Vercel** must not be marked sensitive, and must target
  Production and Preview only — never Development.
- **`42P07` from Supabase SQL** means the table already exists. Harmless. Do not re-run.
- **Supabase free tier pauses after ~one week idle**, causing 504s on Vercel Edge
  middleware. Wrap middleware Supabase calls in a timeout guard and bypass auth for
  public paths.
- **Deliverables live in the `deliverables` table**, joined on `project_id`.
  There is no `projects.deliverable_url` column. Do not read one.
- **The client identity join is `clients.user_id` → `auth.users.id`.**
  A trigger (`on_auth_user_created_link_client`) maintains it. Do not bypass it.

---

## Reporting format

Every item of work is reported in this shape, in chat and in `WORKLOG.md`:

```
ITEM        <what you were asked to fix>
ROOT CAUSE  <the actual mechanism, not the symptom>
CHANGE      <files touched and what changed>
STATUS      <in-progress | fixed-local | deployed | verified-deployed>
VERIFY      <the exact step someone else can run to confirm it>
```

**`verified-deployed` is the only acceptable terminal state.** "Should work" is not a status.

---

## Before you finish a session

- [ ] `git status` is clean
- [ ] Changes are committed with a message that says *why*, not just *what*
- [ ] Pushed to `main` (or a branch with an open PR)
- [ ] `WORKLOG.md` has a new entry with the commit SHA and deployment ID
- [ ] No secret is in the diff
- [ ] If you deployed: the deployment carries no `gitDirty` flag
