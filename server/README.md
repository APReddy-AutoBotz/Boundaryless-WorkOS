# Boundaryless-WorkOS Workforce Operations Core API

This is the production backend starting point for the internal utilization tracker.

## Environment

Create `.env.local` or production environment variables:

```text
API_PORT=4000
APP_URL=http://localhost:3000
API_SESSION_SECRET=replace-with-a-long-random-secret
API_SESSION_TTL_HOURS=8
LOGIN_RATE_LIMIT=8
DEMO_SEED_PASSWORD=demo123
DATABASE_URL=postgres://user:password@localhost:5432/resource_tracker
PGSSLMODE=disable
SERVE_STATIC=false
```

## Database Setup

Run the schema against PostgreSQL:

```bash
npm run api:migrate
```

The migration command creates a `schema_migrations` table and records the current `002_catalogs_and_production_parity` migration after applying `server/schema.sql`. The schema remains idempotent for local setup, but production environments should use the migration command so version history is tracked.

For UAT or training environments, load the same realistic demo data into PostgreSQL:

```bash
npm run api:seed:demo
```

To intentionally replace existing demo/UAT rows first:

```bash
npm run api:seed:demo -- --reset
```

The seed creates Country Directors, clients, employees, projects, allocations, timesheets, catalogs, role definitions, user accounts, and user-role mappings. The default seeded password is `demo123`, or `DEMO_SEED_PASSWORD` if provided.

## API

Start the API:

```bash
npm run api:dev
```

Start the single-process production server after `npm run build`:

```bash
npm start
```

Production startup requires `DATABASE_URL` and a non-default `API_SESSION_SECRET`; the server exits early if either is unsafe. In production, Express serves the built `dist/` frontend after API routes.

Implemented starter routes:

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/health`
- `POST /api/auth/change-password`
- `POST /api/users/:id/password-reset`
- `GET /api/employees`
- `POST /api/employees`
- `DELETE /api/employees/:id`
- `GET /api/projects`
- `POST /api/projects`
- `PATCH /api/projects/:id/status`
- `GET /api/allocations`
- `POST /api/allocations`
- `DELETE /api/allocations/:id`
- `GET /api/timesheets`
- `POST /api/timesheets`
- `PATCH /api/timesheets/:id/status`
- `GET /api/reports/planned-utilization`
- `GET /api/reports/actual-utilization`
- `GET /api/reports/forecast-utilization`
- `GET /api/settings`
- `GET /api/catalogs/:catalogType`
- `POST /api/catalogs/:catalogType`
- `DELETE /api/catalogs/:catalogType/:id`
- `GET /api/audit-logs`
- `GET /api/import-export-logs`
- `POST /api/import-export-logs`
- `POST /api/imports/employees/apply`
- `POST /api/imports/clients/apply`
- `POST /api/imports/projects/apply`
- `POST /api/imports/allocations/apply`
- `POST /api/imports/timesheets/apply`

User passwords are stored as `scrypt$salt$hexKey` in the `users.password_hash` column. Login returns a signed session token and also sets an HTTP-only `rut_session` cookie. Protected API routes require either the cookie or an `Authorization: Bearer <token>` header. `API_SESSION_TTL_HOURS` controls both signed-token expiry and cookie `maxAge`, defaulting to 8 hours. Users can change their own password, and Admin/HR can reset a user's password with a one-time temporary value through the backend password lifecycle endpoints.

The server now enforces starter role checks:

- Employees: Admin, HR, CountryDirector, TeamLead
- Projects and allocations: Admin, HR, CountryDirector, ProjectManager
- Timesheets: Admin, HR, CountryDirector, ProjectManager, TeamLead, Employee
- Settings, country directors, and role definitions: Admin, HR where write access is required
- Audit logs: Admin only

The write endpoints include starter production guardrails:

- Projects must reference active clients and non-exited project managers.
- Project close is a soft close and completes active allocations.
- Allocations must reference non-exited employees and active/proposed projects, stay inside the project timeline, and respect optional over-allocation blocking.
- Project Managers can write allocations only on their own projects.
- Country Directors can write allocations only for scoped employees.
- Timesheets cannot be saved or submitted for future weeks or future-dated entries.
- Employees can submit only their own timesheets and cannot directly approve them.
- Timesheet approval/rejection requires submitted status; rejection requires a reason.
- Utilization report endpoints apply the same backend employee visibility scope as role-based employee/project access and return server-side planned, actual, and forecast rows with KPI summaries.
- Employee import apply runs as a backend transaction, validates Country Director references, upserts employee records and mappings, provisions/updates the login account, audits each row, and writes import history.
- Password change/reset uses the same scrypt hashing path as login, supports a configurable `PASSWORD_MIN_LENGTH`, marks reset accounts for password change, and writes audit records.
- Employee deactivation is soft, disables the linked login account, and completes active allocations.
- Country Director and role definition deletes are guarded when scope mappings, employees, or allocations still reference them.
- Department, country, and industry catalogs are PostgreSQL-backed, audited, and blocked from deactivation while referenced by employees, roles, or clients.
- Login attempts are throttled per username/IP window to reduce brute-force exposure.
- Session lifetime is configurable through `API_SESSION_TTL_HOURS` and is returned as `sessionExpiresAt` during login and active-role switching.

The local demo UI can still use seeded demo accounts for offline evaluation, but production deployments should create named users in PostgreSQL and rotate demo data out.

The React app uses the backend automatically when `/api/health` reports a connected database. Set `APP_MODE=production` and `DISABLE_DEMO_FALLBACK=true` for production so localStorage demo data cannot be used as a fallback.
