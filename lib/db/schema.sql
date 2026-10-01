-- CAL ACE Team schema for Neon PostgreSQL.
-- Applied automatically on the first server request, or with npm run db:setup.
-- Identifiers are text so seeded records and generated UUIDs can share one key space.
-- Money uses numeric. Timestamps are timestamptz (UTC).

create table if not exists organizations (
  id text primary key,
  name text not null,
  timezone text not null default 'America/Los_Angeles',
  currency_code text not null default 'USD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists workforce_meta (
  id integer primary key,
  version integer not null,
  updated_at timestamptz not null default now()
);

create table if not exists profiles (
  id text primary key,
  organization_id text not null references organizations (id) on delete cascade,
  email text not null,
  password_hash text not null,
  employee_type text not null check (employee_type in ('instructor', 'staff')),
  role text not null,
  pay_type text not null check (pay_type in ('hourly', 'salary')),
  hourly_rate numeric(10, 2),
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, email)
);

create table if not exists sessions (
  token_hash text primary key,
  user_id text not null references profiles (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists locations (
  id text primary key,
  organization_id text not null references organizations (id) on delete cascade,
  name text not null,
  address text,
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  geofence_radius_meters integer not null default 200,
  geolocation_required boolean not null default false,
  status text not null default 'active'
);

create table if not exists departments (
  id text primary key,
  organization_id text not null references organizations (id) on delete cascade,
  name text not null
);

create table if not exists positions (
  id text primary key,
  organization_id text not null references organizations (id) on delete cascade,
  name text not null
);

create table if not exists qualifications (
  id text primary key,
  organization_id text not null references organizations (id) on delete cascade,
  name text not null,
  slug text not null,
  unique (organization_id, slug)
);

create table if not exists organization_settings (
  organization_id text primary key references organizations (id) on delete cascade,
  currency_code text not null,
  timezone text not null,
  settings jsonb not null
);

create table if not exists shifts (
  id text primary key,
  organization_id text not null references organizations (id) on delete cascade,
  work_date date not null,
  payload jsonb not null
);

create table if not exists collection_items (
  organization_id text not null references organizations (id) on delete cascade,
  collection text not null,
  id text not null,
  payload jsonb not null,
  primary key (organization_id, collection, id)
);

create table if not exists time_entries (
  id text primary key,
  organization_id text not null references organizations (id) on delete cascade,
  user_id text not null references profiles (id) on delete cascade,
  shift_id text,
  work_date date not null,
  clock_in_at timestamptz not null,
  clock_out_at timestamptz,
  clock_in_latitude numeric(9, 6),
  clock_in_longitude numeric(9, 6),
  clock_in_accuracy numeric(12, 2),
  clock_out_latitude numeric(9, 6),
  clock_out_longitude numeric(9, 6),
  clock_out_accuracy numeric(12, 2),
  clock_in_location_id text,
  clock_out_location_id text,
  clock_in_distance_meters numeric(12, 2),
  clock_out_distance_meters numeric(12, 2),
  clock_in_geofence_status text,
  clock_out_geofence_status text,
  status text not null,
  clock_status text,
  pay_rate_snapshot numeric(10, 2),
  notes text,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists time_breaks (
  id text primary key,
  organization_id text not null references organizations (id) on delete cascade,
  time_entry_id text not null references time_entries (id) on delete cascade,
  user_id text not null references profiles (id) on delete cascade,
  break_start_at timestamptz not null,
  break_end_at timestamptz,
  break_start_latitude numeric(9, 6),
  break_start_longitude numeric(9, 6),
  break_start_accuracy numeric(12, 2),
  break_end_latitude numeric(9, 6),
  break_end_longitude numeric(9, 6),
  break_end_accuracy numeric(12, 2),
  break_minutes integer,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists time_entry_edits (
  id text primary key,
  organization_id text not null references organizations (id) on delete cascade,
  time_entry_id text not null references time_entries (id) on delete cascade,
  changed_by text not null,
  field_name text not null,
  old_value text,
  new_value text,
  reason text not null,
  created_at timestamptz not null
);

create table if not exists employee_pay_rates (
  id text primary key,
  organization_id text not null references organizations (id) on delete cascade,
  user_id text not null references profiles (id) on delete cascade,
  hourly_rate numeric(10, 2) not null,
  effective_from date not null,
  effective_to date,
  created_by text,
  created_at timestamptz not null
);

create index if not exists time_entries_user_date_idx
  on time_entries (organization_id, user_id, work_date);

create index if not exists time_breaks_entry_idx
  on time_breaks (time_entry_id);

create index if not exists sessions_user_idx
  on sessions (user_id);

-- Tenant isolation. The Neon role owns these tables, so row security is forced.
alter table profiles enable row level security;
alter table profiles force row level security;
alter table locations enable row level security;
alter table locations force row level security;
alter table departments enable row level security;
alter table departments force row level security;
alter table positions enable row level security;
alter table positions force row level security;
alter table qualifications enable row level security;
alter table qualifications force row level security;
alter table organization_settings enable row level security;
alter table organization_settings force row level security;
alter table shifts enable row level security;
alter table shifts force row level security;
alter table collection_items enable row level security;
alter table collection_items force row level security;
alter table time_entries enable row level security;
alter table time_entries force row level security;
alter table time_breaks enable row level security;
alter table time_breaks force row level security;
alter table time_entry_edits enable row level security;
alter table time_entry_edits force row level security;
alter table employee_pay_rates enable row level security;
alter table employee_pay_rates force row level security;

drop policy if exists tenant_isolation on profiles;
create policy tenant_isolation on profiles
  for all using (organization_id = current_setting('app.organization_id', true))
  with check (organization_id = current_setting('app.organization_id', true));

drop policy if exists tenant_isolation on locations;
create policy tenant_isolation on locations
  for all using (organization_id = current_setting('app.organization_id', true))
  with check (organization_id = current_setting('app.organization_id', true));

drop policy if exists tenant_isolation on departments;
create policy tenant_isolation on departments
  for all using (organization_id = current_setting('app.organization_id', true))
  with check (organization_id = current_setting('app.organization_id', true));

drop policy if exists tenant_isolation on positions;
create policy tenant_isolation on positions
  for all using (organization_id = current_setting('app.organization_id', true))
  with check (organization_id = current_setting('app.organization_id', true));

drop policy if exists tenant_isolation on qualifications;
create policy tenant_isolation on qualifications
  for all using (organization_id = current_setting('app.organization_id', true))
  with check (organization_id = current_setting('app.organization_id', true));

drop policy if exists tenant_isolation on organization_settings;
create policy tenant_isolation on organization_settings
  for all using (organization_id = current_setting('app.organization_id', true))
  with check (organization_id = current_setting('app.organization_id', true));

drop policy if exists tenant_isolation on shifts;
create policy tenant_isolation on shifts
  for all using (organization_id = current_setting('app.organization_id', true))
  with check (organization_id = current_setting('app.organization_id', true));

drop policy if exists tenant_isolation on collection_items;
create policy tenant_isolation on collection_items
  for all using (organization_id = current_setting('app.organization_id', true))
  with check (organization_id = current_setting('app.organization_id', true));

drop policy if exists tenant_isolation on time_entries;
create policy tenant_isolation on time_entries
  for all using (organization_id = current_setting('app.organization_id', true))
  with check (organization_id = current_setting('app.organization_id', true));

drop policy if exists tenant_isolation on time_breaks;
create policy tenant_isolation on time_breaks
  for all using (organization_id = current_setting('app.organization_id', true))
  with check (organization_id = current_setting('app.organization_id', true));

drop policy if exists tenant_isolation on time_entry_edits;
create policy tenant_isolation on time_entry_edits
  for all using (organization_id = current_setting('app.organization_id', true))
  with check (organization_id = current_setting('app.organization_id', true));

drop policy if exists tenant_isolation on employee_pay_rates;
create policy tenant_isolation on employee_pay_rates
  for all using (organization_id = current_setting('app.organization_id', true))
  with check (organization_id = current_setting('app.organization_id', true));

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

-- Additive Phase 3 tables. Does not alter or drop Phase 1 or Phase 2 objects.

create table if not exists task_assignments (
  id text primary key,
  organization_id text not null,
  task_id text not null,
  user_id text not null,
  assignment_status text not null,
  assigned_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (task_id, user_id)
);

create table if not exists task_checklist_items (
  id text primary key,
  organization_id text not null,
  task_id text not null,
  title text not null,
  sort_order integer not null default 0,
  is_required boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists task_checklist_completions (
  id text primary key,
  organization_id text not null,
  task_id text not null,
  checklist_item_id text not null,
  user_id text not null,
  completed_at timestamptz not null default now()
);

create table if not exists task_comments (
  id text primary key,
  organization_id text not null,
  task_id text not null,
  user_id text not null,
  comment text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists chat_rooms (
  id text primary key,
  organization_id text not null,
  type text not null,
  name text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists chat_room_members (
  id text primary key,
  organization_id text not null,
  room_id text not null,
  user_id text not null,
  role text not null default 'member',
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  unique (room_id, user_id)
);

create table if not exists chat_messages (
  id text primary key,
  organization_id text not null,
  room_id text not null,
  sender_id text not null,
  message text not null,
  reply_to_message_id text,
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists calendar_connections (
  id text primary key,
  organization_id text not null,
  user_id text not null,
  provider text not null,
  provider_account_email text,
  access_token_encrypted text,
  refresh_token_encrypted text,
  expires_at timestamptz,
  calendar_id text,
  sync_enabled boolean not null default false,
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists calendar_event_mappings (
  id text primary key,
  organization_id text not null,
  connection_id text not null,
  shift_id text not null,
  external_event_id text not null,
  provider text not null,
  last_synced_at timestamptz
);

create table if not exists employee_documents (
  id text primary key,
  organization_id text not null,
  user_id text not null,
  document_type text not null,
  title text not null,
  file_path text,
  file_name text not null,
  mime_type text,
  file_size integer,
  issued_date date,
  expiration_date date,
  notes text,
  uploaded_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists notification_preferences (
  id text primary key,
  organization_id text not null,
  user_id text not null,
  category text not null,
  in_app boolean not null default true,
  email boolean not null default false,
  unique (organization_id, user_id, category)
);

alter table task_assignments enable row level security;
alter table task_assignments force row level security;
alter table task_checklist_items enable row level security;
alter table task_checklist_items force row level security;
alter table task_checklist_completions enable row level security;
alter table task_checklist_completions force row level security;
alter table task_comments enable row level security;
alter table task_comments force row level security;
alter table chat_rooms enable row level security;
alter table chat_rooms force row level security;
alter table chat_room_members enable row level security;
alter table chat_room_members force row level security;
alter table chat_messages enable row level security;
alter table chat_messages force row level security;
alter table calendar_connections enable row level security;
alter table calendar_connections force row level security;
alter table calendar_event_mappings enable row level security;
alter table calendar_event_mappings force row level security;
alter table employee_documents enable row level security;
alter table employee_documents force row level security;
alter table notification_preferences enable row level security;
alter table notification_preferences force row level security;

drop policy if exists tenant_isolation on task_assignments;
create policy tenant_isolation on task_assignments
  for all using (organization_id = current_setting('app.organization_id', true))
  with check (organization_id = current_setting('app.organization_id', true));
drop policy if exists tenant_isolation on task_checklist_items;
create policy tenant_isolation on task_checklist_items
  for all using (organization_id = current_setting('app.organization_id', true))
  with check (organization_id = current_setting('app.organization_id', true));
drop policy if exists tenant_isolation on task_checklist_completions;
create policy tenant_isolation on task_checklist_completions
  for all using (organization_id = current_setting('app.organization_id', true))
  with check (organization_id = current_setting('app.organization_id', true));
drop policy if exists tenant_isolation on task_comments;
create policy tenant_isolation on task_comments
  for all using (organization_id = current_setting('app.organization_id', true))
  with check (organization_id = current_setting('app.organization_id', true));
drop policy if exists tenant_isolation on chat_rooms;
create policy tenant_isolation on chat_rooms
  for all using (organization_id = current_setting('app.organization_id', true))
  with check (organization_id = current_setting('app.organization_id', true));
drop policy if exists tenant_isolation on chat_room_members;
create policy tenant_isolation on chat_room_members
  for all using (organization_id = current_setting('app.organization_id', true))
  with check (organization_id = current_setting('app.organization_id', true));
drop policy if exists member_only on chat_messages;
create policy member_only on chat_messages
  for all using (
    organization_id = current_setting('app.organization_id', true)
    and exists (
      select 1 from chat_room_members member
      where member.room_id = chat_messages.room_id
        and member.user_id = current_setting('app.user_id', true)
    )
  )
  with check (
    organization_id = current_setting('app.organization_id', true)
    and sender_id = current_setting('app.user_id', true)
    and exists (
      select 1 from chat_room_members member
      where member.room_id = chat_messages.room_id
        and member.user_id = current_setting('app.user_id', true)
    )
  );
drop policy if exists tenant_isolation on calendar_connections;
create policy tenant_isolation on calendar_connections
  for all using (organization_id = current_setting('app.organization_id', true))
  with check (organization_id = current_setting('app.organization_id', true));
drop policy if exists tenant_isolation on calendar_event_mappings;
create policy tenant_isolation on calendar_event_mappings
  for all using (organization_id = current_setting('app.organization_id', true))
  with check (organization_id = current_setting('app.organization_id', true));
drop policy if exists own_or_org on employee_documents;
create policy own_or_org on employee_documents
  for all using (
    organization_id = current_setting('app.organization_id', true)
    and (
      user_id = current_setting('app.user_id', true)
      or current_setting('app.role', true) in ('super_admin', 'admin')
    )
  )
  with check (organization_id = current_setting('app.organization_id', true));
drop policy if exists tenant_isolation on notification_preferences;
create policy tenant_isolation on notification_preferences
  for all using (organization_id = current_setting('app.organization_id', true))
  with check (organization_id = current_setting('app.organization_id', true));

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

-- Additive Phase 5 tables. Does not alter or drop earlier objects.
-- Live writes remain in collection_items. These tables document the
-- relational shape, indexes, and organization isolation.

alter table if exists locations
  add column if not exists facility_id text;

create table if not exists facilities (
  id text primary key,
  organization_id text not null,
  name text not null,
  facility_type text not null,
  status text not null,
  address_line_1 text,
  address_line_2 text,
  city text,
  state text,
  postal_code text,
  country text,
  phone text,
  email text,
  website text,
  notes text,
  latitude numeric,
  longitude numeric,
  geofence_radius_meters integer,
  billing_enabled boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists facility_contacts (
  id text primary key,
  organization_id text not null,
  facility_id text not null,
  first_name text not null,
  last_name text not null,
  title text,
  email text,
  phone text,
  is_primary boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists employee_facilities (
  id text primary key,
  organization_id text not null,
  user_id text not null,
  facility_id text not null,
  is_primary boolean not null default false,
  start_date date,
  end_date date,
  created_at timestamptz not null default now()
);

create table if not exists facility_billing_rates (
  id text primary key,
  organization_id text not null,
  facility_id text not null,
  position_id text,
  qualification_id text,
  billing_rate numeric(10,2) not null,
  effective_from date not null,
  effective_to date,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists onboarding_templates (
  id text primary key,
  organization_id text not null,
  name text not null,
  employee_type text,
  role text,
  is_active boolean not null default true,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists onboarding_template_items (
  id text primary key,
  organization_id text not null,
  template_id text not null,
  title text not null,
  description text,
  item_type text not null,
  is_required boolean not null default true,
  sort_order integer not null default 0,
  due_days_after_start integer
);

create table if not exists employee_onboarding (
  id text primary key,
  organization_id text not null,
  user_id text not null,
  template_id text not null,
  status text not null,
  started_at timestamptz not null,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists employee_onboarding_items (
  id text primary key,
  organization_id text not null,
  employee_onboarding_id text not null,
  template_item_id text not null,
  status text not null,
  completed_at timestamptz,
  completed_by text,
  notes text
);

create table if not exists forms (
  id text primary key,
  organization_id text not null,
  title text not null,
  description text,
  status text not null,
  created_by text,
  version integer not null default 1,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists form_fields (
  id text primary key,
  organization_id text not null,
  form_id text not null,
  field_type text not null,
  label text not null,
  description text,
  required boolean not null default false,
  options jsonb,
  sort_order integer not null default 0
);

create table if not exists form_submissions (
  id text primary key,
  organization_id text not null,
  form_id text not null,
  user_id text,
  status text not null,
  submitted_at timestamptz,
  signature jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists form_submission_values (
  id text primary key,
  organization_id text not null,
  submission_id text not null,
  field_id text not null,
  value_json jsonb,
  created_at timestamptz not null default now()
);

create table if not exists policy_documents (
  id text primary key,
  organization_id text not null,
  title text not null,
  content text not null,
  version integer not null,
  status text not null,
  published_at timestamptz,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists policy_acknowledgements (
  id text primary key,
  organization_id text not null,
  policy_id text not null,
  user_id text not null,
  policy_version integer not null,
  viewed_at timestamptz,
  acknowledged_at timestamptz,
  signature jsonb
);

create table if not exists announcements (
  id text primary key,
  organization_id text not null,
  title text not null,
  message text not null,
  audience_kind text not null,
  audience_value text,
  publish_at timestamptz not null,
  expires_at timestamptz,
  priority text not null,
  require_acknowledgement boolean not null default false,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists announcement_acknowledgements (
  id text primary key,
  organization_id text not null,
  announcement_id text not null,
  user_id text not null,
  viewed_at timestamptz,
  acknowledged_at timestamptz
);

create table if not exists knowledge_base_categories (
  id text primary key,
  organization_id text not null,
  name text not null,
  slug text not null
);

create table if not exists knowledge_base_articles (
  id text primary key,
  organization_id text not null,
  category_id text not null,
  title text not null,
  summary text,
  content text not null,
  audience_kind text not null,
  audience_value text,
  status text not null,
  published_at timestamptz,
  updated_at timestamptz not null default now(),
  created_by text,
  archived_at timestamptz
);

create table if not exists knowledge_base_attachments (
  id text primary key,
  organization_id text not null,
  article_id text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes integer not null
);

create table if not exists training_resources (
  id text primary key,
  organization_id text not null,
  title text not null,
  resource_type text not null,
  url text,
  content text,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists training_assignments (
  id text primary key,
  organization_id text not null,
  resource_id text not null,
  user_id text not null,
  status text not null,
  viewed_at timestamptz,
  completed_at timestamptz
);

create table if not exists pay_periods (
  id text primary key,
  organization_id text not null,
  start_date date not null,
  end_date date not null,
  status text not null,
  locked_at timestamptz,
  locked_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists payroll_adjustments (
  id text primary key,
  organization_id text not null,
  user_id text not null,
  pay_period_id text not null,
  adjustment_type text not null,
  amount numeric(10,2) not null,
  hours numeric,
  description text not null,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists invoices (
  id text primary key,
  organization_id text not null,
  facility_id text not null,
  invoice_number text not null,
  period_start date not null,
  period_end date not null,
  status text not null,
  subtotal numeric(10,2) not null,
  adjustments numeric(10,2) not null default 0,
  total numeric(10,2) not null,
  notes text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, invoice_number)
);

create table if not exists invoice_items (
  id text primary key,
  organization_id text not null,
  invoice_id text not null,
  user_id text,
  shift_id text,
  description text not null,
  service_date date not null,
  hours numeric not null,
  rate numeric(10,2) not null,
  amount numeric(10,2) not null,
  created_at timestamptz not null default now()
);

create table if not exists saved_views (
  id text primary key,
  organization_id text not null,
  user_id text not null,
  module text not null,
  name text not null,
  filters jsonb not null default '{}',
  sort_config jsonb,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists custom_field_definitions (
  id text primary key,
  organization_id text not null,
  entity_type text not null,
  name text not null,
  field_type text not null,
  options jsonb,
  required boolean not null default false
);

create table if not exists custom_field_values (
  id text primary key,
  organization_id text not null,
  definition_id text not null,
  entity_id text not null,
  value_json jsonb
);

create table if not exists tags (
  id text primary key,
  organization_id text not null,
  name text not null,
  color text not null
);

create table if not exists entity_tags (
  id text primary key,
  organization_id text not null,
  tag_id text not null,
  entity_type text not null,
  entity_id text not null
);

create table if not exists employee_admin_notes (
  id text primary key,
  organization_id text not null,
  user_id text not null,
  note text not null,
  created_by text not null,
  created_at timestamptz not null default now()
);

create index if not exists facilities_org_idx on facilities (organization_id, status);
create index if not exists facility_contacts_facility_idx on facility_contacts (organization_id, facility_id);
create index if not exists employee_facilities_user_idx on employee_facilities (organization_id, user_id);
create index if not exists facility_billing_rates_idx on facility_billing_rates (organization_id, facility_id, effective_from);
create index if not exists employee_onboarding_user_idx on employee_onboarding (organization_id, user_id, status);
create index if not exists form_submissions_form_idx on form_submissions (organization_id, form_id, user_id);
create index if not exists announcements_org_idx on announcements (organization_id, publish_at);
create index if not exists kb_articles_org_idx on knowledge_base_articles (organization_id, status, category_id);
create index if not exists pay_periods_org_idx on pay_periods (organization_id, start_date, status);
create index if not exists invoices_org_idx on invoices (organization_id, facility_id, status, created_at);
create index if not exists invoice_items_invoice_idx on invoice_items (organization_id, invoice_id);
create index if not exists locations_facility_idx on locations (facility_id);

alter table facilities enable row level security;
alter table facility_contacts enable row level security;
alter table employee_facilities enable row level security;
alter table facility_billing_rates enable row level security;
alter table onboarding_templates enable row level security;
alter table onboarding_template_items enable row level security;
alter table employee_onboarding enable row level security;
alter table employee_onboarding_items enable row level security;
alter table forms enable row level security;
alter table form_fields enable row level security;
alter table form_submissions enable row level security;
alter table form_submission_values enable row level security;
alter table policy_documents enable row level security;
alter table policy_acknowledgements enable row level security;
alter table announcements enable row level security;
alter table announcement_acknowledgements enable row level security;
alter table knowledge_base_categories enable row level security;
alter table knowledge_base_articles enable row level security;
alter table knowledge_base_attachments enable row level security;
alter table training_resources enable row level security;
alter table training_assignments enable row level security;
alter table pay_periods enable row level security;
alter table payroll_adjustments enable row level security;
alter table invoices enable row level security;
alter table invoice_items enable row level security;
alter table saved_views enable row level security;
alter table custom_field_definitions enable row level security;
alter table custom_field_values enable row level security;
alter table tags enable row level security;
alter table entity_tags enable row level security;
alter table employee_admin_notes enable row level security;

drop policy if exists org_read on facilities;
create policy org_read on facilities for all using (
  organization_id = current_setting('app.organization_id', true)
) with check (organization_id = current_setting('app.organization_id', true));

drop policy if exists org_read on facility_contacts;
create policy org_read on facility_contacts for all using (
  organization_id = current_setting('app.organization_id', true)
) with check (organization_id = current_setting('app.organization_id', true));

drop policy if exists org_read on employee_facilities;
create policy org_read on employee_facilities for all using (
  organization_id = current_setting('app.organization_id', true)
) with check (organization_id = current_setting('app.organization_id', true));

drop policy if exists billing_admin on facility_billing_rates;
create policy billing_admin on facility_billing_rates for all using (
  organization_id = current_setting('app.organization_id', true)
  and current_setting('app.role', true) in ('super_admin', 'admin')
) with check (organization_id = current_setting('app.organization_id', true));

drop policy if exists own_or_admin on employee_onboarding;
create policy own_or_admin on employee_onboarding for all using (
  organization_id = current_setting('app.organization_id', true)
  and (
    user_id = current_setting('app.user_id', true)
    or current_setting('app.role', true) in ('super_admin', 'admin')
  )
) with check (organization_id = current_setting('app.organization_id', true));

drop policy if exists own_or_admin on form_submissions;
create policy own_or_admin on form_submissions for all using (
  organization_id = current_setting('app.organization_id', true)
  and (
    user_id = current_setting('app.user_id', true)
    or current_setting('app.role', true) in ('super_admin', 'admin')
  )
) with check (organization_id = current_setting('app.organization_id', true));

drop policy if exists billing_admin on invoices;
create policy billing_admin on invoices for all using (
  organization_id = current_setting('app.organization_id', true)
  and current_setting('app.role', true) in ('super_admin', 'admin')
) with check (organization_id = current_setting('app.organization_id', true));

drop policy if exists billing_admin on invoice_items;
create policy billing_admin on invoice_items for all using (
  organization_id = current_setting('app.organization_id', true)
  and current_setting('app.role', true) in ('super_admin', 'admin')
) with check (organization_id = current_setting('app.organization_id', true));

drop policy if exists payroll_admin on pay_periods;
create policy payroll_admin on pay_periods for all using (
  organization_id = current_setting('app.organization_id', true)
  and current_setting('app.role', true) in ('super_admin', 'admin')
) with check (organization_id = current_setting('app.organization_id', true));

drop policy if exists payroll_admin on payroll_adjustments;
create policy payroll_admin on payroll_adjustments for all using (
  organization_id = current_setting('app.organization_id', true)
  and current_setting('app.role', true) in ('super_admin', 'admin')
) with check (organization_id = current_setting('app.organization_id', true));

drop policy if exists admin_only on employee_admin_notes;
create policy admin_only on employee_admin_notes for all using (
  organization_id = current_setting('app.organization_id', true)
  and current_setting('app.role', true) in ('super_admin', 'admin')
) with check (organization_id = current_setting('app.organization_id', true));

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

