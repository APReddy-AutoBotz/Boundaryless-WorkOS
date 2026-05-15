alter table users add column if not exists entra_object_id text;

alter table employees add column if not exists reporting_manager_id text references employees(id) on delete set null;
alter table employees add column if not exists joining_date date;
alter table employees add column if not exists exit_date date;
alter table employees add column if not exists standard_weekly_hours numeric not null default 40;
alter table employees add column if not exists capacity_type text not null default 'Delivery';
alter table employees add column if not exists contract_type text not null default 'Permanent';
alter table employees add column if not exists leave_policy_id text;
alter table employees add column if not exists entra_object_id text;
alter table employees add column if not exists teams_user_id text;

alter table audit_logs add column if not exists active_role text;
alter table audit_logs add column if not exists source text not null default 'Web';
alter table audit_logs add column if not exists ip_address text;
alter table audit_logs add column if not exists session_id text;

create index if not exists idx_employees_reporting_manager on employees(reporting_manager_id);
create index if not exists idx_employees_teams_user_id on employees(teams_user_id);
create index if not exists idx_employees_entra_object_id on employees(entra_object_id);
