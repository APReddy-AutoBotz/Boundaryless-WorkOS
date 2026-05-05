# Resource Utilization Tracker - Technical Status and Production Readiness

**Last Updated:** 1 May 2026  
**Audience:** Engineering, QA, technical reviewers, implementation partners, and production-readiness reviewers  
**Purpose:** Summarize what is implemented, what is pending, what is blocked by user/company input, and the recommended next implementation order.

---

## 1. Current Technical State

The application is currently a strong near-production frontend demo with a backend foundation in progress.

It includes:

- React + TypeScript + Tailwind frontend
- Boundaryless-inspired internal UI
- Role-based navigation and protected frontend routes
- Local/demo persistence through `DataStorage`
- Dual-mode async frontend service layer
- Starter Node/Express API
- PostgreSQL schema and migration runner
- PostgreSQL demo seed script
- Scrypt password verification and signed backend sessions/tokens
- Backend route-level role middleware
- Backend health endpoint
- Production static serving support for the built frontend

The app is ready for leadership/demo walkthroughs in local demo mode. It is not yet ready as a fully multi-user production system because real PostgreSQL connectivity, full backend API parity, backend data-level authorization, and production operations are still pending.

---

## 2. Important Local URLs

| Service | URL | Current Status |
|---|---|---|
| Frontend Vite app | `http://localhost:3000/` | Running |
| Backend API health | `http://localhost:4000/api/health` | Running |
| Backend database state | `database: not_configured` | PostgreSQL connection not supplied |

---

## 3. Current Verification Status

| Check | Command | Status | Notes |
|---|---|---|---|
| TypeScript / lint | `npm run lint` | Passing | `tsc --noEmit` succeeds |
| Production build | `npm run build` | Passing | Vite build succeeds |
| Backend contract smoke | `npm run test:backend` | Passing | Confirms backend scaffold, catalog routes, static serving guardrails, rate-limit guardrail, and seed script presence |
| Access-control smoke | `npm run test:access` | Failing | Node test harness does not define browser `sessionStorage` |
| Requirements smoke | `npm run test:requirements` | Failing | Current demo-user assertion needs to be reconciled with the updated seeded/local user model |

---

## 4. Implemented Functional Areas

| Area | Status | Notes |
|---|---|---|
| Login/logout | Partial | Username/password demo login works; backend auth foundation exists. Production password lifecycle is pending. |
| Role-based navigation | Done for frontend demo | Sidebar and route access are role-filtered. Backend route-level role checks exist. |
| Employee Master | Done for demo | Add/edit/deactivate/search/filter/sort/detail flows exist. Catalog-backed departments/countries are supported. |
| Employee Detail | Done for demo | Shows allocation, utilization, project participation, and related navigation. |
| Client Portfolio | Done for demo | Client master, industry, CD scope, client/project/resource views, and dependency guardrails exist in frontend. |
| Project Master | Done for demo | Add/edit/status/filter/sort/detail flows exist. Project manager ownership is represented. |
| Project Detail | Done for demo | Assigned consultants, allocation percent, actual project contribution, CD mapping, and allocation entry points exist. |
| Allocation Control | Partial | Frontend allocation create/edit/soft-end works. Backend validation and concurrency hardening are pending. |
| Timesheet Self-Log | Done for demo | Draft/submit flow exists; future-dated submission blocking has been addressed in business logic. |
| Timesheet Governance | Needs UAT | Approval/rejection, rejection reason, filtered exports, and scoped review behavior exist but need role-by-role browser UAT. |
| Planned Utilization | Done for demo | Uses active allocations and relevant dates/statuses. Backend parity pending. |
| Actual Utilization | Done for demo | Uses approved timesheets. Backend parity pending. |
| Forecast Utilization | Done for demo | Uses future allocation outlooks. Backend parity pending. |
| Dashboard | Done for demo | Company KPIs, CD portfolio cards, client/project/resource drilldowns, and route-aware navigation exist. |
| Import/Export | Partial | CSV import/export and validation reports exist in frontend. Backend import jobs and XLSX/PDF are pending. |
| Audit Trail | Partial | Frontend/local audit is visible and exportable. Immutable server-side audit coverage is pending. |
| Governance Settings | Partial | Roles, CDs, departments, countries, industries, thresholds, and guarded deletes exist. Full backend persistence parity pending. |
| Global Search | Done for demo | Routes to employees, projects, clients, and relevant records; outside-click behavior is handled. |
| Business user documentation | Done | `Resource_Utilization_Tracker_User_Flow_Guide.md` exists for non-technical users. |

---

## 5. Implemented Technical Enhancements

| Area | Status | Notes |
|---|---|---|
| Shared UI primitives | Partial | `PageHeader`, `KPIStrip`, `FilterBar`, `SortableHeader`, `DataTable`, cards, badges, notices, and dialogs exist. |
| Sorting affordance | Implemented in key master pages | Employee and Project master tables use clearer sorting controls. |
| Route-level lazy loading | Done | App pages are lazy-loaded with route fallback. |
| Route-aware navigation/scroll reset | Done | Detail links route more predictably to the correct screen context. |
| Boundaryless branding | Done | Logo assets and internal-style login page are in place. |
| Login background | Done | Subtle internal workspace background layer added. |
| Async form crash fix | Done | Employee, Project, and Allocation forms now await async catalog loads/saves and no longer crash on async catalog arrays. |
| Backend schema | Partial | Starter relational schema exists with users, roles, employees, clients, projects, allocations, timesheets, settings, catalogs, and audit tables. |
| Backend seed | Partial | Demo seed script exists; real-data migration process is pending. |
| Backend health check | Done | `/api/health` reports server and DB status. |
| Production static serving | Done | Built frontend can be served by the Express server in production mode. |
| Render deployment scaffold | Done | `render.yaml` and `DEPLOYMENT_SUPABASE_RENDER.md` document Render + Supabase deployment with secrets kept in environment variables. |

