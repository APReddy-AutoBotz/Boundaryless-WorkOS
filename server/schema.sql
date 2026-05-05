create extension if not exists "pgcrypto";

create table if not exists roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  employee_id text unique,
  email text not null unique,
  password_hash text,
  status text not null default 'Active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists user_roles (
  user_id uuid not null references users(id) on delete cascade,
  role_id uuid not null references roles(id) on delete restrict,
  primary key (user_id, role_id)
);

create table if not exists country_directors (
  id text primary key,
  name text not null,
  region text not null
);

create table if not exists role_definitions (
  id text primary key,
  name text not null unique,
  department text not null,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists catalog_items (
  id text primary key,
  catalog_type text not null check (catalog_type in ('departments', 'countries', 'industries')),
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (catalog_type, name)
);

create table if not exists clients (
  id text primary key default ('client-' || gen_random_uuid()::text),
  name text not null unique,
  industry text not null default 'Unclassified',
  account_owner_id text,
  status text not null default 'Active' check (status in ('Active', 'Inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists client_country_director_map (
  client_id text not null references clients(id) on delete cascade,
  country_director_id text not null references country_directors(id) on delete restrict,
  primary key (client_id, country_director_id)
);

create table if not exists employees (
  id text primary key default ('e-' || gen_random_uuid()::text),
  employee_id text not null unique,
  name text not null,
  email text not null unique,
  designation text not null,
  department text not null,
  country text not null,
  primary_country_director_id text not null references country_directors(id),
  status text not null check (status in ('Active', 'On Leave', 'Exited')),
  expected_weekly_hours numeric,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists employee_country_director_map (
  employee_id text not null references employees(id) on delete cascade,
  country_director_id text not null references country_directors(id) on delete restrict,
  primary key (employee_id, country_director_id)
);

create table if not exists projects (
  id text primary key default ('p-' || gen_random_uuid()::text),
  project_code text not null unique,
  name text not null,
  client_id text references clients(id) on delete restrict,
  client text not null,
  manager_id text,
  manager_name text not null,
  project_type text,
  billable boolean not null default true,
  start_date date not null,
  end_date date not null,
  status text not null check (status in ('Proposed', 'Active', 'On Hold', 'Completed')),
  country text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create table if not exists project_allocations (
  id text primary key default ('a-' || gen_random_uuid()::text),
  employee_id text not null references employees(id) on delete restrict,
  project_id text not null references projects(id) on delete restrict,
  role_on_project text,
  percentage numeric not null check (percentage >= 0 and percentage <= 200),
  start_date date not null,
  end_date date not null,
  billable boolean not null default true,
  status text not null check (status in ('Active', 'Paused', 'Completed')),
  comments text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create table if not exists timesheets (
  id uuid primary key default gen_random_uuid(),
  employee_id text not null references employees(id) on delete restrict,
  week_ending date not null,
  status text not null check (status in ('Draft', 'Submitted', 'Approved', 'Rejected')),
  total_hours numeric not null default 0,
  billable_hours numeric not null default 0,
  rejection_reason text,
  submitted_at timestamptz,
  approved_at timestamptz,
  approved_by text,
  rejected_at timestamptz,
  rejected_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, week_ending)
);

create table if not exists timesheet_entries (
  id uuid primary key default gen_random_uuid(),
  timesheet_id uuid not null references timesheets(id) on delete cascade,
  project_id text references projects(id) on delete restrict,
  work_type text not null check (work_type in ('Project Work', 'Client Misc Task')),
  client_name text,
  category text,
  work_date date not null,
  hours numeric not null check (hours >= 0 and hours <= 24),
  remark text,
  billable boolean not null default true
);

create table if not exists system_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  user_name text not null,
  user_role text not null,
  module text not null,
  action text not null,
  entity_type text,
  entity_id text,
  old_value jsonb,
  new_value jsonb,
  reason text,
  details text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_employee_cd_map_cd on employee_country_director_map(country_director_id);
create index if not exists idx_client_cd_map_cd on client_country_director_map(country_director_id);
create index if not exists idx_catalog_items_type_active on catalog_items(catalog_type, active, name);
create index if not exists idx_projects_client_id on projects(client_id);
create index if not exists idx_allocations_employee_dates on project_allocations(employee_id, start_date, end_date);
create index if not exists idx_allocations_project_dates on project_allocations(project_id, start_date, end_date);
create index if not exists idx_timesheets_employee_week on timesheets(employee_id, week_ending);
create index if not exists idx_timesheets_status on timesheets(status);
create index if not exists idx_audit_logs_created_at on audit_logs(created_at desc);

insert into roles(name)
values ('Employee'), ('TeamLead'), ('ProjectManager'), ('CountryDirector'), ('HR'), ('Admin')
on conflict (name) do nothing;

insert into system_settings(key, value)
values
  ('expectedWeeklyHours', '40'),
  ('utilizationThresholdHigh', '100'),
  ('utilizationThresholdLow', '80'),
  ('benchThreshold', '20'),
  ('blockOverAllocation', 'false')
on conflict (key) do nothing;

insert into catalog_items(id, catalog_type, name)
values
  ('department-1', 'departments', 'Automation CoE'),
  ('department-2', 'departments', 'Business Transformation'),
  ('department-3', 'departments', 'Client Operations'),
  ('department-4', 'departments', 'Data & Analytics'),
  ('department-5', 'departments', 'Delivery Management'),
  ('department-6', 'departments', 'Engineering'),
  ('department-7', 'departments', 'Managed Services'),
  ('department-8', 'departments', 'Operations Excellence'),
  ('department-9', 'departments', 'Quality Engineering'),
  ('department-10', 'departments', 'Support Operations'),
  ('country-1', 'countries', 'Australia'),
  ('country-2', 'countries', 'Belgium'),
  ('country-3', 'countries', 'Canada'),
  ('country-4', 'countries', 'France'),
  ('country-5', 'countries', 'Germany'),
  ('country-6', 'countries', 'India'),
  ('country-7', 'countries', 'Netherlands'),
  ('country-8', 'countries', 'Singapore'),
  ('country-9', 'countries', 'Switzerland'),
  ('country-10', 'countries', 'United Kingdom'),
  ('country-11', 'countries', 'United States'),
  ('industry-1', 'industries', 'Banking'),
  ('industry-2', 'industries', 'Insurance'),
  ('industry-3', 'industries', 'Healthcare'),
  ('industry-4', 'industries', 'Retail'),
  ('industry-5', 'industries', 'Manufacturing'),
  ('industry-6', 'industries', 'Logistics'),
  ('industry-7', 'industries', 'Technology'),
  ('industry-8', 'industries', 'Telecom'),
  ('industry-9', 'industries', 'Energy'),
  ('industry-10', 'industries', 'Public Sector'),
  ('industry-11', 'industries', 'Professional Services')
on conflict (id) do update set
  catalog_type = excluded.catalog_type,
  name = excluded.name,
  active = catalog_items.active,
  updated_at = now();
