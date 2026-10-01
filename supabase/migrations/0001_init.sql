-- CAL ACE Team — Phase 1 schema
-- Multi-tenant workforce management
-- Run this in the Supabase SQL editor or via the Supabase CLI.

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid();
$$;

create or replace function public.current_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id
  from public.profiles
  where id = auth.uid();
$$;

create or replace function public.current_role_slugs()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(r.slug), '{}')
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  where ur.user_id = auth.uid();
$$;

create or replace function public.has_role(role_slug text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and r.slug = role_slug
  );
$$;

create or replace function public.is_staff_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role('super_admin')
      or public.has_role('admin')
      or public.has_role('scheduler');
$$;

-- ---------------------------------------------------------------------------
-- Core tenancy & identity
-- ---------------------------------------------------------------------------

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_url text,
  timezone text not null default 'America/Los_Angeles',
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  is_system boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (organization_id, slug)
);

create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  module text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  address text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.positions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.qualifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  slug text not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (organization_id, slug)
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  first_name text not null,
  last_name text not null,
  phone text,
  avatar_url text,
  position_id uuid references public.positions(id) on delete set null,
  department_id uuid references public.departments(id) on delete set null,
  employment_status text not null default 'active'
    check (employment_status in ('active', 'invited', 'inactive')),
  default_weekly_hours numeric(5,2) not null default 40,
  max_weekly_hours numeric(5,2) not null default 40,
  last_active_at timestamptz,
  invited_at timestamptz,
  deactivated_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (organization_id, email)
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique (user_id, role_id)
);

create table public.user_qualifications (
  user_id uuid not null references public.profiles(id) on delete cascade,
  qualification_id uuid not null references public.qualifications(id) on delete cascade,
  primary key (user_id, qualification_id)
);

create table public.user_locations (
  user_id uuid not null references public.profiles(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  primary key (user_id, location_id)
);

-- ---------------------------------------------------------------------------
-- Smart groups
-- ---------------------------------------------------------------------------

create table public.smart_groups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  is_system boolean not null default false,
  rules jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- ---------------------------------------------------------------------------
-- Scheduling
-- ---------------------------------------------------------------------------

create table public.shift_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  title text not null,
  start_time time not null,
  end_time time not null,
  location_id uuid references public.locations(id) on delete set null,
  department_id uuid references public.departments(id) on delete set null,
  class_cohort text,
  position_id uuid references public.positions(id) on delete set null,
  color text not null default '#0D2A43',
  break_duration_minutes integer not null default 0,
  notes text,
  required_instructors integer not null default 1,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  template_id uuid references public.shift_templates(id) on delete set null,
  title text not null,
  shift_date date not null,
  start_time time not null,
  end_time time not null,
  location_id uuid references public.locations(id) on delete set null,
  department_id uuid references public.departments(id) on delete set null,
  class_cohort text,
  position_id uuid references public.positions(id) on delete set null,
  color text not null default '#0D2A43',
  break_duration_minutes integer not null default 0,
  notes text,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'completed', 'cancelled')),
  is_open boolean not null default false,
  required_instructors integer not null default 1,
  approval_required boolean not null default true,
  recurrence_rule text,
  published_at timestamptz,
  published_by uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.shift_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  shift_id uuid not null references public.shifts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'assigned'
    check (status in ('assigned', 'accepted', 'declined', 'removed')),
  assigned_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (shift_id, user_id)
);

create table public.shift_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  shift_id uuid not null references public.shifts(id) on delete cascade,
  title text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

-- ---------------------------------------------------------------------------
-- Availability & time off
-- ---------------------------------------------------------------------------

create table public.availability_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  status text not null check (status in ('available', 'unavailable', 'preferred')),
  start_time time,
  end_time time,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, weekday)
);

create table public.availability_exceptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  exception_date date not null,
  status text not null check (status in ('available', 'unavailable', 'preferred')),
  start_time time,
  end_time time,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  unique (user_id, exception_date)
);

create table public.time_off_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  is_partial_day boolean not null default false,
  start_time time,
  end_time time,
  reason text,
  notes text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- ---------------------------------------------------------------------------