---

## 6. Pending Before Demo Sign-Off

| Priority | Item | Required Action |
|---:|---|---|
| P0 | Fix `test:access` | Add `sessionStorage` mock to Node smoke test setup or adjust auth test harness. |
| P0 | Fix `test:requirements` | Update demo-user assertion to match the current user/account model and async service behavior. |
| P0 | Browser UAT | Run Admin, HR, Country Director, Project Manager, Team Lead, and Employee journeys manually or through Playwright. |
| P1 | Async save state polish | Add consistent saving/error states across remaining API-ready pages. |
| P1 | Demo reset guidance | Document how to reset local demo data before stakeholder demos. |

---

## 7. Pending Before Multi-User UAT

| Priority | Item | Required Action | User Input Needed |
|---:|---|---|---|
| P0 | PostgreSQL connection | Provide database credentials, run migration, seed demo data, verify `database: connected`. | Yes |
| P0 | API parity | Complete missing backend routes and frontend API usage for settings, timesheet IDs, imports, exports, scoped reports, and full CRUD. | No |
| P0 | Backend data-level authorization | Enforce row-level/scoped access for Admin, HR, CD, PM, Team Lead, and Employee. | Yes, final business rules |
| P0 | Backend calculation parity | Move/report calculation logic to tested backend endpoints. | No |
| P0 | Production auth lifecycle | Password policy, reset process, lockout behavior, disabled-user behavior, session expiry. | Yes |
| P1 | Import/export backend jobs | Server-side validation, duplicate handling, job history, audit records, optional XLSX/PDF. | Yes, file/report formats |
| P1 | Real data load | Cleanse and load real employee/client/project/allocation data. | Yes |

---

## 8. Pending Before Production Go-Live

| Priority | Item | Required Action | User Input Needed |
|---:|---|---|---|
| P0 | Deployment target | Decide hosting model: internal server, VM, Docker, Render/Railway, IIS reverse proxy, etc. | Yes |
| P0 | Production secrets | Configure `DATABASE_URL`, `API_SESSION_SECRET`, `NODE_ENV=production`, SSL mode, login throttling, and cookie/security settings. | Yes |
| P0 | HTTPS/reverse proxy | Confirm internal URL/domain, certificate handling, secure cookie behavior, and proxy headers. | Yes |
| P0 | Backup/restore | Define DB backup frequency, retention, restore owner, and recovery expectations. | Yes |
| P0 | Monitoring/logging | Add production application logs, error logs, request logs, and alert ownership. | Yes |
| P0 | Immutable audit | Make server-side audit mandatory and tamper-resistant for all critical mutations. | Yes, retention policy |
| P1 | Full automated QA | Add API tests, calculation tests, route/access tests, and Playwright browser workflows. | No |
| P1 | Release runbook | Document deploy, rollback, seed/migration, backup, and support process. | Yes, operations owner |

---

## 9. Recommended Next Implementation Order

1. Fix `test:access` by adding a Node `sessionStorage` mock.
2. Fix `test:requirements` by reconciling the demo-user assertion with the current user/account model.
3. Run a browser UAT pass across Admin, HR, Country Director, Project Manager, Team Lead, and Employee roles.
4. Add a local demo reset guide and confirm demo credentials.
5. Connect a real PostgreSQL database when credentials are available.
6. Run `npm run api:migrate` and `npm run api:seed:demo`.
7. Validate `/api/health` returns `database: connected`.
8. Complete API route parity and frontend backend-mode UAT.
9. Implement data-level backend authorization.
10. Add production authentication lifecycle and deployment runbook.

---

## 10. User / Company Inputs Still Needed

| Input Needed | Why It Is Needed |
|---|---|
| PostgreSQL `DATABASE_URL` or DB host/port/name/user/password/SSL mode | Required for backend-mode UAT and multi-user persistence |
| Hosting/deployment target | Required for production startup, reverse proxy, HTTPS, logs, and runbook |
| Internal URL/domain | Required for secure cookies and app access planning |
| Initial production admin users | Required for production user provisioning |
| Password policy | Required for username/password production auth |
| Team Lead visibility/approval rules | Required for backend data-level RBAC |
| Project Manager approval rules | Required for timesheet governance enforcement |
| Real employee/client/project/allocation data | Required for real-data UAT |
| Import/export format expectations | Required for CSV/XLSX/PDF scope |
| Audit retention policy | Required for compliance and governance |
| Backup/restore policy | Required for production operations |

Temporary deployment direction selected for handover preparation:

- Database: personal Supabase PostgreSQL via transaction pooler for now.
- Hosting target: Render Web Service.
- Repository: `https://github.com/APReddy-AutoBotz/Boundaryless-RUT`.
- Handover model: company technical team replaces `DATABASE_URL`, `API_SESSION_SECRET`, hosting account, and demo data with company-owned equivalents.

---

## 11. Demo Readiness Summary

| Release Target | Readiness |
|---|---:|
| Leadership demo using local demo mode | 75-80% |
| Controlled internal UAT using local demo mode | 65-70% |
| Multi-user UAT using PostgreSQL backend | 45-50% |
| Production go-live | 35-40% |

The product is suitable for a guided business demo in local demo mode. It should not yet be presented as a fully deployed multi-user production system until PostgreSQL backend mode, API parity, data-level authorization, and operations hardening are complete.
