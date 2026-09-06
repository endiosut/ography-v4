# WORKLOG — OGraphy V4

Append-only. Newest entry at the top. One block per working session, human or agent.
Never edit or delete a previous entry — if you were wrong, add a correction below.

Format is defined in `AGENTS.md`. Every entry needs a commit SHA and, if deployed,
a deployment ID and a dirty-tree declaration.

---

## 2026-09-06 · Claude Opus 5 · Homepage intro + the missing checkout rail

```
ITEM        1) Replace the homepage intro copy with three outcome phrases.
            2) "Checkout still cannot take money" — find out why and fix it.
            3) Identify the 8 stalled runs.

ROOT CAUSE  (1) Cosmetic. The two prose lines said something the page never
            repeated; the triad below them ("01 / Build Trust" …) already was
            the message.

            (2) There was NO code path in the repository that created a Stripe
            Checkout Session. `stripe` was in package.json but imported by zero
            files. STRIPE_SECRET_KEY appeared in zero files. Every button in the
            cart footer — including "Pay Upfront — Full Amount" — called
            handleRequestAll(), which does
            `window.location.href = '/contact?services=…'`. The webhook at
            /api/stripe/webhook was waiting for an event nothing could produce.
            Compounding it: the cart's two Stripe branches were gated on
            `item.stripe_link`, and catalog_items HAS NO stripe_link column, so
            `hasStripe`/`allHaveStripe` were permanently false and the cart
            always fell through to the "Request These Services" branch.

            (3) The 8 stalled runs are the 8 rows in `payments`. All 8:
            status='pending', amount_usd IS NULL, stripe_session_id IS NULL,
            paid_at IS NULL, created 27 Jul – 13 Aug. 8 payment_links exist to
            match. They cannot be collected (no amount) or reconciled (no
            session). Also measured: payment_methods has ZERO rows, so
            /portal/pay renders no way to pay even when reached; projects
            total_amount_usd is NULL on all 21.

CHANGE      src/app/page.tsx          intro -> Build Trust / Capture Attention /
                                      Scale Presence, resolving on "Market
                                      authority."; stacked reveal, 4.45s;
                                      prefers-reduced-motion; timer chain
                                      rewritten (nested setTimeout leaked).
            src/lib/pricing.ts        NEW. The pricing matrix: 6 fixed,
                                      9 "From $X" (floor, not total), 2 /mo
                                      retainers. Mixed carts refused.
            src/app/api/checkout/     NEW. Server-priced Stripe Checkout
              route.ts                Session; reuses handleLead + the
                                      agreements_recalc trigger for the amount.
            api/stripe/webhook/       Signature verification (was JSON.parse of
              route.ts                an unauthenticated public POST — a
                                      forgeable sale on a public repo);
                                      accepts the agreement instead of
                                      double-creating client+project;
                                      idempotent on stripe_session_id.
            src/context/CartContext   Real checkout wired to /api/checkout;
              .tsx                    dead stripe_link branches removed;
                                      auto-close timer moved state -> ref.
            supabase/migrations/      NOT APPLIED. Schema proposal + the
              008_payment_rails.sql   payment_methods blocker.

STATUS      verified-deployed (code). Stripe is NOT yet switched on — see below.

VERIFY      Intro, against the SHIPPED BUNDLE not the source:
              curl -s https://ography-v4.vercel.app/ -o live.html
              grep -o '"/_next/static/chunks/[^"]*\.js"' live.html | tr -d '"' | sort -u
              # fetch each; chunk 0-~jck.d63u.6.js contains "Market authority" (1)
              # and "Every great brand" (0).
            NOTE: grepping the page HTML for "Build Trust" proves nothing — that
            string is also in the Outcomes section, and the intro overlay is
            gated on useEffect so it is absent from SSR output entirely.

            Checkout route is live and the matrix works (writes nothing):
              curl -X POST .../api/checkout -d '{"name":"x","email":"a@b.co","items":[]}'
                -> 400 "Your cart is empty."
              curl -X POST .../api/checkout with the $1,200/mo retainer AND the
                $65 card set -> 409 "Monthly retainers and one-time projects
                have to be checked out separately…"

            Webhook now rejects forgery:
              POST /api/stripe/webhook with a hand-written
              checkout.session.completed body and no signature
                -> 500 "Webhook not configured"  (fails CLOSED)
              Row counts before and after all probes: payments 8, clients 17,
              projects 21, agreements 2 — unchanged. Nothing was written.

OPEN        Stripe env vars are NOT set. The webhook probe returns "Webhook not
            configured", which means STRIPE_SECRET_KEY and/or
            STRIPE_WEBHOOK_SECRET are absent on Vercel. Until both are set,
            /api/checkout returns 503 and the cart falls back to the quote flow.
            payment_methods still has 0 rows — the manual rail is still a dead
            end regardless of Stripe.

COMMIT      2fc348d05ba26b92f8fbafe86f0fba1f80565ece
DEPLOY      dpl_BGzbWHgKQHP1LEhT31uC2MLVJ1fS
DIRTY TREE  no
```

