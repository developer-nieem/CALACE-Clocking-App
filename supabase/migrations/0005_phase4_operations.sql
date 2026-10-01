-- Additive Phase 4 tables. Does not alter or drop earlier objects.
-- The running app stores these records in collection_items. These tables
-- document the relational shape and keep organization isolation.

create table if not exists automations (
  id text primary key,
  organization_id text not null,
  name text not null,
  description text,
  trigger_type text not null,
  conditions jsonb not null default '[]',
  actions jsonb not null default '[]',
  is_enabled boolean not null default false,
  created_by text,
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists automation_runs (
  id text primary key,
  organization_id text not null,
  automation_id text not null,
  execution_key text not null,
  triggered_at timestamptz not null default now(),
  status text not null,
  input_data jsonb not null default '{}',
  result_data jsonb,
  error_message text,
  completed_at timestamptz,
  unique (execution_key)
);

create table if not exists attendance_exceptions (
  id text primary key,
  organization_id text not null,
  user_id text not null,
  shift_id text,
  time_entry_id text,
  exception_type text not null,
  severity text not null,
  message text not null,
  status text not null,
  resolved_by text,
  resolved_at timestamptz,
  resolution_notes text,
  created_at timestamptz not null default now()
);

create table if not exists shift_callouts (
  id text primary key,
  organization_id text not null,
  shift_id text not null,
  user_id text not null,
  reason_type text not null,
  notes text,
  status text not null,
  created_at timestamptz not null default now(),
  reviewed_by text,
  reviewed_at timestamptz
);

create table if not exists notification_deliveries (
  id text primary key,
  organization_id text not null,
  notification_id text not null,
  channel text not null,
  status text not null,
  provider text,
  attempt_count integer not null default 0,
  sent_at timestamptz,
  failed_at timestamptz,
  error_message text,
  created_at timestamptz not null default now()
);

create table if not exists schedule_recommendations (
  id text primary key,
  organization_id text not null,
  date_range_start date not null,
  date_range_end date not null,
  created_by text not null,
  status text not null,
  created_at timestamptz not null default now()
);

create table if not exists schedule_recommendation_items (
  id text primary key,
  organization_id text not null,
  recommendation_id text not null,
  shift_id text not null,
  recommended_user_id text not null,
  score integer not null,
  reasons jsonb not null default '[]',
  warnings jsonb not null default '[]',
  accepted_at timestamptz,
  rejected_at timestamptz
);

create table if not exists shift_confirmations (
  id text primary key,
  organization_id text not null,
  shift_id text not null,
  user_id text not null,
  status text not null,
  viewed_at timestamptz,
  confirmed_at timestamptz,
  acknowledged_at timestamptz,
  unique (shift_id, user_id)
);

alter table automations enable row level security;
alter table automation_runs enable row level security;
alter table attendance_exceptions enable row level security;
alter table shift_callouts enable row level security;
alter table notification_deliveries enable row level security;
alter table schedule_recommendations enable row level security;
alter table schedule_recommendation_items enable row level security;
alter table shift_confirmations enable row level security;

drop policy if exists admin_only on automations;
create policy admin_only on automations
  for all using (
    organization_id = current_setting('app.organization_id', true)
    and current_setting('app.role', true) in ('super_admin', 'admin')
  )
  with check (
    organization_id = current_setting('app.organization_id', true)
    and current_setting('app.role', true) in ('super_admin', 'admin')
  );

drop policy if exists admin_only on automation_runs;
create policy admin_only on automation_runs
  for all using (
    organization_id = current_setting('app.organization_id', true)
    and current_setting('app.role', true) in ('super_admin', 'admin')
  )
  with check (
    organization_id = current_setting('app.organization_id', true)
    and current_setting('app.role', true) in ('super_admin', 'admin')
  );

drop policy if exists own_or_admin on attendance_exceptions;
create policy own_or_admin on attendance_exceptions
  for all using (
    organization_id = current_setting('app.organization_id', true)
    and (
      user_id = current_setting('app.user_id', true)
      or current_setting('app.role', true) in ('super_admin', 'admin', 'scheduler')
    )
  )
  with check (organization_id = current_setting('app.organization_id', true));

drop policy if exists own_or_admin on shift_callouts;
create policy own_or_admin on shift_callouts
  for all using (
    organization_id = current_setting('app.organization_id', true)
    and (
      user_id = current_setting('app.user_id', true)
      or current_setting('app.role', true) in ('super_admin', 'admin', 'scheduler')
    )
  )
  with check (organization_id = current_setting('app.organization_id', true));

drop policy if exists admin_only on notification_deliveries;
create policy admin_only on notification_deliveries
  for all using (
    organization_id = current_setting('app.organization_id', true)
    and current_setting('app.role', true) in ('super_admin', 'admin')
  )
  with check (organization_id = current_setting('app.organization_id', true));

drop policy if exists scheduler_only on schedule_recommendations;
create policy scheduler_only on schedule_recommendations
  for all using (
    organization_id = current_setting('app.organization_id', true)
    and current_setting('app.role', true) in ('super_admin', 'admin', 'scheduler')
  )
  with check (
    organization_id = current_setting('app.organization_id', true)
    and current_setting('app.role', true) in ('super_admin', 'admin', 'scheduler')
  );

drop policy if exists scheduler_only on schedule_recommendation_items;
create policy scheduler_only on schedule_recommendation_items
  for all using (
    organization_id = current_setting('app.organization_id', true)
    and current_setting('app.role', true) in ('super_admin', 'admin', 'scheduler')
  )
  with check (
    organization_id = current_setting('app.organization_id', true)
    and current_setting('app.role', true) in ('super_admin', 'admin', 'scheduler')
  );

drop policy if exists own_or_scheduler on shift_confirmations;
create policy own_or_scheduler on shift_confirmations
  for all using (
    organization_id = current_setting('app.organization_id', true)
    and (
      user_id = current_setting('app.user_id', true)
      or current_setting('app.role', true) in ('super_admin', 'admin', 'scheduler')
    )
  )
  with check (organization_id = current_setting('app.organization_id', true));