-- Time clock & timesheets
-- ---------------------------------------------------------------------------

create table public.clock_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  shift_id uuid references public.shifts(id) on delete set null,
  clock_in timestamptz not null,
  clock_out timestamptz,
  total_break_minutes integer not null default 0,
  worked_minutes integer,
  punctuality text
    check (punctuality in ('on_time', 'early', 'late')),
  status text not null default 'clocked_in'
    check (status in ('clocked_in', 'on_break', 'clocked_out')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.break_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  clock_entry_id uuid not null references public.clock_entries(id) on delete cascade,
  break_start timestamptz not null,
  break_end timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.timesheets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  scheduled_minutes integer not null default 0,
  worked_minutes integer not null default 0,
  regular_minutes integer not null default 0,
  overtime_minutes integer not null default 0,
  break_minutes integer not null default 0,
  status text not null default 'open'
    check (status in ('open', 'submitted', 'approved', 'rejected', 'payroll_exported')),
  submitted_at timestamptz,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, period_start, period_end)
);

create table public.timesheet_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  timesheet_id uuid not null references public.timesheets(id) on delete cascade,
  clock_entry_id uuid references public.clock_entries(id) on delete set null,
  work_date date not null,
  clock_in timestamptz,
  clock_out timestamptz,
  break_minutes integer not null default 0,
  regular_minutes integer not null default 0,
  overtime_minutes integer not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

-- ---------------------------------------------------------------------------
-- Tasks
-- ---------------------------------------------------------------------------

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  description text,
  due_at timestamptz,
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  shift_id uuid references public.shifts(id) on delete set null,
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'completed', 'cancelled')),
  created_by uuid references public.profiles(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.task_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  unique (task_id, user_id)
);

create table public.task_checklist_items (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  title text not null,
  is_completed boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default timezone('utc', now())
);

-- ---------------------------------------------------------------------------
-- Open shifts & trades
-- ---------------------------------------------------------------------------

create table public.open_shift_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  shift_id uuid not null references public.shifts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  unique (shift_id, user_id)
);