---

## 2026-08-14 · Antigravity · Homepage & Catalog sync from latest production capture

```
ITEM        Catalog empty read fix + Homepage sync from endi new capture
ROOT CAUSE  (1) /catalog fetch query requested non-existent columns (price, price_display,
            turnaround_time, stripe_link) causing Supabase HTTP 400 error.
            (2) Production copy and hooks on homepage needed updating to match the
            August 2026 deployed spec.
CHANGE      - src/app/catalog/page.tsx: updated query to select=*&order=sort_order,
              normalized base_price_usd/price_note/turnaround, added fallback catalog data.
            - src/app/page.tsx: integrated story intro typewriter experience, new hero
              headline/copy, "Outcomes Over Services" section, and fixed featured services.
            - .env.local created with Supabase keys for local runs.
            - OGRAPHY_V4_ENGINEER_HANDOFF.md updated with latest Vercel deployment URL.
STATUS      verified-local
VERIFY      npm run build passed cleanly (all 16 routes). Dev server tested on localhost:3000.
COMMIT      pending
DIRTY TREE  no
```

---

## 2026-08-13 · Claude (Cowork) · DEPLOYED — partial win, partial regression

```
ITEM        Merge to main; production deploy
ROOT CAUSE  n/a
CHANGE      recover/reconcile-2026-08-12 merged to main; Vercel built production
            from git for the first time since 29 May. No gitDirty flag.
STATUS      verified-deployed
VERIFY      curl -I /portal -> HTTP 307, Location: /login?next=%2Fportal
            (was: HTTP 200, x-matched-path /login, x-vercel-cache HIT, age 743573)
            Human test: signed in as endidgrace@gmail.com (non-admin, Google).
            Portal renders content. Homepage reachable from on-screen controls.
            Sign-out works. THE TEN-WEEK BUG IS CLOSED.
COMMIT      59d417d
DIRTY TREE  no
```

```
ITEM        REGRESSION — homepage, catalog, admin, AI Studio reverted to 29 May
ROOT CAUSE  MY ERROR, and I should have caught it.
            I claimed "the entire ten-week loss is one file, 124 lines". That was
            measured by diffing git HEAD against 03-Source. NEITHER OF THOSE WAS
            PRODUCTION. The 2 Aug production build contained work that existed in
            git NO, in 03-Source NO, and on disk NOWHERE.
            The evidence was in front of me: production's build id
            fXuUIdGykyjVCB9ugpbth matched nothing on any disk we searched. I
            recorded that as "the repo isn't here". What it actually meant is
            stronger — production was running code I could not inspect anywhere.
            I then measured the gap between the two artifacts I COULD inspect and
            called that the loss.
            Deploying from git therefore reverted every page whose only copy was
            in that vanished build.
CHANGE      none yet
STATUS      open — P1
VERIFY      Lost surfaces confirmed by Endi on 13 Aug:
              - homepage: hooks, feature presentation outdated
              - footer: privacy + terms links GONE
              - cookie consent: GONE
              - /catalog: renders nothing again (17 items, 16 active, SELECT
                policy permits anon — so this is the 29 May read-path bug back)
              - AI Studio: VISIBLE again; was deliberately hidden as
                "coming soon" after user feedback confirmed redundancy
              - admin payments: QR upload placeholder GONE
              - brief form step 3: was reading live catalog_items, back to static
              - AI Studio API: key was migrated HuggingFace -> DeepSeek and
                working; now "Failed to generate. Check your API key"
COMMIT      n/a
DIRTY TREE  n/a
```

