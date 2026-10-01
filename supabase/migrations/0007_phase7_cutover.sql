-- Phase 7: per-organization runtime, constraints, job locks, auth lookup.
-- Additive only. Does not drop JSON collection_items.

create table if not exists organization_runtime (
  organization_id text primary key references organizations (id) on delete cascade,
  version integer not null default 1,
  json_writes_enabled boolean not null default true,
  json_store_status text not null default 'dual_write'
    check (json_store_status in ('dual_write', 'read_only', 'disabled')),
  updated_at timestamptz not null default now()
);

insert into organization_runtime (organization_id, version, json_writes_enabled, json_store_status)
select id, 1, true, 'dual_write' from organizations
on conflict (organization_id) do nothing;

create table if not exists invoice_sequences (
  organization_id text not null references organizations (id) on delete cascade,
  year integer not null,
  next_number integer not null default 1,
  primary key (organization_id, year)
);

create table if not exists job_locks (
  job_name text primary key,
  locked_at timestamptz not null default now(),
  locked_by text,
  expires_at timestamptz not null
);

create table if not exists job_runs (
  id text primary key,
  job_name text not null,
  organization_id text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null,
  records_processed integer not null default 0,
  error_count integer not null default 0,
  correlation_id text,
  detail jsonb not null default '{}'::jsonb
);

create table if not exists employee_timesheets (
  id text primary key,
  organization_id text not null references organizations (id) on delete cascade,
  user_id text not null,
  pay_period_id text not null,
  status text not null,
  submitted_at timestamptz,
  approved_at timestamptz,
  approved_by text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id text primary key,
  organization_id text not null references organizations (id) on delete cascade,
  actor_id text,
  action text not null,
  entity_type text not null,
  entity_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists one_open_time_entry
  on time_entries (organization_id, user_id)
  where clock_out_at is null;

create unique index if not exists one_open_shift_claim
  on collection_items (
    organization_id,
    (payload->>'shiftId'),
    (payload->>'userId')
  )
  where collection = 'openShifts'
    and coalesce(payload->>'status', '') not in ('rejected', 'cancelled');

create unique index if not exists invoice_number_collection
  on collection_items (organization_id, (payload->>'invoiceNumber'))
  where collection = 'invoices';

create index if not exists shifts_org_date_idx on shifts (organization_id, work_date);
create index if not exists time_entries_org_user_date_idx on time_entries (organization_id, user_id, work_date);
create index if not exists time_entries_org_status_idx on time_entries (organization_id, status);
create index if not exists collection_items_org_collection_idx on collection_items (organization_id, collection);
create index if not exists audit_logs_org_created_idx on audit_logs (organization_id, created_at desc);
create index if not exists job_runs_name_started_idx on job_runs (job_name, started_at desc);

alter table employee_timesheets enable row level security;
alter table employee_timesheets force row level security;
alter table audit_logs enable row level security;
alter table audit_logs force row level security;
alter table organization_runtime enable row level security;
alter table organization_runtime force row level security;
alter table invoice_sequences enable row level security;
alter table invoice_sequences force row level security;

drop policy if exists tenant_isolation on employee_timesheets;
create policy tenant_isolation on employee_timesheets
  for all using (organization_id = current_setting('app.organization_id', true))
  with check (organization_id = current_setting('app.organization_id', true));

drop policy if exists tenant_isolation on audit_logs;
create policy tenant_isolation on audit_logs
  for all using (organization_id = current_setting('app.organization_id', true))
  with check (organization_id = current_setting('app.organization_id', true));

drop policy if exists tenant_isolation on organization_runtime;
create policy tenant_isolation on organization_runtime
  for all using (organization_id = current_setting('app.organization_id', true))
  with check (organization_id = current_setting('app.organization_id', true));

drop policy if exists tenant_isolation on invoice_sequences;
create policy tenant_isolation on invoice_sequences
  for all using (organization_id = current_setting('app.organization_id', true))
  with check (organization_id = current_setting('app.organization_id', true));

drop policy if exists profiles_auth_lookup on profiles;
create policy profiles_auth_lookup on profiles
  for select
  using (current_setting('app.auth_lookup', true) = '1');

create or replace function allocate_invoice_number(p_organization_id text, p_year integer)
returns text
language plpgsql
as $$
declare
  n integer;
begin
  insert into invoice_sequences (organization_id, year, next_number)
  values (p_organization_id, p_year, 2)
  on conflict (organization_id, year)
  do update set next_number = invoice_sequences.next_number + 1
  returning next_number - 1 into n;
  return 'INV-' || p_year::text || '-' || lpad(n::text, 4, '0');
end;
$$;

create or replace function acquire_job_lock(p_job_name text, p_locked_by text, p_ttl_seconds integer)
returns boolean
language plpgsql
as $$
begin
  delete from job_locks where job_name = p_job_name and expires_at < now();
  insert into job_locks (job_name, locked_by, expires_at)
  values (p_job_name, p_locked_by, now() + make_interval(secs => p_ttl_seconds))
  on conflict (job_name) do nothing;
  return found;
end;
$$;
