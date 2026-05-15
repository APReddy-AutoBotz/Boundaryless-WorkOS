create table if not exists identity_provider_links (
  id text primary key default ('identity-link-' || gen_random_uuid()::text),
  employee_id text not null references employees(id) on delete cascade,
  provider text not null default 'entra',
  provider_subject text not null,
  provider_upn text,
  status text not null default 'Linked' check (status in ('Linked', 'Pending', 'Disabled')),
  linked_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_subject),
  unique (employee_id, provider)
);

create table if not exists entra_group_role_mappings (
  id text primary key default ('entra-role-map-' || gen_random_uuid()::text),
  group_id text not null unique,
  group_name text not null,
  role_name text not null check (role_name in ('Employee', 'TeamLead', 'ProjectManager', 'CountryDirector', 'HR', 'Admin')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists teams_user_links (
  id text primary key default ('teams-link-' || gen_random_uuid()::text),
  employee_id text not null references employees(id) on delete cascade,
  teams_user_id text not null unique,
  teams_upn text,
  teams_tenant_id text,
  status text not null default 'Linked' check (status in ('Linked', 'Pending', 'Disabled')),
  linked_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id)
);

create table if not exists teams_action_tokens (
  id text primary key default ('teams-action-' || gen_random_uuid()::text),
  token text not null unique,
  entity_type text not null,
  entity_id text not null,
  action text not null check (action in ('approve', 'reject', 'open_portal')),
  target_url text,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists integration_event_logs (
  id text primary key default ('integration-event-' || gen_random_uuid()::text),
  provider text not null,
  event_type text not null,
  entity_type text,
  entity_id text,
  status text not null default 'Success' check (status in ('Success', 'Failed', 'Pending')),
  request_payload jsonb,
  response_payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_identity_provider_links_employee on identity_provider_links(employee_id);
create index if not exists idx_entra_group_role_mappings_role on entra_group_role_mappings(role_name, active);
create index if not exists idx_teams_user_links_employee on teams_user_links(employee_id);
create index if not exists idx_teams_action_tokens_token on teams_action_tokens(token);
create index if not exists idx_teams_action_tokens_open on teams_action_tokens(expires_at) where used_at is null;
create index if not exists idx_integration_event_logs_created on integration_event_logs(created_at desc);

insert into entra_group_role_mappings(id, group_id, group_name, role_name, active)
values
  ('entra-role-map-employee', 'mock-entra-group-employee', 'Boundaryless WorkOS Employee', 'Employee', true),
  ('entra-role-map-teamlead', 'mock-entra-group-teamlead', 'Boundaryless WorkOS TeamLead', 'TeamLead', true),
  ('entra-role-map-projectmanager', 'mock-entra-group-projectmanager', 'Boundaryless WorkOS ProjectManager', 'ProjectManager', true),
  ('entra-role-map-countrydirector', 'mock-entra-group-countrydirector', 'Boundaryless WorkOS CountryDirector', 'CountryDirector', true),
  ('entra-role-map-hr', 'mock-entra-group-hr', 'Boundaryless WorkOS HR', 'HR', true),
  ('entra-role-map-admin', 'mock-entra-group-admin', 'Boundaryless WorkOS Admin', 'Admin', true)
on conflict (group_id) do nothing;
