-- ───────────────────────────────────────────────────────────
--  OGraphy V4 — Migration 002: Project Events
--  Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- ───────────────────────────────────────────────────────────

-- Event log: every state change is immutable and queryable
create table if not exists project_events (
  id            uuid default gen_random_uuid() primary key,
  project_id    uuid references projects(id) on delete cascade,
  event_type    text not null,       -- LEAD_CREATED, STAGE_CHANGED, BRIEF_SUBMITTED, PAYMENT_RECEIVED, DELIVERED
  from_stage    text,
  to_stage      text,
  triggered_by  text default 'system', -- admin, client, system, stripe, n8n
  metadata      jsonb default '{}',
  created_at    timestamptz default now()
);

-- Fast lookups by project
create index if not exists idx_project_events_project_id on project_events(project_id);
create index if not exists idx_project_events_created_at on project_events(created_at desc);

-- RLS: only service role can insert; admin can read all
alter table project_events enable row level security;

create policy "Service role full access" on project_events
  using (true)
  with check (true);

-- Optional: add deliverable_url to projects if not present
alter table projects add column if not exists deliverable_url text;
alter table projects add column if not exists status text;  -- mirrors stage for client-facing use

-- ───────────────────────────────────────────────────────────
--  n8n webhook config (copy to your n8n credential):
--
--  Inbound webhook URL: https://your-domain.vercel.app/api/events
--  Header: x-webhook-secret: <set WEBHOOK_SECRET in Vercel env>
--
--  Event payload schema:
--  {
--    "projectId": "uuid",
--    "event": "STAGE_CHANGED",
--    "stage": "in_production",    <-- target stage
--    "notes": "optional note",
--    "deliverableUrl": "optional url",
--    "triggeredBy": "n8n"
--  }
-- ───────────────────────────────────────────────────────────