```
ITEM        Is the lost work recoverable?
ROOT CAUSE  n/a
CHANGE      none
STATUS      open
VERIFY      Deployment dpl_5A1VcffPteqvqC3s9JCrBXP9nLe1 (2 Aug, the old
            production build) still exists in Vercel and is still servable at
            ography-v4-7pvel4ydt-endi-osuts-projects.vercel.app.
            Source is not downloadable, but the RENDERED HTML is — and for
            presentational surfaces (homepage copy, hooks, footer, consent
            banner) rendered HTML is a sufficient spec to rebuild from.
            The URL is behind Vercel deployment protection; Endi can open it
            while signed in to Vercel. Claude cannot fetch it.
            DO NOT DELETE THAT DEPLOYMENT.
COMMIT      n/a
DIRTY TREE  n/a
```

---

## 2026-08-12 · Claude (Cowork) · git recovery — steps 2-4

```
ITEM        Reconcile the surviving working copy into a fresh clone
ROOT CAUSE  n/a — recovery
CHANGE      Cloned ography-v4 (Endi), branched recover/reconcile-2026-08-12,
            copied 03-Source/src over the clone additively (no deletions).
STATUS      verified-local — NOT committed, NOT pushed. Step 5 is Endi's.
VERIFY      npm install (378 pkgs) -> npx tsc --noEmit -> silent
            npx next build -> Compiled successfully in 13.8s
            Route table: f /portal  f /admin (+children)  f /login
                         f /portal/ai-studio
            Previously all o (Static) — the stale-prerender condition.
COMMIT      branched from a576a4e; nothing committed yet
DIRTY TREE  yes, intentionally — awaiting Endi's review before commit
```

```
ITEM        How much work was actually lost to the untracked deploys?
ROOT CAUSE  n/a — measurement
CHANGE      none
STATUS      answered
VERIFY      Diffed repo HEAD against 03-Source as it stood BEFORE today's edits:
              src/middleware.ts          124 lines of genuine untracked work
              src/app/portal/page.tsx      0 lines — identical to HEAD
              src/app/login/page.tsx       0 lines — identical to HEAD
            package.json dependency delta: identical.
            Every other "differing" file was CRLF/LF line endings only.
            THE ENTIRE TEN-WEEK LOSS IS ONE FILE, 124 LINES, NOW RECOVERED.
COMMIT      n/a
DIRTY TREE  n/a
```

```
ITEM        supabase/migrations/002_project_events.sql was never run
ROOT CAUSE  002 is committed to main and carries the instruction "Run this in
            Supabase SQL Editor (Dashboard -> SQL Editor)". It was written,
            committed, and never executed. Confirmed against the live database:
            `project_events` does not exist, and neither do the two columns 002
            adds (projects.deliverable_url, projects.status).
            CONSEQUENCE 1: src/lib/modules/workflow.ts:40 inserts into
            project_events inside a try/catch commented "table may not exist
            yet - never block the main flow". Every state change since launch
            has been silently discarded. There is no audit trail.
            CONSEQUENCE 2: workflow.ts:87 writes deliverable_url to a column
            that does not exist.
            CONSEQUENCE 3: the portal reading project.deliverable_url was NOT a
            coding error. It was written against a schema 002 was supposed to
            create. The code was correct for a database that never happened.
            CONSEQUENCE 4: 002 contains
              create policy "Service role full access" ... using (true)
            i.e. the same defect class as the exposure closed today, written
            into a committed migration. The habit is documented, not accidental.
CHANGE      Wrote supabase/migrations/003_project_events_corrected.sql —
            creates project_events with restrictive RLS, deliberately does NOT
            add deliverable_url/status, revokes anon EXECUTE on the two
            SECURITY DEFINER functions, pins search_path on trigger helpers.
STATUS      written, NOT applied — needs review before running
VERIFY      after running: select count(*) from public.project_events; -> 0
                           and get_advisors(security) drops the RPC warnings
COMMIT      n/a
DIRTY TREE  n/a
```