create table public.shift_trade_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  shift_id uuid not null references public.shifts(id) on delete cascade,
  from_user_id uuid not null references public.profiles(id) on delete cascade,
  to_user_id uuid references public.profiles(id) on delete set null,
  trade_type text not null check (trade_type in ('offer', 'swap')),
  swap_shift_id uuid references public.shifts(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- ---------------------------------------------------------------------------
-- Communication (schema only in Phase 1)
-- ---------------------------------------------------------------------------

create table public.chat_rooms (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text,
  room_type text not null check (room_type in ('direct', 'group', 'team')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.chat_room_members (
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (room_id, user_id)
);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default timezone('utc', now())
);

-- ---------------------------------------------------------------------------
-- Notifications, calendar, activity, settings
-- ---------------------------------------------------------------------------

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.calendar_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null check (provider in ('google', 'outlook', 'apple_ics')),
  status text not null default 'disconnected'
    check (status in ('disconnected', 'connected', 'error')),
  ics_token text unique,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  clock_in_grace_minutes integer not null default 15,
  overtime_weekly_hours numeric(5,2) not null default 40,
  allow_early_clock_in boolean not null default true,
  require_geolocation boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index idx_profiles_org on public.profiles (organization_id);
create index idx_profiles_email on public.profiles using gin (email gin_trgm_ops);
create index idx_profiles_name on public.profiles using gin ((first_name || ' ' || last_name) gin_trgm_ops);
create index idx_shifts_org_date on public.shifts (organization_id, shift_date);
create index idx_shift_assignments_user on public.shift_assignments (user_id, shift_id);
create index idx_clock_entries_user on public.clock_entries (user_id, clock_in);
create index idx_time_off_org on public.time_off_requests (organization_id, status);
create index idx_notifications_user on public.notifications (user_id, created_at desc);
create index idx_activity_logs_org on public.activity_logs (organization_id, created_at desc);
create index idx_tasks_org on public.tasks (organization_id, status);
create index idx_chat_messages_room on public.chat_messages (room_id, created_at);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'organizations','roles','locations','departments','positions','profiles',
    'smart_groups','shift_templates','shifts','shift_assignments',
    'availability_rules','time_off_requests','clock_entries','timesheets',
    'tasks','shift_trade_requests','chat_rooms','calendar_connections','settings'
  ]
  loop
    execute format(
      'create trigger set_updated_at before update on public.%I
       for each row execute function public.set_updated_at();',
      t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- New profile from auth.users
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Profiles are created by invite/seed flows, not automatically for every auth user.
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.organizations enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.locations enable row level security;
alter table public.departments enable row level security;
alter table public.positions enable row level security;
alter table public.qualifications enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.user_qualifications enable row level security;
alter table public.user_locations enable row level security;
alter table public.smart_groups enable row level security;
alter table public.shift_templates enable row level security;
alter table public.shifts enable row level security;
alter table public.shift_assignments enable row level security;
alter table public.shift_tasks enable row level security;
alter table public.availability_rules enable row level security;
alter table public.availability_exceptions enable row level security;
alter table public.time_off_requests enable row level security;
alter table public.clock_entries enable row level security;
alter table public.break_entries enable row level security;
alter table public.timesheets enable row level security;
alter table public.timesheet_entries enable row level security;
alter table public.tasks enable row level security;
alter table public.task_assignments enable row level security;
alter table public.task_checklist_items enable row level security;
alter table public.task_comments enable row level security;
alter table public.open_shift_requests enable row level security;
alter table public.shift_trade_requests enable row level security;
alter table public.chat_rooms enable row level security;
alter table public.chat_room_members enable row level security;
alter table public.chat_messages enable row level security;
alter table public.notifications enable row level security;
alter table public.calendar_connections enable row level security;
alter table public.activity_logs enable row level security;
alter table public.settings enable row level security;

-- Organization: members can read their org
create policy org_select on public.organizations
  for select using (id = public.current_organization_id());

create policy org_update_admin on public.organizations
  for update using (
    id = public.current_organization_id()
    and (public.has_role('super_admin') or public.has_role('admin'))
  );

-- Generic org-scoped read for lookup tables
create policy roles_select on public.roles
  for select using (organization_id is null or organization_id = public.current_organization_id());

create policy permissions_select on public.permissions
  for select using (true);

create policy role_permissions_select on public.role_permissions
  for select using (true);

create policy locations_select on public.locations
  for select using (organization_id = public.current_organization_id());
create policy locations_write on public.locations
  for all using (
    organization_id = public.current_organization_id()
    and (public.has_role('super_admin') or public.has_role('admin'))
  );

create policy departments_select on public.departments
  for select using (organization_id = public.current_organization_id());
create policy departments_write on public.departments
  for all using (
    organization_id = public.current_organization_id()
    and (public.has_role('super_admin') or public.has_role('admin'))
  );

create policy positions_select on public.positions
  for select using (organization_id = public.current_organization_id());
create policy positions_write on public.positions
  for all using (
    organization_id = public.current_organization_id()
    and (public.has_role('super_admin') or public.has_role('admin'))
  );

create policy qualifications_select on public.qualifications
  for select using (organization_id = public.current_organization_id());
create policy qualifications_write on public.qualifications
  for all using (
    organization_id = public.current_organization_id()
    and (public.has_role('super_admin') or public.has_role('admin'))
  );

-- Profiles
create policy profiles_select on public.profiles
  for select using (organization_id = public.current_organization_id());

create policy profiles_update_self on public.profiles
  for update using (id = auth.uid());

create policy profiles_admin_write on public.profiles
  for all using (
    organization_id = public.current_organization_id()
    and (public.has_role('super_admin') or public.has_role('admin'))
  );

create policy user_roles_select on public.user_roles
  for select using (organization_id = public.current_organization_id());
create policy user_roles_write on public.user_roles
  for all using (
    organization_id = public.current_organization_id()
    and (public.has_role('super_admin') or public.has_role('admin'))
  );

create policy user_qualifications_select on public.user_qualifications
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = user_id and p.organization_id = public.current_organization_id()
    )
  );
