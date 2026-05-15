# StaffPulse Production Core Runbook

This runbook covers production-style operation for StaffPulse Workforce Operations Core before and after company-owned infrastructure is available.

## 1. Release Modes

| Mode | Purpose | Data Source | Owner |
|---|---|---|---|
| Local demo | Developer validation and offline walkthroughs | Browser localStorage demo data | Delivery team |
| Render UAT | Leadership demo and controlled UAT | Temporary Supabase/PostgreSQL | Delivery team |
| Company production | Final go-live | Company-owned PostgreSQL/Supabase | Company operations |

Render UAT proves the application path, but it is not company production until the company owns the database, hosting, secrets, monitoring, backup, and support process.

## 2. Required Environment Variables

| Key | Required | Notes |
|---|---:|---|
| `DATABASE_URL` | Yes | Company PostgreSQL or Supabase transaction pooler URL. Keep secret. |
| `PGSSLMODE` | Yes | Use `require` for Supabase and most hosted PostgreSQL providers. |
| `API_SESSION_SECRET` | Yes | Long random secret, at least 32 characters. Do not reuse DB passwords. |
| `NODE_ENV` | Yes | `production` for production deployments. |
| `APP_URL` | Yes | Public/internal HTTPS app URL. Required for CORS and cookie planning. |
| `APP_MODE` | Yes | Use `production` for company production and `demo` only for local demos. |
| `DISABLE_DEMO_FALLBACK` | Yes | Use `true` for company production so localStorage demo data is never used as a fallback. |
| `LOGIN_RATE_LIMIT` | Recommended | Default is `8` attempts per 15-minute window. |
| `AUTO_MIGRATE` | Optional | `true` allows startup migrations. Keep enabled only when operationally approved. |
| `AUTO_SEED_DEMO` | Demo only | Use only for disposable demo databases. Must be `false` for real data. |
| `DEMO_SEED_PASSWORD` | Demo only | Initial demo account password. Do not use for company production users. |
| `PASSWORD_MIN_LENGTH` | Optional | Backend-enforced minimum, defaults to at least 6. |

## 3. Standard Deployment

1. Confirm the deployment branch is `main` or the approved release branch.
2. Confirm `APP_MODE=production`, `DISABLE_DEMO_FALLBACK=true`, and `AUTO_SEED_DEMO=false` for any database containing real company data.
3. Run the readiness suite locally:

```bash
npm run test:prod-readiness
```

4. Build and start:

```bash
npm install
npm run build
npm start
```

5. Verify health:

```text
/api/health
```

Expected response:

```json
{ "status": "ok", "database": "connected" }
```

## 4. Migration Procedure

Use migrations before starting the production service if startup migrations are not enabled:

```bash
npm run api:migrate
```

Migration failure is a release blocker. Do not seed or import data until migrations complete. The baseline schema is followed by versioned SQL files in `server/migrations`.

## 5. Real Data Load Procedure

Use `REAL_DATA_IMPORT_GUIDE.md` for load order and templates. Minimum sequence:

1. Validate catalogs and Country Director mappings.
2. Load employees and linked users.
3. Load clients.
4. Load projects.
5. Load allocations.
6. Load optional historical timesheets.
7. Reconcile utilization reports and role-scoped views.

## 6. Rollback Procedure

For code rollback:

1. Redeploy the previous known-good Git commit or Render deploy.
2. Keep the database unchanged unless the failed release introduced a bad migration.
3. Run `/api/health`.
4. Run read-only backend smoke:

```bash
BACKEND_SMOKE_BASE_URL=https://your-app-url npm run test:backend-api
BACKEND_SMOKE_BASE_URL=https://your-app-url npm run test:backend-roles
```

For data rollback, restore the database from the last approved backup. Data rollback must be owned by the company database administrator.

## 7. Health Checks

| Check | Expected |
|---|---|
| `/api/health` | `status: ok`, `database: connected` |
| Login as Admin | Success, lands on dashboard |
| Employee/project reads | Non-empty in seeded/UAT DB |
| Role scoped API smoke | Passes for configured seeded users |
| Static frontend | Deep links serve `index.html` |

## 8. Render Notes

Render settings:

- Runtime: Node
- Build command: `npm install && npm run build`
- Start command: `npm start`
- Health check path: `/api/health`
- Branch: approved release branch, currently `main`

If Render does not update after a push, check the service Events tab for build or deploy failures.

## 9. Internal Hosting Notes

For an internal VM, container host, or reverse proxy:

- Terminate HTTPS at the proxy or platform.
- Forward `X-Forwarded-*` headers.
- Keep `APP_URL` aligned with the user-facing HTTPS URL.
- Do not expose PostgreSQL publicly except through approved network controls.
- Centralize logs and define alert routing before go-live.

## 10. Go-Live Gate

Do not call the system production-live until all are true:

- Company-owned DB and secrets are configured.
- Real data import is reconciled.
- Role UAT is signed off.
- Backup and restore are tested.
- Monitoring and alert ownership are active.
- Security operations checklist is approved.
