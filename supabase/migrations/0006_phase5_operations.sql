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
