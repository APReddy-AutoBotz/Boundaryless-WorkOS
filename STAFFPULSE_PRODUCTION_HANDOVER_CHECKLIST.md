# StaffPulse Production Core Handover Checklist

Use this checklist for the first company production handover. Teams, leave management, Entra SSO, notification delivery, billing, AI, and Kanban/task management are outside this release.

## 1. Environment

- Company-owned `DATABASE_URL` is configured in the hosting secret manager.
- `API_SESSION_SECRET` is company generated and at least 32 characters.
- `NODE_ENV=production`.
- `APP_MODE=production`.
- `DISABLE_DEMO_FALLBACK=true`.
- `AUTO_SEED_DEMO=false` for any database containing real records.
- `APP_URL` matches the final HTTPS URL.

## 2. Release Checks

- `npm run lint` passes.
- `npm run build` passes.
- `npm run test:backend` passes.
- `npm run test:access` passes.
- `npm run test:requirements` passes.
- `npm run test:import-templates` passes.
- `npm run test:prod-hardening` passes.
- Hosted backend smoke tests pass with `BACKEND_SMOKE_BASE_URL` set.

## 3. Data Load

- Catalogs, Country Directors, employees, users, clients, projects, allocations, and optional historical timesheets are loaded in the documented order.
- Demo records are removed or clearly isolated from company records.
- Reporting manager, standard weekly hours, capacity type, contract type, and utilization eligibility are populated for active employees.
- Data quality report is reviewed and blockers are assigned.

## 4. Role UAT

- Admin, HR, Country Director, Project Manager, Team Lead, and Employee journeys are tested in backend mode.
- Multi-role accounts are tested to confirm only the selected active role authorizes backend actions.
- Scoped reads and writes are tested for PM and Country Director users.

## 5. Operations

- Backup frequency, retention, owner, and restore process are approved.
- At least one restore test is completed before go-live.
- Application and database health monitoring ownership is assigned.
- Support owner and escalation channel are documented.
- Rollback owner and release decision maker are documented.
