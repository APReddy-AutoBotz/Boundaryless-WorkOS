create table if not exists leave_types (
  id text primary key default ('leave-type-' || gen_random_uuid()::text),
  code text not null unique,
  name text not null,
  paid boolean not null default true,
  requires_approval boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists leave_policies (
  id text primary key default ('leave-policy-' || gen_random_uuid()::text),
  name text not null,
  country text not null default 'Global',
  annual_allowance_days numeric not null default 0,
  carry_forward_days numeric not null default 0,
  accrual_method text not null default 'Annual',
  status text not null default 'Active' check (status in ('Active', 'Inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists leave_policy_types (
  policy_id text not null references leave_policies(id) on delete cascade,
  leave_type_id text not null references leave_types(id) on delete restrict,
  primary key (policy_id, leave_type_id)
);

create table if not exists holiday_calendars (
  id text primary key default ('holiday-calendar-' || gen_random_uuid()::text),
  name text not null,
  country text not null default 'Global',
  calendar_year integer not null,
  status text not null default 'Active' check (status in ('Active', 'Inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (country, calendar_year, name)
);

create table if not exists holidays (
  id text primary key default ('holiday-' || gen_random_uuid()::text),
  calendar_id text not null references holiday_calendars(id) on delete cascade,
  name text not null,
  holiday_date date not null,
  holiday_type text not null default 'Public',
  unique (calendar_id, holiday_date, name)
);

create table if not exists leave_balances (
  id text primary key default ('leave-balance-' || gen_random_uuid()::text),
  employee_id text not null references employees(id) on delete cascade,
  leave_type_id text not null references leave_types(id) on delete restrict,
  policy_id text references leave_policies(id) on delete set null,
  balance_year integer not null,
  opening_days numeric not null default 0,
  accrued_days numeric not null default 0,
  used_days numeric not null default 0,
  adjusted_days numeric not null default 0,
  pending_days numeric not null default 0,
  available_days numeric not null default 0,
  updated_at timestamptz not null default now(),
  unique (employee_id, leave_type_id, balance_year)
);

create table if not exists leave_requests (
  id text primary key default ('leave-request-' || gen_random_uuid()::text),
  employee_id text not null references employees(id) on delete restrict,
  leave_type_id text not null references leave_types(id) on delete restrict,
  start_date date not null,
  end_date date not null,
  total_days numeric not null,
  status text not null default 'Submitted' check (status in ('Draft', 'Submitted', 'Approved', 'Rejected', 'Cancelled')),
  reason text,
  approver_id text,
  approver_name text,
  comments text,
  submitted_at timestamptz,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date),
  check (total_days >= 0)
);

create index if not exists idx_leave_requests_employee_dates on leave_requests(employee_id, start_date, end_date);
create index if not exists idx_leave_requests_status on leave_requests(status);
create index if not exists idx_leave_balances_employee_year on leave_balances(employee_id, balance_year);
create index if not exists idx_holiday_calendars_country_year on holiday_calendars(country, calendar_year);

insert into leave_types(id, code, name, paid, requires_approval, active)
values
  ('leave-type-annual', 'ANNUAL', 'Annual Leave', true, true, true),
  ('leave-type-sick', 'SICK', 'Sick Leave', true, true, true),
  ('leave-type-unpaid', 'UNPAID', 'Unpaid Leave', false, true, true)
on conflict (id) do nothing;

insert into leave_policies(id, name, country, annual_allowance_days, carry_forward_days, accrual_method, status)
values ('leave-policy-global', 'Global Standard Leave Policy', 'Global', 24, 5, 'Annual', 'Active')
on conflict (id) do nothing;

insert into leave_policy_types(policy_id, leave_type_id)
select 'leave-policy-global', id
from leave_types
where id in ('leave-type-annual', 'leave-type-sick', 'leave-type-unpaid')
on conflict do nothing;

insert into holiday_calendars(id, name, country, calendar_year, status)
values (
  'holiday-global-' || extract(year from current_date)::int,
  'Global Company Calendar ' || extract(year from current_date)::int,
  'Global',
  extract(year from current_date)::int,
  'Active'
)
on conflict do nothing;

insert into holidays(id, calendar_id, name, holiday_date, holiday_type)
values
  (
    'holiday-global-' || extract(year from current_date)::int || '-new-year',
    'holiday-global-' || extract(year from current_date)::int,
    'New Year Holiday',
    make_date(extract(year from current_date)::int, 1, 1),
    'Company'
  ),
  (
    'holiday-global-' || extract(year from current_date)::int || '-year-end',
    'holiday-global-' || extract(year from current_date)::int,
    'Year End Holiday',
    make_date(extract(year from current_date)::int, 12, 25),
    'Company'
  )
on conflict do nothing;

insert into leave_balances(employee_id, leave_type_id, policy_id, balance_year, accrued_days, available_days)
select e.id, 'leave-type-annual', 'leave-policy-global', extract(year from current_date)::int, 24, 24
from employees e
where e.status <> 'Exited'
on conflict (employee_id, leave_type_id, balance_year) do nothing;
