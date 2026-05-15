create table if not exists notification_events (
  id text primary key default ('notification-' || gen_random_uuid()::text),
  recipient_employee_id text references employees(id) on delete set null,
  event_type text not null,
  title text not null,
  body text not null,
  entity_type text,
  entity_id text,
  severity text not null default 'Info',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists notification_templates (
  id text primary key default ('notification-template-' || gen_random_uuid()::text),
  event_type text not null,
  channel text not null check (channel in ('InApp', 'Email', 'Teams')),
  subject text not null,
  body text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_type, channel)
);

create table if not exists notification_preferences (
  id text primary key default ('notification-preference-' || gen_random_uuid()::text),
  employee_id text not null references employees(id) on delete cascade,
  event_type text not null,
  in_app boolean not null default true,
  email boolean not null default false,
  teams boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (employee_id, event_type)
);

create table if not exists notification_delivery_attempts (
  id text primary key default ('notification-delivery-' || gen_random_uuid()::text),
  notification_id text not null references notification_events(id) on delete cascade,
  channel text not null check (channel in ('InApp', 'Email', 'Teams')),
  provider text not null default 'mock',
  status text not null default 'Delivered' check (status in ('Pending', 'Delivered', 'Failed')),
  response_metadata jsonb,
  attempted_at timestamptz not null default now()
);

create index if not exists idx_notification_events_recipient_created on notification_events(recipient_employee_id, created_at desc);
create index if not exists idx_notification_events_read on notification_events(read_at);
create index if not exists idx_notification_delivery_status on notification_delivery_attempts(status, attempted_at desc);

insert into notification_templates(id, event_type, channel, subject, body, active)
values
  ('notification-template-approval-requested', 'ApprovalRequested', 'InApp', 'Approval requested', 'A workforce approval item is waiting for review.', true),
  ('notification-template-approval-decided', 'ApprovalDecided', 'InApp', 'Approval updated', 'A workforce approval item has been decided.', true)
on conflict (event_type, channel) do nothing;
