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
