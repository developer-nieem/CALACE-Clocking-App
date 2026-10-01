-- CAL ACE Team — Phase 1 staff, geolocation time clock, and estimated pay
-- Forward-only migration. Timestamps remain UTC timestamptz; display uses org timezone.

alter table public.profiles
  add column if not exists employee_type text not null default 'instructor'
    check (employee_type in ('instructor', 'staff')),
  add column if not exists primary_location_id uuid references public.locations(id) on delete set null,
  add column if not exists hire_date date,
  add column if not exists pay_type text not null default 'hourly'
    check (pay_type in ('hourly', 'salary')),
  add column if not exists hourly_rate numeric(10,2)
    check (hourly_rate is null or hourly_rate >= 0),
  add column if not exists weekly_target_hours numeric(5,2)
    check (weekly_target_hours is null or weekly_target_hours >= 0),
  add column if not exists maximum_weekly_hours numeric(5,2)
    check (maximum_weekly_hours is null or maximum_weekly_hours >= 0);

update public.profiles
set weekly_target_hours = default_weekly_hours,
    maximum_weekly_hours = max_weekly_hours
where weekly_target_hours is null or maximum_weekly_hours is null;

alter table public.locations
  add column if not exists latitude numeric(10,7),
  add column if not exists longitude numeric(10,7),
  add column if not exists geofence_radius_meters numeric(10,2) not null default 200,
  add column if not exists geolocation_required boolean not null default false,
  add column if not exists status text not null default 'active'
    check (status in ('active', 'inactive'));

alter table public.settings
  add column if not exists currency_code char(3) not null default 'USD',
  add column if not exists require_location_clock_in boolean not null default false,
  add column if not exists require_location_clock_out boolean not null default false,
  add column if not exists geofence_enforcement text not null default 'warning'
    check (geofence_enforcement in ('strict', 'warning', 'disabled')),
  add column if not exists allow_unscheduled_clock_in boolean not null default true,
  add column if not exists clock_in_early_minutes integer not null default 15,
  add column if not exists clock_in_late_grace_minutes integer not null default 5,
  add column if not exists early_clock_in_policy text not null default 'warning'
    check (early_clock_in_policy in ('allow', 'warning', 'block')),
  add column if not exists missing_clock_out_hours numeric(5,2) not null default 16,
  add column if not exists daily_overtime_enabled boolean not null default false,
  add column if not exists daily_overtime_threshold_hours numeric(5,2) not null default 8,
  add column if not exists weekly_overtime_enabled boolean not null default true,
  add column if not exists weekly_overtime_threshold_hours numeric(5,2) not null default 40,
  add column if not exists overtime_multiplier numeric(5,2) not null default 1.50,
  add column if not exists employees_can_view_estimated_earnings boolean not null default true;

create table if not exists public.employee_pay_rates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  hourly_rate numeric(10,2) not null check (hourly_rate >= 0),
  effective_from date not null,
  effective_to date,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  check (effective_to is null or effective_to >= effective_from)
);

create unique index if not exists employee_pay_rates_one_start
  on public.employee_pay_rates(user_id, effective_from);
create index if not exists employee_pay_rates_lookup
  on public.employee_pay_rates(user_id, effective_from desc, effective_to);

create table if not exists public.time_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  shift_id uuid references public.shifts(id) on delete set null,
  work_date date not null,
  clock_in_at timestamptz not null,
  clock_out_at timestamptz,
  clock_in_latitude numeric(10,7),
  clock_in_longitude numeric(10,7),
  clock_in_accuracy numeric(10,2),
  clock_out_latitude numeric(10,7),
  clock_out_longitude numeric(10,7),
  clock_out_accuracy numeric(10,2),
  clock_in_location_id uuid references public.locations(id) on delete set null,
  clock_out_location_id uuid references public.locations(id) on delete set null,
  clock_in_distance_meters numeric(12,2),
  clock_out_distance_meters numeric(12,2),
  clock_in_geofence_status text
    check (clock_in_geofence_status in ('verified', 'outside_geofence', 'unavailable', 'not_required')),
  clock_out_geofence_status text
    check (clock_out_geofence_status in ('verified', 'outside_geofence', 'unavailable', 'not_required')),
  status text not null default 'working'
    check (status in ('working', 'on_break', 'completed', 'edited')),
  clock_status text
    check (clock_status in ('on_time', 'early', 'late', 'unscheduled', 'outside_geofence', 'missing_clock_out', 'admin_edited')),
  pay_rate_snapshot numeric(10,2),
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists time_entries_one_active_per_user
  on public.time_entries(user_id) where clock_out_at is null;
