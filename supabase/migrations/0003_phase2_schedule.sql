-- Additive Phase 2 tables. Does not alter or drop Phase 1 objects.

-- Phase 2 scheduling. Additive only. Live app still stores these documents in collection_items.

create table if not exists availability_rules (
  id text primary key,
  organization_id text not null,
  user_id text not null,
  day_of_week int not null,
  availability_type text not null,
  start_time text,
  end_time text,
  effective_from date,
  effective_to date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists availability_exceptions (
  id text primary key,
  organization_id text not null,
  user_id text not null,
  date date not null,
  availability_type text not null,
  start_time text,
  end_time text,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists shift_series (
  id text primary key,
  organization_id text not null,
  title text not null,
  recurrence_type text not null,
  days_of_week jsonb,
  start_time text not null,
  end_time text not null,
  start_date date not null,
  end_date date,
  occurrence_count int,
  location_id text,
  department_id text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists shift_templates (
  id text primary key,
  organization_id text not null,
  name text not null,
  payload jsonb not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists time_off_requests (
  id text primary key,
  organization_id text not null,
  user_id text not null,
  request_type text not null,
  start_date date not null,
  end_date date not null,
  is_full_day boolean not null default true,
  start_time text,
  end_time text,
  reason text,
  notes text,
  status text not null,
  reviewed_by text,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists shift_required_qualifications (
  id text primary key,
  organization_id text not null,
  shift_id text not null,
  qualification_id text not null,
  created_at timestamptz not null default now(),
  unique (shift_id, qualification_id)
);

create table if not exists open_shift_requests (
  id text primary key,
  organization_id text not null,
  shift_id text not null,
  user_id text not null,
  status text not null,
  requested_at timestamptz not null default now(),
  reviewed_by text,
  reviewed_at timestamptz,
  review_notes text,
  unique (shift_id, user_id)
);

create table if not exists shift_trade_requests (
  id text primary key,
  organization_id text not null,
  requester_id text not null,
  requester_shift_id text not null,
  trade_type text not null,
  target_user_id text,
  target_shift_id text,
  replacement_user_id text,
  employee_response_status text,
  admin_status text not null,
  reason text,
  requested_at timestamptz not null default now(),
  employee_responded_at timestamptz,
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists schedule_overrides (
  id text primary key,
  organization_id text not null,
  shift_id text not null,
  user_id text not null,
  conflict_type text not null,
  reason text not null,
  overridden_by text not null,
  created_at timestamptz not null default now()
);

alter table availability_rules enable row level security;
alter table availability_rules force row level security;
alter table availability_exceptions enable row level security;
alter table availability_exceptions force row level security;
alter table shift_series enable row level security;
alter table shift_series force row level security;
alter table shift_templates enable row level security;
alter table shift_templates force row level security;
alter table time_off_requests enable row level security;
alter table time_off_requests force row level security;
alter table shift_required_qualifications enable row level security;
alter table shift_required_qualifications force row level security;
alter table open_shift_requests enable row level security;
alter table open_shift_requests force row level security;
alter table shift_trade_requests enable row level security;
alter table shift_trade_requests force row level security;
alter table schedule_overrides enable row level security;
alter table schedule_overrides force row level security;

drop policy if exists tenant_isolation on availability_rules;
create policy tenant_isolation on availability_rules
  for all using (organization_id = current_setting('app.organization_id', true))
  with check (organization_id = current_setting('app.organization_id', true));
drop policy if exists tenant_isolation on availability_exceptions;
create policy tenant_isolation on availability_exceptions
  for all using (organization_id = current_setting('app.organization_id', true))
  with check (organization_id = current_setting('app.organization_id', true));
drop policy if exists tenant_isolation on shift_series;
create policy tenant_isolation on shift_series
  for all using (organization_id = current_setting('app.organization_id', true))
  with check (organization_id = current_setting('app.organization_id', true));
drop policy if exists tenant_isolation on shift_templates;
create policy tenant_isolation on shift_templates
  for all using (organization_id = current_setting('app.organization_id', true))
  with check (organization_id = current_setting('app.organization_id', true));
drop policy if exists tenant_isolation on time_off_requests;
create policy tenant_isolation on time_off_requests
  for all using (organization_id = current_setting('app.organization_id', true))
  with check (organization_id = current_setting('app.organization_id', true));
drop policy if exists tenant_isolation on shift_required_qualifications;
create policy tenant_isolation on shift_required_qualifications
  for all using (organization_id = current_setting('app.organization_id', true))
  with check (organization_id = current_setting('app.organization_id', true));
drop policy if exists tenant_isolation on open_shift_requests;
create policy tenant_isolation on open_shift_requests
  for all using (organization_id = current_setting('app.organization_id', true))
  with check (organization_id = current_setting('app.organization_id', true));
drop policy if exists tenant_isolation on shift_trade_requests;
create policy tenant_isolation on shift_trade_requests
  for all using (organization_id = current_setting('app.organization_id', true))
  with check (organization_id = current_setting('app.organization_id', true));
drop policy if exists tenant_isolation on schedule_overrides;
create policy tenant_isolation on schedule_overrides
  for all using (organization_id = current_setting('app.organization_id', true))
  with check (organization_id = current_setting('app.organization_id', true));
