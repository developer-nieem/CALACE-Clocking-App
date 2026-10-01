-- Demo seed for CAL ACE Team
-- Safe to re-run on an empty project. Uses fixed UUIDs so the app demo data stays aligned.

-- Organization
insert into public.organizations (id, name, slug, timezone, settings)
values (
  '00000000-0000-0000-0000-000000000001',
  'CAL ACE Team',
  'cal-ace',
  'America/Los_Angeles',
  '{"clock_in_grace_minutes":15,"overtime_weekly_hours":40}'::jsonb
)
on conflict (id) do nothing;

insert into public.settings (organization_id, clock_in_grace_minutes, overtime_weekly_hours)
values ('00000000-0000-0000-0000-000000000001', 15, 40)
on conflict (organization_id) do nothing;

-- System roles (org-scoped copies for CAL ACE)
insert into public.roles (id, organization_id, name, slug, description, is_system) values
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000001', 'Super Admin', 'super_admin', 'Full access to every module', true),
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000001', 'Admin', 'admin', 'Manages instructors, schedules, approvals, and communication', true),
  ('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000001', 'Scheduler', 'scheduler', 'Creates and publishes instructor schedules', true),
  ('00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000000001', 'Instructor', 'instructor', 'Views own schedule, clocks in, and manages personal requests', true)
on conflict (id) do nothing;

insert into public.permissions (id, key, name, module) values
  ('10000000-0000-0000-0000-000000000001', 'users.read', 'View users', 'users'),
  ('10000000-0000-0000-0000-000000000002', 'users.manage', 'Manage users', 'users'),
  ('10000000-0000-0000-0000-000000000003', 'users.invite', 'Invite users', 'users'),
  ('10000000-0000-0000-0000-000000000004', 'schedules.read', 'View schedules', 'schedule'),
  ('10000000-0000-0000-0000-000000000005', 'schedules.manage', 'Create and edit schedules', 'schedule'),
  ('10000000-0000-0000-0000-000000000006', 'schedules.publish', 'Publish schedules', 'schedule'),
  ('10000000-0000-0000-0000-000000000007', 'schedules.override_warnings', 'Override scheduling warnings', 'schedule'),
  ('10000000-0000-0000-0000-000000000008', 'availability.read_all', 'View all availability', 'availability'),
  ('10000000-0000-0000-0000-000000000009', 'time_off.approve', 'Approve time off', 'time_off'),
  ('10000000-0000-0000-0000-000000000010', 'shift_trades.approve', 'Approve shift trades', 'shift_trades'),
  ('10000000-0000-0000-0000-000000000011', 'open_shifts.manage', 'Manage open shifts', 'open_shifts'),
  ('10000000-0000-0000-0000-000000000012', 'open_shifts.approve', 'Approve open shift claims', 'open_shifts'),
  ('10000000-0000-0000-0000-000000000013', 'tasks.manage', 'Manage tasks', 'tasks'),
  ('10000000-0000-0000-0000-000000000014', 'time_clock.view_all', 'View all time clocks', 'time_clock'),
  ('10000000-0000-0000-0000-000000000015', 'timesheets.manage', 'Edit timesheets', 'timesheets'),
  ('10000000-0000-0000-0000-000000000016', 'attendance.read', 'View attendance', 'attendance'),
  ('10000000-0000-0000-0000-000000000017', 'reports.read', 'View reports', 'reports'),
  ('10000000-0000-0000-0000-000000000018', 'settings.manage', 'Manage settings', 'settings'),
  ('10000000-0000-0000-0000-000000000019', 'chat.use', 'Use staff chat', 'chat')
on conflict (key) do nothing;

-- Super admin: all permissions
insert into public.role_permissions (role_id, permission_id)
select '00000000-0000-0000-0000-000000000101', id from public.permissions
on conflict do nothing;

-- Admin: all except maybe nothing extra in phase 1
insert into public.role_permissions (role_id, permission_id)
select '00000000-0000-0000-0000-000000000102', id from public.permissions
on conflict do nothing;

-- Scheduler
insert into public.role_permissions (role_id, permission_id)
select '00000000-0000-0000-0000-000000000103', id from public.permissions
where key in (
  'users.read',
  'schedules.read',
  'schedules.manage',
  'schedules.publish',
  'availability.read_all',
  'open_shifts.manage',
  'attendance.read',
  'chat.use'
)
on conflict do nothing;

-- Instructor
insert into public.role_permissions (role_id, permission_id)
select '00000000-0000-0000-0000-000000000104', id from public.permissions
where key in ('schedules.read', 'chat.use')
on conflict do nothing;