create policy user_qualifications_write on public.user_qualifications
  for all using (
    public.has_role('super_admin') or public.has_role('admin')
  );

create policy user_locations_select on public.user_locations
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = user_id and p.organization_id = public.current_organization_id()
    )
  );

create policy smart_groups_select on public.smart_groups
  for select using (organization_id = public.current_organization_id());
create policy smart_groups_write on public.smart_groups
  for all using (
    organization_id = public.current_organization_id()
    and public.is_staff_manager()
  );

-- Shifts
create policy shifts_select on public.shifts
  for select using (
    organization_id = public.current_organization_id()
    and (
      public.is_staff_manager()
      or status = 'published'
      or created_by = auth.uid()
    )
  );

create policy shifts_write on public.shifts
  for all using (
    organization_id = public.current_organization_id()
    and public.is_staff_manager()
  );

create policy shift_templates_select on public.shift_templates
  for select using (organization_id = public.current_organization_id());
create policy shift_templates_write on public.shift_templates
  for all using (
    organization_id = public.current_organization_id()
    and public.is_staff_manager()
  );

create policy shift_assignments_select on public.shift_assignments
  for select using (organization_id = public.current_organization_id());
create policy shift_assignments_write on public.shift_assignments
  for all using (
    organization_id = public.current_organization_id()
    and public.is_staff_manager()
  );

create policy shift_tasks_select on public.shift_tasks
  for select using (organization_id = public.current_organization_id());
create policy shift_tasks_write on public.shift_tasks
  for all using (
    organization_id = public.current_organization_id()
    and public.is_staff_manager()
  );

-- Availability
create policy availability_rules_select on public.availability_rules
  for select using (
    organization_id = public.current_organization_id()
    and (user_id = auth.uid() or public.is_staff_manager())
  );
create policy availability_rules_write on public.availability_rules
  for all using (
    organization_id = public.current_organization_id()
    and (user_id = auth.uid() or public.is_staff_manager())
  );

create policy availability_exceptions_select on public.availability_exceptions
  for select using (
    organization_id = public.current_organization_id()
    and (user_id = auth.uid() or public.is_staff_manager())
  );
create policy availability_exceptions_write on public.availability_exceptions
  for all using (
    organization_id = public.current_organization_id()
    and (user_id = auth.uid() or public.is_staff_manager())
  );

-- Time off
create policy time_off_select on public.time_off_requests
  for select using (
    organization_id = public.current_organization_id()
    and (user_id = auth.uid() or public.is_staff_manager())
  );
create policy time_off_insert on public.time_off_requests
  for insert with check (
    organization_id = public.current_organization_id()
    and user_id = auth.uid()
  );
create policy time_off_update_own on public.time_off_requests
  for update using (user_id = auth.uid() and status = 'pending');
create policy time_off_admin on public.time_off_requests
  for all using (
    organization_id = public.current_organization_id()
    and (public.has_role('super_admin') or public.has_role('admin'))
  );

-- Clock
create policy clock_select on public.clock_entries
  for select using (
    organization_id = public.current_organization_id()
    and (user_id = auth.uid() or public.is_staff_manager())
  );
create policy clock_insert_own on public.clock_entries
  for insert with check (user_id = auth.uid());
create policy clock_update_own on public.clock_entries
  for update using (user_id = auth.uid());
create policy clock_admin on public.clock_entries
  for all using (
    organization_id = public.current_organization_id()
    and (public.has_role('super_admin') or public.has_role('admin'))
  );

create policy break_select on public.break_entries
  for select using (organization_id = public.current_organization_id());
create policy break_write on public.break_entries
  for all using (organization_id = public.current_organization_id());

-- Timesheets
create policy timesheets_select on public.timesheets
  for select using (
    organization_id = public.current_organization_id()
    and (user_id = auth.uid() or public.is_staff_manager())
  );
