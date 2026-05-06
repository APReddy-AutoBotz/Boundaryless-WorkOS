# Resource Utilization Tracker - Technical Status and Production Readiness

**Last Updated:** 6 May 2026
**Audience:** Engineering, QA, technical reviewers, implementation partners, and production-readiness reviewers  
**Purpose:** Summarize what is implemented, what is pending, what is blocked by user/company input, and the recommended next implementation order.

---

## 1. Current Technical State

The application is currently a strong near-production product build with Render/Supabase deployment proven for demo usage and a hardened backend/API path in progress.

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
- Backend route-level role middleware and initial row-scoped API reads
- Backend health endpoint
- Production static serving support for the built frontend
- Render deployment scaffold with migration/demo seed startup support
- Import/export history persistence in backend mode
- Backend settings write endpoint
- Backend timesheet IDs and entries returned to the frontend
- Delivery-only utilization eligibility policy excluding Admin/HR/Country Director governance users from utilization denominators

The app is ready for guided leadership/demo walkthroughs and controlled backend-mode UAT on Render/Supabase. It is not yet final production because company-owned infrastructure, real-data import, browser UAT by role, password lifecycle, monitoring, backup/restore, and final security sign-off are still pending.

---

## 2. Important Local URLs

| Service | URL | Current Status |
|---|---|---|
| Frontend Vite app | `http://localhost:3000/` | Local demo server |
| Backend API health | `http://localhost:4000/api/health` or deployed `/api/health` | Depends on active server |
| Render deployment | `https://boundaryless-rut.onrender.com` | Demo deployment verified by user |
| Backend database state | `database: connected` on Render/Supabase | Personal Supabase currently used for demo/UAT |

---

## 3. Current Verification Status

| Check | Command | Status | Notes |
|---|---|---|---|
| TypeScript / lint | `npm run lint` | Passing | `tsc --noEmit` succeeds |
| Production build | `npm run build` | Passing | Vite build succeeds |
| Backend contract smoke | `npm run test:backend` | Passing after current hardening | Confirms backend scaffold, catalog/settings/import-export/timesheet/report/import-apply contracts, static serving guardrails, rate-limit guardrail, and seed script presence |
| Access-control smoke | `npm run test:access` | Passing after current hardening | Node browser storage mocks added and async service usage reconciled |
| Requirements smoke | `npm run test:requirements` | Passing after current hardening | Demo version v7, async services, cascading rename, guarded deletes, timesheet validation, utilization eligibility, and dual-mode report service reconciled |
| Backend API smoke | `npm run test:backend-api` | Added | Skips unless `BACKEND_SMOKE_BASE_URL` is set; can validate deployed API login, core reads, and utilization report reads |

---

## 4. Implemented Functional Areas

| Area | Status | Notes |
|---|---|---|
| Login/logout | Partial | Username/password login works in local and backend mode. Production password reset/change, expiry, and lockout are pending. |
| Role-based navigation | Done for frontend demo | Sidebar and route access are role-filtered. Backend route-level role checks exist. |
| Employee Master | Done for demo | Add/edit/deactivate/search/filter/sort/detail flows exist. Catalog-backed departments/countries are supported. Admin, HR, and Country Director records remain visible as directory/governance users but are labeled as excluded from utilization capacity. |
| Employee Detail | Done for demo | Shows allocation, utilization, project participation, and related navigation. Non-utilization governance users show an explicit excluded-capacity state instead of Bench/0% utilization. |
| Client Portfolio | Done for demo | Client master, industry, CD scope, client/project/resource views, and dependency guardrails exist in frontend. |
| Project Master | Done for demo | Add/edit/status/filter/sort/detail flows exist. Project manager ownership is represented. |
| Project Detail | Done for demo | Assigned consultants, allocation percent, actual project contribution, CD mapping, and allocation entry points exist. |
| Allocation Control | Partial | Frontend allocation create/edit/soft-end works. Backend validation and concurrency hardening are pending. |
| Timesheet Self-Log | Done for demo | Draft/submit flow exists; future-dated submission blocking has been addressed in business logic. |
| Timesheet Governance | Needs UAT | Approval/rejection, rejection reason, filtered exports, and scoped review behavior exist but need role-by-role browser UAT. |
| Planned Utilization | Done for demo; backend report API adopted | Uses active allocations and relevant dates/statuses. Planned page now consumes the dual-mode utilization report service. |
| Actual Utilization | Done for demo; backend report API adopted | Uses approved timesheets. Actual page now consumes report rows for employee planned/actual values while keeping timesheet-led period views. |
| Forecast Utilization | Done for demo; backend report API partially adopted | Uses future allocation outlooks. Forecast page uses backend forecast report rows for the selected horizon while retaining client-side monthly snapshots. |
| Dashboard | Done for demo | Company KPIs, utilization-eligible FTE, governance-user separation, CD portfolio cards, client/project/resource drilldowns, and route-aware navigation exist. |
| Import/Export | Partial | CSV import/export, validation reports, backend import/export history persistence, and backend apply transactions for Employee Master, Client Master, Project Master, Allocation Control, and Timesheet Import exist. XLSX/PDF are pending. |
| Audit Trail | Partial | Frontend/local audit is visible/exportable, and backend audit exists for major writes. Immutable full server-side audit coverage is pending. |
| Governance Settings | Partial | Roles, CDs, departments, countries, industries, thresholds, settings write API, and guarded deletes exist. Full browser UAT pending. |
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
| Utilization eligibility | Done for demo/backend schema/UI | `utilizationEligible` / `utilization_eligible` exists; Admin, HR, and Country Directors are excluded from delivery utilization by default, while allocated PMs are included. Employee Master/Detail now label non-utilization users instead of presenting them as Bench capacity. Dedicated admin override UI is optional future polish. |
| Backend health check | Done | `/api/health` reports server and DB status. |
| Backend utilization reports | Added | `/api/reports/planned-utilization`, `/api/reports/actual-utilization`, and `/api/reports/forecast-utilization` return scoped server-side rows and summaries. |
| Frontend report service | Added | `utilizationReportService` calls backend report endpoints when connected and computes equivalent local fallback reports in demo mode. |
| Production static serving | Done | Built frontend can be served by the Express server in production mode. |
| Render deployment scaffold | Done | `render.yaml` and `DEPLOYMENT_SUPABASE_RENDER.md` document Render + Supabase deployment with secrets kept in environment variables. |

