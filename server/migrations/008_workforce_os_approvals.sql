create table if not exists approval_records (
  id text primary key default ('approval-' || gen_random_uuid()::text),
  entity_type text not null,
  entity_id text not null,
  subject_employee_id text references employees(id) on delete set null,
  requester_id text,
  requester_name text,
  approver_id text,
  approver_name text,
  approver_role text,
  active_role text,
  status text not null default 'Pending' check (status in ('Pending', 'Approved', 'Rejected', 'Cancelled')),
  comments text,
  source text not null default 'Web',
  audit_log_id uuid references audit_logs(id) on delete set null,
  due_at timestamptz,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entity_type, entity_id)
);

create table if not exists approval_delegations (
  id text primary key default ('approval-delegation-' || gen_random_uuid()::text),
  delegator_id text not null references employees(id) on delete cascade,
  delegate_id text not null references employees(id) on delete cascade,
  role text not null,
  start_date date not null,
  end_date date not null,
  status text not null default 'Active' check (status in ('Active', 'Inactive')),
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create index if not exists idx_approval_records_status on approval_records(status);
create index if not exists idx_approval_records_entity on approval_records(entity_type, entity_id);
create index if not exists idx_approval_records_subject on approval_records(subject_employee_id);
create index if not exists idx_approval_records_due on approval_records(due_at);
create index if not exists idx_approval_delegations_delegate_dates on approval_delegations(delegate_id, start_date, end_date);

insert into approval_records (
  entity_type, entity_id, subject_employee_id, requester_id, requester_name, status, source, due_at, created_at, updated_at
)
select
  'Timesheet',
  t.id::text,
  t.employee_id,
  t.employee_id,
  e.name,
  'Pending',
  'System',
  t.submitted_at + interval '2 days',
  coalesce(t.submitted_at, t.created_at),
  now()
from timesheets t
join employees e on e.id = t.employee_id
where t.status = 'Submitted'
on conflict (entity_type, entity_id) do nothing;

insert into approval_records (
  entity_type, entity_id, subject_employee_id, requester_id, requester_name, status, source, due_at, created_at, updated_at
)
select
  'LeaveRequest',
  lr.id,
  lr.employee_id,
  lr.employee_id,
  e.name,
  'Pending',
  'System',
  lr.submitted_at + interval '2 days',
  coalesce(lr.submitted_at, lr.created_at),
  now()
from leave_requests lr
join employees e on e.id = lr.employee_id
where lr.status = 'Submitted'
on conflict (entity_type, entity_id) do nothing;
