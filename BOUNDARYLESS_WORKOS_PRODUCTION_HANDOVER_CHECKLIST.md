# Boundaryless-WorkOS Production Core Handover Checklist

Use this checklist for the company production handover. Production Core remains mandatory; Workforce OS modules such as leave are enabled only after their feature flag, role UAT, and operational evidence are complete. Teams, Entra SSO, and notification delivery stay adapter-ready until company credentials are supplied. Billing, AI, and Kanban/task management are outside this release.

## 1. Environment

- Company-owned `DATABASE_URL` is configured in the hosting secret manager.
- `API_SESSION_SECRET` is company generated and at least 32 characters.
- `NODE_ENV=production`.
- `APP_MODE=production`.
- `DISABLE_DEMO_FALLBACK=true`.
- `AUTO_SEED_DEMO=false` for any database containing real records.
- `FEATURE_LEAVE` / `VITE_FEATURE_LEAVE` are enabled only after Phase 2 leave UAT is approved.
- `FEATURE_NOTIFICATIONS`, `FEATURE_TEAMS`, `FEATURE_ENTRA`, and `FEATURE_PLANNING` remain disabled until their phases pass UAT.
- `APP_URL` matches the final HTTPS URL.

## 2. Release Checks

- `npm run lint` passes.
- `npm run build` passes.
- `npm run test:backend` passes.
- `npm run test:access` passes.
- `npm run test:leave` passes if `FEATURE_LEAVE=true`.
- `npm run test:requirements` passes.
- `npm run test:import-templates` passes.
- `npm run test:prod-hardening` passes.
- Hosted backend smoke tests pass with `BACKEND_SMOKE_BASE_URL` set.

## 3. Data Load

- Catalogs, Country Directors, employees, users, clients, projects, allocations, and optional historical timesheets are loaded in the documented order.
- Demo records are removed or clearly isolated from company records.
- Reporting manager, standard weekly hours, capacity type, contract type, and utilization eligibility are populated for active employees.
- Leave policies, holiday calendars, annual balances, and approval owners are loaded before enabling `FEATURE_LEAVE`.
- Data quality report is reviewed and blockers are assigned.
- Availability report is reviewed after approved leave and holiday data are loaded.
- Production exports are sampled from Employee Master, utilization, timesheet governance, and audit trail; matching backend audit events are verified.

## 4. Role UAT

- Admin, HR, Country Director, Project Manager, Team Lead, and Employee journeys are tested in backend mode.
- Multi-role accounts are tested to confirm only the selected active role authorizes backend actions.
- Scoped reads and writes are tested for PM and Country Director users.
- If `FEATURE_LEAVE=true`, ESS, My Leave, Team Leave Calendar, Leave Administration, balance impact, availability impact, and leave audit entries are tested for every approved role.

## 5. Operations

- Backup frequency, retention, owner, and restore process are approved.
- At least one restore test is completed before go-live.
- Application and database health monitoring ownership is assigned.
- Support owner and escalation channel are documented.
- Rollback owner and release decision maker are documented.