---

## 6. Pending Before Demo Sign-Off

| Priority | Item | Required Action |
|---:|---|---|
| P0 | Browser UAT | Run Admin, HR, Country Director, Project Manager, Team Lead, and Employee journeys manually or through Playwright. |
| P0 | Render env safety | Set `AUTO_SEED_DEMO=false` after the first successful demo seed and before editing demo records into real records. |
| P1 | Async save state polish | Add consistent saving/error states across remaining API-ready pages. |
| P1 | Demo reset guidance | Keep reset guidance visible for disposable demo databases only. |

---

## 7. Pending Before Multi-User UAT

| Priority | Item | Required Action | User Input Needed |
|---:|---|---|---|
| P0 | Company PostgreSQL connection | Replace personal Supabase credentials with company-owned PostgreSQL/Supabase credentials, run migrations, seed/load data, verify `database: connected`. | Yes |
| P0 | API parity | Core parity improved for settings, scoped reads, timesheet IDs/entries, employee provisioning, import/export history, CSV import apply, utilization report reads, and report-page frontend adoption. Remaining parity: complete browser UAT and final edge cases. | No |
| P0 | Backend data-level authorization | Initial scoped reads exist for Employee, PM, CD, HR/Admin. Finish write-scope and report/export scoping sign-off. | Yes, final business rules |
| P0 | Backend calculation parity | Initial utilization report endpoints exist, are contract/API-smoke covered, and are consumed by report pages through a dual-mode service. Remaining work: add DB-backed calculation fixtures and deeper backend-mode browser checks. | No |
| P0 | Utilization eligibility data quality | During real-data load, classify Admin/HR/Country Director governance users as non-utilization capacity and keep Project Managers allocation-driven. | Yes, real employee role mapping |
| P0 | Production auth lifecycle | Password policy, reset process, lockout behavior, disabled-user behavior, session expiry. | Yes |
| P1 | Import/export backend jobs | CSV backend apply transactions now exist for employees, clients, projects, allocations, and timesheets. Remaining work: duplicate handling refinements and optional XLSX/PDF. | Yes, file/report formats |
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

1. Run the complete smoke suite after every backend hardening change.
2. Set `AUTO_SEED_DEMO=false` in Render after the initial seed and before real edits.
3. Run browser UAT across Admin, HR, Country Director, Project Manager, Team Lead, and Employee roles.
4. Replace personal Supabase/Render values with company-owned environment variables.
5. Load real catalogs, Country Directors, employees/users, clients, projects, allocations, and optional historical timesheets.
6. Validate utilization eligibility on real data: governance users excluded, delivery users included, Project Managers included only when allocated.
7. Browser-test backend-mode import flows, including error reports and apply logs.
8. Finalize data-level authorization rules for Team Lead and Project Manager visibility.
9. Add production password lifecycle, monitoring, backup/restore, and release runbook.

---

## 10. User / Company Inputs Still Needed

| Input Needed | Why It Is Needed |
|---|---|
| Company PostgreSQL `DATABASE_URL` or DB host/port/name/user/password/SSL mode | Required to replace personal Supabase before company handover |
| Company hosting/deployment target | Required for production startup, reverse proxy, HTTPS, logs, and runbook |
| Internal URL/domain | Required for secure cookies and app access planning |
| Initial production admin users | Required for production user provisioning |
| Password policy | Required for username/password production auth |
| Team Lead visibility/approval rules | Required for backend data-level RBAC |
| Project Manager approval rules | Required for timesheet governance enforcement |
| Real employee/client/project/allocation data | Required for real-data UAT |
| Governance vs delivery capacity mapping | Required to keep utilization denominators correct after demo data is replaced |
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
| Leadership demo using local or Render demo mode | 85-90% |
| Controlled internal UAT using Render/Supabase backend | 65-75% |
| Company technical handover readiness | 60-70% |
| Production go-live | 45-55% |

The product is suitable for a guided business demo and controlled UAT with demo data. It should not yet be presented as final production until company-owned infrastructure, real data, complete browser UAT, password lifecycle, monitoring, backup/restore, and security sign-off are complete.
