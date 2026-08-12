-- ───────────────────────────────────────────────────────────
--  OGraphy V4 — Migration 003
--  Supersedes 002_project_events.sql, which was WRITTEN AND COMMITTED
--  BUT NEVER RUN. Verified 12 Aug 2026: `project_events` does not exist
--  in the production database, and neither do the two columns 002 adds.
--
--  Three things are corrected here.
-- ───────────────────────────────────────────────────────────

-- ── 1. project_events, with RLS that is actually restrictive ───────────────
--
-- 002 wrote:   create policy "Service role full access" on project_events
--                using (true) with check (true);
--
-- A policy with `using (true)` and no role restriction applies to `public`,
-- which includes `anon`. It does not scope anything to the service role — the
-- service role bypasses RLS entirely and never needed a policy. So that policy
-- would have made an immutable audit log publicly readable and publicly
-- writable. Same defect class as the exposure closed on 12 Aug.

create table if not exists public.project_events (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid references public.projects(id) on delete cascade,
  event_type    text not null,          -- LEAD_CREATED, STAGE_CHANGED, BRIEF_SUBMITTED, PAYMENT_RECEIVED, DELIVERED
  from_stage    text,
  to_stage      text,
  triggered_by  text default 'system',  -- admin, client, system, stripe, n8n
  metadata      jsonb default '{}',
  created_at    timestamptz default now()
);

create index if not exists idx_project_events_project_id on public.project_events(project_id);
create index if not exists idx_project_events_created_at on public.project_events(created_at desc);

alter table public.project_events enable row level security;

drop policy if exists "Service role full access" on public.project_events;

-- Read: a client sees events for their own projects; an admin sees everything.
-- Write: nobody. Only the service role inserts, and it bypasses RLS.
create policy project_events_select_own on public.project_events
  for select to authenticated
  using (
    exists (
      select 1
      from public.projects p
      join public.clients c on c.id = p.client_id
      where p.id = project_events.project_id
        and c.user_id = auth.uid()
    )
    or coalesce((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin','ops'), false)
    or coalesce(auth.jwt() ->> 'email', '') = 'endiosut.eo@gmail.com'
  );

-- ── 2. deliverable_url and status are DELIBERATELY NOT ADDED ───────────────
--
-- 002 ended with:
--   alter table projects add column if not exists deliverable_url text;
--   alter table projects add column if not exists status text;
--
-- Do not run those. Reasons:
--
--   deliverable_url — a `deliverables` table already exists, keyed on
--   project_id, with `version` and `is_final`. It supports multiple files and
--   revisions; a single text column on `projects` supports one file and no
--   history. Adding the column back would create two sources of truth for the
--   same fact, and the portal has now been pointed at the table.
--
--   status — `projects.stage` already exists and is the canonical field. 002's
--   own comment says status "mirrors stage for client-facing use". A mirrored
--   column is a field that can disagree with itself. The portal now reads
--   `stage` and normalises the vocabulary in one place.
--
-- If either column is ever added, src/lib/modules/workflow.ts:87 must be
-- revisited — it currently writes `deliverable_url` into an update payload for
-- a column that does not exist.

-- ── 3. Close the remaining SECURITY DEFINER exposure ───────────────────────
-- Both functions are callable unauthenticated via /rest/v1/rpc/.
revoke execute on function public.notify_new_lead()  from anon, authenticated;
revoke execute on function public.rls_auto_enable()  from anon, authenticated;

-- Pin search_path on the trigger helpers (advisor: function_search_path_mutable)
alter function public.update_updated_at() set search_path = public;
alter function public.set_project_ref()  set search_path = public;
alter function public.notify_new_lead()  set search_path = public;

-- ───────────────────────────────────────────────────────────
--  NOT INCLUDED HERE — still gated on the /admin payment-links check:
--  the SELECT lockdown on clients / projects / payments / briefs /
--  deliverables. See Engineer Handoff Rev 3 §6.
-- ───────────────────────────────────────────────────────────