create policy timesheets_admin on public.timesheets
  for all using (
    organization_id = public.current_organization_id()
    and (public.has_role('super_admin') or public.has_role('admin'))
  );

create policy timesheet_entries_select on public.timesheet_entries
  for select using (organization_id = public.current_organization_id());
create policy timesheet_entries_admin on public.timesheet_entries
  for all using (
    organization_id = public.current_organization_id()
    and (public.has_role('super_admin') or public.has_role('admin'))
  );

-- Tasks
create policy tasks_select on public.tasks
  for select using (organization_id = public.current_organization_id());
create policy tasks_write on public.tasks
  for all using (
    organization_id = public.current_organization_id()
    and public.is_staff_manager()
  );

create policy task_assignments_select on public.task_assignments
  for select using (organization_id = public.current_organization_id());
create policy task_assignments_write on public.task_assignments
  for all using (organization_id = public.current_organization_id());

create policy task_checklist_select on public.task_checklist_items
  for select using (true);
create policy task_checklist_write on public.task_checklist_items
  for all using (true);

create policy task_comments_select on public.task_comments
  for select using (organization_id = public.current_organization_id());
create policy task_comments_insert on public.task_comments
  for insert with check (organization_id = public.current_organization_id());

-- Open shifts / trades
create policy open_shift_requests_select on public.open_shift_requests
  for select using (
    organization_id = public.current_organization_id()
    and (user_id = auth.uid() or public.is_staff_manager())
  );
create policy open_shift_requests_insert on public.open_shift_requests
  for insert with check (user_id = auth.uid());
create policy open_shift_requests_admin on public.open_shift_requests
  for all using (
    organization_id = public.current_organization_id()
    and (public.has_role('super_admin') or public.has_role('admin'))
  );

create policy shift_trades_select on public.shift_trade_requests
  for select using (
    organization_id = public.current_organization_id()
    and (from_user_id = auth.uid() or to_user_id = auth.uid() or public.is_staff_manager())
  );
create policy shift_trades_insert on public.shift_trade_requests
  for insert with check (from_user_id = auth.uid());
create policy shift_trades_admin on public.shift_trade_requests
  for all using (
    organization_id = public.current_organization_id()
    and (public.has_role('super_admin') or public.has_role('admin'))
  );

-- Chat
create policy chat_rooms_select on public.chat_rooms
  for select using (
    organization_id = public.current_organization_id()
    and exists (
      select 1 from public.chat_room_members m
      where m.room_id = id and m.user_id = auth.uid()
    )
  );
create policy chat_rooms_insert on public.chat_rooms
  for insert with check (organization_id = public.current_organization_id());

create policy chat_members_select on public.chat_room_members
  for select using (user_id = auth.uid() or public.is_staff_manager());
create policy chat_members_write on public.chat_room_members
  for all using (public.is_staff_manager() or user_id = auth.uid());

create policy chat_messages_select on public.chat_messages
  for select using (
    organization_id = public.current_organization_id()
    and exists (
      select 1 from public.chat_room_members m
      where m.room_id = chat_messages.room_id and m.user_id = auth.uid()
    )
  );
create policy chat_messages_insert on public.chat_messages
  for insert with check (
    sender_id = auth.uid()
    and organization_id = public.current_organization_id()
  );

-- Notifications / calendar / activity / settings
create policy notifications_select on public.notifications
  for select using (user_id = auth.uid());
create policy notifications_update on public.notifications
  for update using (user_id = auth.uid());

create policy calendar_select on public.calendar_connections
  for select using (user_id = auth.uid());
create policy calendar_write on public.calendar_connections
  for all using (user_id = auth.uid());

create policy activity_select on public.activity_logs
  for select using (
    organization_id = public.current_organization_id()
    and public.is_staff_manager()
  );
create policy activity_insert on public.activity_logs
  for insert with check (organization_id = public.current_organization_id());

create policy settings_select on public.settings
  for select using (organization_id = public.current_organization_id());
create policy settings_write on public.settings
  for all using (
    organization_id = public.current_organization_id()
    and (public.has_role('super_admin') or public.has_role('admin'))
  );