insert into public.locations (id, organization_id, name, address) values
  ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000001', 'CAL ACE Main Campus', 'Los Angeles, CA'),
  ('00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000001', 'Clinical Site A', 'Los Angeles, CA'),
  ('00000000-0000-0000-0000-000000000303', '00000000-0000-0000-0000-000000000001', 'Clinical Site B', 'Los Angeles, CA')
on conflict (id) do nothing;

insert into public.departments (id, organization_id, name) values
  ('00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000001', 'Nursing Education'),
  ('00000000-0000-0000-0000-000000000402', '00000000-0000-0000-0000-000000000001', 'Clinical Programs'),
  ('00000000-0000-0000-0000-000000000403', '00000000-0000-0000-0000-000000000001', 'Administration')
on conflict (id) do nothing;

insert into public.positions (id, organization_id, name) values
  ('00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000001', 'Clinical Instructor'),
  ('00000000-0000-0000-0000-000000000502', '00000000-0000-0000-0000-000000000001', 'Theory Instructor'),
  ('00000000-0000-0000-0000-000000000503', '00000000-0000-0000-0000-000000000001', 'RN Instructor'),
  ('00000000-0000-0000-0000-000000000504', '00000000-0000-0000-0000-000000000001', 'LVN Instructor'),
  ('00000000-0000-0000-0000-000000000505', '00000000-0000-0000-0000-000000000001', 'Scheduler'),
  ('00000000-0000-0000-0000-000000000506', '00000000-0000-0000-0000-000000000001', 'Administrator')
on conflict (id) do nothing;

insert into public.qualifications (id, organization_id, name, slug) values
  ('00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000001', 'CNA Instructor', 'cna-instructor'),
  ('00000000-0000-0000-0000-000000000602', '00000000-0000-0000-0000-000000000001', 'RN', 'rn'),
  ('00000000-0000-0000-0000-000000000603', '00000000-0000-0000-0000-000000000001', 'LVN', 'lvn'),
  ('00000000-0000-0000-0000-000000000604', '00000000-0000-0000-0000-000000000001', 'DSD', 'dsd'),
  ('00000000-0000-0000-0000-000000000605', '00000000-0000-0000-0000-000000000001', 'Clinical Instructor', 'clinical-instructor'),
  ('00000000-0000-0000-0000-000000000606', '00000000-0000-0000-0000-000000000001', 'Theory Instructor', 'theory-instructor')
on conflict (id) do nothing;

insert into public.smart_groups (id, organization_id, name, description, is_system, rules) values
  ('00000000-0000-0000-0000-000000000701', '00000000-0000-0000-0000-000000000001', 'All Instructors', 'Every active instructor', true, '[{"field":"role","op":"eq","value":"instructor"},{"field":"status","op":"eq","value":"active"}]'::jsonb),
  ('00000000-0000-0000-0000-000000000702', '00000000-0000-0000-0000-000000000001', 'Clinical Instructors', 'Instructors with the Clinical Instructor qualification', true, '[{"field":"qualification","op":"eq","value":"clinical-instructor"},{"field":"status","op":"eq","value":"active"}]'::jsonb),
  ('00000000-0000-0000-0000-000000000703', '00000000-0000-0000-0000-000000000001', 'Theory Instructors', 'Instructors with the Theory Instructor qualification', true, '[{"field":"qualification","op":"eq","value":"theory-instructor"},{"field":"status","op":"eq","value":"active"}]'::jsonb),
  ('00000000-0000-0000-0000-000000000704', '00000000-0000-0000-0000-000000000001', 'Main Campus', 'Staff assigned to CAL ACE Main Campus', true, '[{"field":"location","op":"eq","value":"00000000-0000-0000-0000-000000000301"}]'::jsonb)
on conflict (id) do nothing;

insert into public.shift_templates (id, organization_id, name, title, start_time, end_time, location_id, department_id, class_cohort, color, required_instructors) values
  ('00000000-0000-0000-0000-000000000801', '00000000-0000-0000-0000-000000000001', 'CNA Morning Class', 'CNA Theory - Morning', '09:00', '13:00', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000401', 'CNA Cohort A', '#0D2A43', 1),
  ('00000000-0000-0000-0000-000000000802', '00000000-0000-0000-0000-000000000001', 'CNA Evening Class', 'CNA Theory - Evening', '17:00', '21:00', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000401', 'CNA Cohort B', '#D8B53C', 1),
  ('00000000-0000-0000-0000-000000000803', '00000000-0000-0000-0000-000000000001', 'Clinical Rotation', 'Clinical Rotation', '07:00', '15:00', '00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000402', 'CNA Clinical', '#1F6F8B', 1)
on conflict (id) do nothing;

-- Auth users must be created with the Supabase Admin API or Dashboard.
-- After those users exist with the IDs below, the public.profiles rows will match.
-- See README and scripts/seed-auth.mjs.