```
ITEM        AGENTS.md and CLAUDE.md were never actually written
ROOT CAUSE  Both exist at repo root, which reads as "discipline files present,
            not honoured". They are not. AGENTS.md is 5 lines of tool-generated
            boilerplate wrapped in <!-- BEGIN:nextjs-agent-rules --> saying only
            "this is not the Next.js you know, read the docs". CLAUDE.md is one
            line: `@AGENTS.md`. Neither contains a single project-specific rule.
            No commit discipline, no deploy rule, no worklog requirement.
            The files were not ignored. There was nothing in them to ignore.
CHANGE      none yet — 05-Scripts/AGENTS.md holds the real rules and must
            replace the stub, preserving the nextjs-agent-rules block.
STATUS      open
VERIFY      repo AGENTS.md > 100 lines and contains the deploy rules
COMMIT      n/a
DIRTY TREE  n/a
```

```
ITEM        Agent debris committed to main
ROOT CAUSE  An agent wrote output using an absolute sandbox path. The result was
            committed as a nested directory:
              src/app/admin/catalog/mnt/user-data/outputs/ography-v4/src/app/...
            containing three .tsx files. Because they sit under src/app/, Next
            treats them as routes.
CHANGE      none — the mounted filesystem denied the delete
STATUS      open — one command for Endi
VERIFY      git rm -r "src/app/admin/catalog/mnt" && npx next build
COMMIT      n/a
DIRTY TREE  n/a
```

---

## 2026-08-12 · Claude (Cowork) · build verification of the code fixes

```
ITEM        Verify the 12 Aug code fixes actually compile and behave
ROOT CAUSE  n/a — verification pass
CHANGE      Copied 03-Source to an isolated sandbox, npm install (378 pkgs),
            npx tsc --noEmit, npx next build.
            Fixed 2 real type errors found: portal purchases tab still read
            `p.name` and `p.service`, neither of which exists on `projects`.
STATUS      verified-local  (NOT deployed — see blocker below)
VERIFY      npx tsc --noEmit  -> clean
            npx next build    -> Compiled successfully
COMMIT      n/a — 03-Source is not a git repository
DIRTY TREE  n/a
```

```
ITEM        force-dynamic was silently doing nothing
ROOT CAUSE  `export const dynamic = 'force-dynamic'` was placed inside
            portal/page.tsx, admin/page.tsx and login/page.tsx — all of which
            are 'use client' components. Next.js IGNORES route segment config in
            Client Components. The first build still reported these routes as
            ○ (Static), i.e. the exact condition that let production serve
            /portal, /admin and /login from a 7.7-day-old edge-cached prerender.
            This would have shipped looking correct and fixed nothing.
CHANGE      Added pass-through Server Component layouts carrying the config:
              src/app/portal/layout.tsx
              src/app/admin/layout.tsx
              src/app/login/layout.tsx
            each exporting `dynamic = 'force-dynamic'` and `revalidate = 0`.
            Removed the inert exports from the client pages, replaced with a
            pointer comment so nobody re-adds them.
STATUS      verified-local
VERIFY      next build route table now reports:
              ƒ /portal   ƒ /admin (+ all children)   ƒ /login
              ƒ /portal/ai-studio
            Previously all ○ (Static).
COMMIT      n/a — 03-Source is not a git repository
DIRTY TREE  n/a
```

```
ITEM        BUILD_ID hunt — production tree still NOT located
ROOT CAUSE  n/a
CHANGE      none
STATUS      open — BLOCKER
VERIFY      Reported result was
              C:\Users\Endi Osut\tradelynk-v2\.next\BUILD_ID -> -4KtxXqhFeH9hmQyr6x2g
            That is the TradeLynk project, and the id does NOT match.
            OGraphy production build id is fXuUIdGykyjVCB9ugpbth.
            The ography-v4 git repository has not been found yet. Nothing can be
            deployed until it is.
COMMIT      n/a
DIRTY TREE  n/a
```

---

## 2026-08-12 · Claude (Cowork) · database hotfix