create index if not exists time_entries_org_date
  on public.time_entries(organization_id, work_date desc);
create index if not exists time_entries_user_date
  on public.time_entries(user_id, work_date desc);

create table if not exists public.time_breaks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  time_entry_id uuid not null references public.time_entries(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  break_start_at timestamptz not null,
  break_end_at timestamptz,
  break_start_latitude numeric(10,7),
  break_start_longitude numeric(10,7),
  break_start_accuracy numeric(10,2),
  break_end_latitude numeric(10,7),
  break_end_longitude numeric(10,7),
  break_end_accuracy numeric(10,2),
  break_minutes integer,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists time_breaks_one_active_per_entry
  on public.time_breaks(time_entry_id) where break_end_at is null;
create index if not exists time_breaks_entry on public.time_breaks(time_entry_id, break_start_at);

create table if not exists public.time_entry_edits (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  time_entry_id uuid not null references public.time_entries(id) on delete cascade,
  changed_by uuid not null references public.profiles(id) on delete restrict,
  field_name text not null,
  old_value text,
  new_value text,
  reason text not null check (length(trim(reason)) >= 3),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists time_entry_edits_entry
  on public.time_entry_edits(time_entry_id, created_at desc);

create trigger set_updated_at before update on public.time_entries
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.time_breaks
  for each row execute function public.set_updated_at();

-- Device-reported location is evidence, not proof. Distance is always server-calculated.
create or replace function public.geo_distance_meters(
  lat1 numeric, lon1 numeric, lat2 numeric, lon2 numeric
) returns numeric
language sql immutable
as $$
  select case when lat1 is null or lon1 is null or lat2 is null or lon2 is null then null
  else 6371000 * 2 * asin(sqrt(
    power(sin(radians((lat2-lat1)::double precision) / 2), 2) +
    cos(radians(lat1::double precision)) * cos(radians(lat2::double precision)) *
    power(sin(radians((lon2-lon1)::double precision) / 2), 2)
  )) end;
$$;

create or replace function public.resolve_geofence(
  p_location_id uuid, p_latitude numeric, p_longitude numeric
) returns table(distance_meters numeric, geofence_status text)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_location public.locations%rowtype;
  v_settings public.settings%rowtype;
begin
  select * into v_settings from public.settings
    where organization_id = public.current_organization_id();
  select * into v_location from public.locations
    where id = p_location_id and organization_id = public.current_organization_id();

  if coalesce(v_settings.geofence_enforcement, 'warning') = 'disabled'
     or p_location_id is null then
    return query select null::numeric, 'not_required'::text;
  elsif p_latitude is null or p_longitude is null
     or v_location.latitude is null or v_location.longitude is null then
    return query select null::numeric, 'unavailable'::text;
  else
    distance_meters := public.geo_distance_meters(
      p_latitude, p_longitude, v_location.latitude, v_location.longitude
    );
    geofence_status := case
      when distance_meters <= v_location.geofence_radius_meters then 'verified'
      else 'outside_geofence'
    end;
    return next;
  end if;
end;
$$;

-- Transactional clock-in: unique partial index plus advisory lock prevents double submissions.
create or replace function public.clock_in(
  p_shift_id uuid default null,
  p_latitude numeric default null,
  p_longitude numeric default null,
  p_accuracy numeric default null
) returns public.time_entries
language plpgsql security definer set search_path = public
as $$
declare
  v_org uuid := public.current_organization_id();
  v_profile public.profiles%rowtype;
  v_shift public.shifts%rowtype;
  v_settings public.settings%rowtype;
  v_location_id uuid;
  v_distance numeric;
  v_geo text;
  v_rate numeric(10,2);
  v_entry public.time_entries%rowtype;
  v_now timestamptz := timezone('utc', now());
begin
  if auth.uid() is null then raise exception 'Unauthorized'; end if;
  perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
  if exists(select 1 from public.time_entries where user_id = auth.uid() and clock_out_at is null)
    then raise exception 'Already clocked in'; end if;

  select * into v_profile from public.profiles where id = auth.uid() and organization_id = v_org;
  select * into v_settings from public.settings where organization_id = v_org;
  if p_shift_id is not null then
    select * into v_shift from public.shifts
      where id = p_shift_id and organization_id = v_org
      and exists(select 1 from public.shift_assignments a
        where a.shift_id = p_shift_id and a.user_id = auth.uid() and a.status <> 'removed');
    if not found then raise exception 'Shift not assigned to user'; end if;
    v_location_id := v_shift.location_id;
  elsif not coalesce(v_settings.allow_unscheduled_clock_in, false) then
    raise exception 'Unscheduled clock-in is not allowed';
  else
    v_location_id := v_profile.primary_location_id;
  end if;

  select distance_meters, geofence_status into v_distance, v_geo
    from public.resolve_geofence(v_location_id, p_latitude, p_longitude);
  if coalesce(v_settings.require_location_clock_in, false) and p_latitude is null then
    raise exception 'Location is required to clock in';
  end if;
  if v_settings.geofence_enforcement = 'strict' and v_geo = 'outside_geofence' then
    raise exception 'Outside approved location';
  end if;

  select hourly_rate into v_rate from public.employee_pay_rates
    where user_id = auth.uid()
      and effective_from <= (v_now at time zone coalesce(
        (select timezone from public.organizations where id = v_org), 'UTC'))::date
      and (effective_to is null or effective_to >=
        (v_now at time zone coalesce((select timezone from public.organizations where id = v_org), 'UTC'))::date)
    order by effective_from desc limit 1;

  insert into public.time_entries(
    organization_id,user_id,shift_id,work_date,clock_in_at,
    clock_in_latitude,clock_in_longitude,clock_in_accuracy,
    clock_in_location_id,clock_in_distance_meters,clock_in_geofence_status,
    status,clock_status,pay_rate_snapshot
  ) values (
    v_org,auth.uid(),p_shift_id,
    (v_now at time zone coalesce((select timezone from public.organizations where id=v_org),'UTC'))::date,
    v_now,p_latitude,p_longitude,p_accuracy,v_location_id,v_distance,v_geo,'working',
    case when v_geo='outside_geofence' then 'outside_geofence'
         when p_shift_id is null then 'unscheduled' else 'on_time' end,
    coalesce(v_rate, v_profile.hourly_rate)
  ) returning * into v_entry;

  insert into public.activity_logs(organization_id,actor_id,action,entity_type,entity_id,new_values)
    values(v_org,auth.uid(),'clock_in','time_entry',v_entry.id,
      jsonb_build_object('shift_id',p_shift_id,'geofence_status',v_geo));
  return v_entry;
end;
$$;

create or replace function public.start_break(
  p_latitude numeric default null, p_longitude numeric default null, p_accuracy numeric default null
) returns public.time_breaks
language plpgsql security definer set search_path = public
as $$
declare v_entry public.time_entries%rowtype; v_break public.time_breaks%rowtype;
begin
  perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
  select * into v_entry from public.time_entries
    where user_id=auth.uid() and clock_out_at is null for update;
  if not found then raise exception 'No active time entry'; end if;
  if v_entry.status <> 'working' then raise exception 'A break is already active'; end if;
  insert into public.time_breaks(
    organization_id,time_entry_id,user_id,break_start_at,
    break_start_latitude,break_start_longitude,break_start_accuracy
  ) values(v_entry.organization_id,v_entry.id,auth.uid(),timezone('utc',now()),
    p_latitude,p_longitude,p_accuracy) returning * into v_break;
  update public.time_entries set status='on_break' where id=v_entry.id;
  insert into public.activity_logs(organization_id,actor_id,action,entity_type,entity_id)
    values(v_entry.organization_id,auth.uid(),'start_break','time_entry',v_entry.id);
  return v_break;
end;
$$;

create or replace function public.end_break(
  p_latitude numeric default null, p_longitude numeric default null, p_accuracy numeric default null
) returns public.time_breaks
language plpgsql security definer set search_path = public
as $$
declare v_entry public.time_entries%rowtype; v_break public.time_breaks%rowtype; v_now timestamptz:=timezone('utc',now());
begin
  perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
  select * into v_entry from public.time_entries
    where user_id=auth.uid() and clock_out_at is null for update;
  if not found or v_entry.status <> 'on_break' then raise exception 'No active break'; end if;
  select * into v_break from public.time_breaks
    where time_entry_id=v_entry.id and break_end_at is null for update;
  if not found then raise exception 'No active break'; end if;
  update public.time_breaks set break_end_at=v_now,
    break_end_latitude=p_latitude,break_end_longitude=p_longitude,break_end_accuracy=p_accuracy,
    break_minutes=floor(extract(epoch from (v_now-break_start_at))/60)::integer
    where id=v_break.id returning * into v_break;
  update public.time_entries set status='working' where id=v_entry.id;
  insert into public.activity_logs(organization_id,actor_id,action,entity_type,entity_id)
    values(v_entry.organization_id,auth.uid(),'end_break','time_entry',v_entry.id);
  return v_break;
end;
$$;

create or replace function public.clock_out(
  p_latitude numeric default null, p_longitude numeric default null, p_accuracy numeric default null
) returns public.time_entries
language plpgsql security definer set search_path = public
as $$
declare
  v_entry public.time_entries%rowtype; v_settings public.settings%rowtype;
  v_distance numeric; v_geo text; v_location uuid; v_now timestamptz:=timezone('utc',now());
begin
  perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
  select * into v_entry from public.time_entries
    where user_id=auth.uid() and clock_out_at is null for update;
  if not found then raise exception 'No active time entry'; end if;
  if v_entry.status='on_break' then raise exception 'End the active break before clocking out'; end if;
  select * into v_settings from public.settings where organization_id=v_entry.organization_id;
  v_location := coalesce(v_entry.clock_in_location_id,
    (select primary_location_id from public.profiles where id=auth.uid()));
  select distance_meters,geofence_status into v_distance,v_geo
    from public.resolve_geofence(v_location,p_latitude,p_longitude);
  if coalesce(v_settings.require_location_clock_out,false) and p_latitude is null then
    raise exception 'Location is required to clock out'; end if;
  if v_settings.geofence_enforcement='strict' and v_geo='outside_geofence' then
    raise exception 'Outside approved location'; end if;
  update public.time_entries set clock_out_at=v_now,
    clock_out_latitude=p_latitude,clock_out_longitude=p_longitude,clock_out_accuracy=p_accuracy,
    clock_out_location_id=v_location,clock_out_distance_meters=v_distance,
    clock_out_geofence_status=v_geo,status='completed'
    where id=v_entry.id returning * into v_entry;
  insert into public.activity_logs(organization_id,actor_id,action,entity_type,entity_id,new_values)
    values(v_entry.organization_id,auth.uid(),'clock_out','time_entry',v_entry.id,
      jsonb_build_object('geofence_status',v_geo));
  return v_entry;
end;
$$;

create or replace function public.correct_time_entry(
  p_time_entry_id uuid,
  p_break_id uuid,
  p_field_name text,
  p_new_value timestamptz,
  p_reason text
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_org uuid := public.current_organization_id();
  v_old text;
begin
  if not (public.has_role('super_admin') or public.has_role('admin')) then
    raise exception 'Forbidden';
  end if;
  if length(trim(p_reason)) < 3 then raise exception 'Correction reason is required'; end if;
  perform pg_advisory_xact_lock(hashtext(p_time_entry_id::text));
  if p_field_name = 'clockInAt' then
    select clock_in_at::text into v_old from public.time_entries
      where id=p_time_entry_id and organization_id=v_org for update;
    update public.time_entries set clock_in_at=p_new_value,status='edited',
      clock_status='admin_edited' where id=p_time_entry_id and organization_id=v_org;
  elsif p_field_name = 'clockOutAt' then
    select clock_out_at::text into v_old from public.time_entries
      where id=p_time_entry_id and organization_id=v_org for update;
    update public.time_entries set clock_out_at=p_new_value,status='edited',
      clock_status='admin_edited' where id=p_time_entry_id and organization_id=v_org;
  elsif p_field_name = 'breakStartAt' then
    select break_start_at::text into v_old from public.time_breaks
      where id=p_break_id and time_entry_id=p_time_entry_id and organization_id=v_org for update;
    update public.time_breaks set break_start_at=p_new_value,
      break_minutes=case when break_end_at is null then null
        else floor(extract(epoch from (break_end_at-p_new_value))/60)::integer end
      where id=p_break_id and time_entry_id=p_time_entry_id and organization_id=v_org;
    update public.time_entries set status='edited',clock_status='admin_edited'
      where id=p_time_entry_id and organization_id=v_org;
  elsif p_field_name = 'breakEndAt' then
    select break_end_at::text into v_old from public.time_breaks
      where id=p_break_id and time_entry_id=p_time_entry_id and organization_id=v_org for update;
    update public.time_breaks set break_end_at=p_new_value,
      break_minutes=floor(extract(epoch from (p_new_value-break_start_at))/60)::integer
      where id=p_break_id and time_entry_id=p_time_entry_id and organization_id=v_org;
    update public.time_entries set status='edited',clock_status='admin_edited'
      where id=p_time_entry_id and organization_id=v_org;
  else
    raise exception 'Unsupported correction field';
  end if;
  if not found then raise exception 'Time entry or break not found'; end if;
  insert into public.time_entry_edits(
    organization_id,time_entry_id,changed_by,field_name,old_value,new_value,reason
  ) values(v_org,p_time_entry_id,auth.uid(),p_field_name,v_old,p_new_value::text,trim(p_reason));
  insert into public.activity_logs(organization_id,actor_id,action,entity_type,entity_id,old_values,new_values)
    values(v_org,auth.uid(),'edited_time_entry','time_entry',p_time_entry_id,
      jsonb_build_object(p_field_name,v_old),
      jsonb_build_object(p_field_name,p_new_value::text,'reason',trim(p_reason)));
end;
$$;

create or replace function public.change_employee_pay_rate(
  p_user_id uuid, p_hourly_rate numeric, p_effective_from date
) returns public.employee_pay_rates
language plpgsql security definer set search_path = public
as $$
declare v_org uuid:=public.current_organization_id(); v_rate public.employee_pay_rates%rowtype;
begin
  if not (public.has_role('super_admin') or public.has_role('admin')) then
    raise exception 'Forbidden';
  end if;
  if p_hourly_rate < 0 then raise exception 'Invalid hourly rate'; end if;
  perform pg_advisory_xact_lock(hashtext(p_user_id::text));
  if not exists(select 1 from public.profiles where id=p_user_id and organization_id=v_org)
    then raise exception 'Employee not found'; end if;
  update public.employee_pay_rates set effective_to=p_effective_from-1
    where organization_id=v_org and user_id=p_user_id
      and effective_from<p_effective_from and effective_to is null;
  insert into public.employee_pay_rates(
    organization_id,user_id,hourly_rate,effective_from,created_by
  ) values(v_org,p_user_id,p_hourly_rate,p_effective_from,auth.uid())
  returning * into v_rate;
  if p_effective_from <=
    (timezone(coalesce((select timezone from public.organizations where id=v_org),'UTC'),now()))::date
  then update public.profiles set hourly_rate=p_hourly_rate,pay_type='hourly'
    where id=p_user_id and organization_id=v_org;
  end if;
  insert into public.activity_logs(organization_id,actor_id,action,entity_type,entity_id,new_values)
    values(v_org,auth.uid(),'changed_pay_rate','profile',p_user_id,
      jsonb_build_object('hourly_rate',p_hourly_rate,'effective_from',p_effective_from));
  return v_rate;
end;
$$;

alter table public.employee_pay_rates enable row level security;
alter table public.time_entries enable row level security;
alter table public.time_breaks enable row level security;
alter table public.time_entry_edits enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select_own_or_admin on public.profiles for select using (
  organization_id=public.current_organization_id()
  and (id=auth.uid() or public.is_staff_manager())
);

drop policy if exists shifts_select on public.shifts;
create policy shifts_select_own_or_manager on public.shifts for select using (
  organization_id=public.current_organization_id() and (
    public.is_staff_manager()
    or exists(select 1 from public.shift_assignments a
      where a.shift_id=shifts.id and a.user_id=auth.uid() and a.status <> 'removed')
    or (is_open and status='published')
  )
);

create policy time_entries_select_own_or_admin on public.time_entries for select using (
  organization_id=public.current_organization_id()
  and (user_id=auth.uid() or public.has_role('super_admin') or public.has_role('admin'))
);
create policy time_entries_admin_update on public.time_entries for update using (
  organization_id=public.current_organization_id()
  and (public.has_role('super_admin') or public.has_role('admin'))
);

create policy time_breaks_select_own_or_admin on public.time_breaks for select using (
  organization_id=public.current_organization_id()
  and (user_id=auth.uid() or public.has_role('super_admin') or public.has_role('admin'))
);
create policy time_breaks_admin_update on public.time_breaks for update using (
  organization_id=public.current_organization_id()
  and (public.has_role('super_admin') or public.has_role('admin'))
);

create policy pay_rates_select_own_or_admin on public.employee_pay_rates for select using (
  organization_id=public.current_organization_id()
  and (user_id=auth.uid() or public.has_role('super_admin') or public.has_role('admin'))
);
create policy pay_rates_admin_write on public.employee_pay_rates for all using (
  organization_id=public.current_organization_id()
  and (public.has_role('super_admin') or public.has_role('admin'))
) with check (
  organization_id=public.current_organization_id()
  and (public.has_role('super_admin') or public.has_role('admin'))
);

create policy time_entry_edits_select_own_or_admin on public.time_entry_edits for select using (
  organization_id=public.current_organization_id()
  and (exists(select 1 from public.time_entries e
    where e.id=time_entry_id and e.user_id=auth.uid())
    or public.has_role('super_admin') or public.has_role('admin'))
);
create policy time_entry_edits_admin_insert on public.time_entry_edits for insert with check (
  organization_id=public.current_organization_id()
  and changed_by=auth.uid()
  and (public.has_role('super_admin') or public.has_role('admin'))
);

grant execute on function public.clock_in(uuid,numeric,numeric,numeric) to authenticated;
grant execute on function public.start_break(numeric,numeric,numeric) to authenticated;
grant execute on function public.end_break(numeric,numeric,numeric) to authenticated;
grant execute on function public.clock_out(numeric,numeric,numeric) to authenticated;
grant execute on function public.correct_time_entry(uuid,uuid,text,timestamptz,text) to authenticated;
grant execute on function public.change_employee_pay_rate(uuid,numeric,date) to authenticated;

-- Add the employee role independently from employee_type.
insert into public.roles(organization_id,name,slug,description,is_system)
select id,'Staff','staff','General employee self-service access',true
from public.organizations
on conflict (organization_id,slug) do nothing;

insert into public.permissions(key,name,module) values
  ('time_clock.use','Use own time clock','time_clock'),
  ('time_clock.read_own','View own clock history','time_clock'),
  ('time_clock.manage','Manage employee time entries','time_clock'),
  ('pay.read_own','View own estimated earnings','pay'),
  ('pay.manage','Manage employee pay rates','pay')
on conflict (key) do nothing;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.slug in ('super_admin','admin')
  and p.key in ('time_clock.use','time_clock.read_own','time_clock.manage','pay.read_own','pay.manage')
on conflict do nothing;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.slug in ('instructor','staff')
  and p.key in ('schedules.read','time_clock.use','time_clock.read_own','pay.read_own')
on conflict do nothing;
