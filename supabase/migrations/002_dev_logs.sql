-- Dev logging table — only populated when DEV_LOGGING_ENABLED=true in Edge Functions
-- Safe to leave in production schema; no data written unless flag is on
create table if not exists dev_logs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid,
  kid_id uuid references kids(id) on delete cascade,
  role text check (role in ('user', 'assistant')),
  content text,
  drift_score integer,
  created_at timestamptz default now()
);

-- Only the service role can write (Edge Functions use service role key)
-- No RLS needed — this table is never exposed to the client
alter table dev_logs enable row level security;
create policy "No client access" on dev_logs for all using (false);