```
ITEM        Anonymous write access to all client-owned tables
ROOT CAUSE  Every RLS policy on clients, projects, payments, briefs, deliverables,
            catalog_items and brief_files was USING (true) for the `public` role,
            covering SELECT/UPDATE/DELETE. The anon key is published in the site's
            client JS, so any visitor could read, alter or destroy all client data.
CHANGE      Migration `hotfix_revoke_public_write_policies` — dropped all
            unconditional INSERT/UPDATE/DELETE policies on those tables.
            Migration `hotfix_close_brief_files_writes` — same for brief_files.
            SELECT policies deliberately left untouched so no read path broke.
            Preserved one intentional public write: briefs_insert_public (+ brief_files
            insert) so anonymous brief submission still works.
STATUS      verified-deployed
VERIFY      select count(*) from pg_policies where schemaname='public'
              and cmd in ('INSERT','UPDATE','DELETE','ALL')
              and roles::text like '%public%'
              and coalesce(qual,'true')='true'
              and coalesce(with_check,'true')='true';
            → returns 1 (brief_files_insert, intentional)
COMMIT      n/a — database migration, not repository code
DIRTY TREE  n/a
```

```
ITEM        Client portal empty for every user who has ever logged in
ROOT CAUSE  clients.user_id was NULL on all 10 rows while 7 accounts existed in
            auth.users. Nothing linked a signup to a client record, so the portal's
            `clients where user_id = auth.uid()` lookup returned zero rows for
            everyone. No client -> no projects -> blank page.
CHANGE      Migration `link_auth_users_to_clients` —
            (1) backfilled clients.user_id by case-insensitive email match
            (2) added security-definer function public.link_client_on_signup() and
                trigger on_auth_user_created_link_client on auth.users, which claims
                an existing client row by email or creates one
            (3) backfilled client rows for auth users that had none
STATUS      verified-deployed
VERIFY      select count(*) from auth.users u where not exists
              (select 1 from public.clients c where c.user_id = u.id);
            → returns 0 (was 4)
COMMIT      n/a — database migration, not repository code
DIRTY TREE  n/a
```

```
ITEM        Open findings handed to engineer, not fixed in this session
ROOT CAUSE  n/a — recorded so they are not lost
CHANGE      none
STATUS      open
VERIFY      see Engineer Handoff Rev 2, sections 5-9:
            D3  RLS SELECT still USING (true) — read exposure remains (P0)
            D4  middleware refresh_token_already_used — login loop (P1)
            D5  gated routes serve 7.7-day edge-cached login shell (P1)
            D6  portal has no navigation — testers could not leave the page (P1)
            D7  window.location.href races the cookie write after sign-in (P1)
            D8  x-og-client-state header written by middleware, read by nobody (P2)
            D9  portal reads project.deliverable_url; files live in `deliverables` (P2)
            D10 portal shows no payment status, deadline or project_ref (P2)
            D11 catalog renders 0 services though 16 of 17 rows are active (P2)
            D12 cart funnel: 12 carts, 0 cart_items, 0 checkout_sessions (P3)
            D13 production deployed from an uncommitted tree since 2026-05-29 (BLOCKER)
COMMIT      n/a
DIRTY TREE  n/a
```

---

## 2026-05-29 → 2026-08-02 · Codex / Claude Code in VS Code · UNRECORDED

```
ITEM        Unknown — approximately ten weeks of production changes
ROOT CAUSE  Four production deploys were made via Vercel CLI from a working tree with
            uncommitted changes, all recording the stale SHA a576a4e3. No agent had a
            standing instruction to commit before deploying or to record its work.
            This file, and AGENTS.md, exist to prevent recurrence.
CHANGE      Unknown. The working tree is at
            C:\Users\Endi Osut\Downloads\Ventures\01-Ography\03-Source\
            and must be reconciled into git before any further work.
STATUS      open — BLOCKER
VERIFY      `git status` in the source directory; capture the full diff; commit or
            discard; push to main; redeploy from git; confirm the new deployment
            carries no gitDirty flag and a current SHA.
COMMIT      last trustworthy: a576a4e3a455422e31aff20ddcf2df42167e70bd (2026-05-29 10:20 UTC)
DIRTY TREE  YES — on all four deploys after that commit
```

---

<!--
Template — copy this block, fill it, place it at the TOP of the file.

## YYYY-MM-DD · <who> · <short session label>

```
ITEM
ROOT CAUSE
CHANGE
STATUS      in-progress | fixed-local | deployed | verified-deployed
VERIFY
COMMIT      <sha>
DEPLOY      <vercel deployment id>
DIRTY TREE  no
```
-->
