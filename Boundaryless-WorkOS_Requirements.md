# Boundaryless-WorkOS BRD and Technical Plan

**Single source of truth for product scope, production-core requirements, implementation status, and next technical plan.**

**Product:** Boundaryless-WorkOS Workforce Operations Core  
**Owner:** AP  
**Last updated:** 15 May 2026  
**Current release target:** Production Core handover candidate  
**Current implementation state:** Strong controlled-UAT build; not final company production until company-owned infrastructure, real data, final UAT, security sign-off, backup/restore, and monitoring are complete.

---

## 1. Document Authority

This document consolidates and supersedes the earlier BRD, production-core plan, technical status notes, and handover readiness summaries. Supporting documents remain valid only as operational checklists or user guides:

- `Boundaryless-WorkOS_User_Flow_Guide.md`
- `BOUNDARYLESS_WORKOS_PRODUCTION_HANDOVER_CHECKLIST.md`
- `PRODUCTION_RUNBOOK.md`
- `REAL_DATA_IMPORT_GUIDE.md`
- `SECURITY_OPERATIONS_CHECKLIST.md`
- `ROLE_UAT_CHECKLIST.md`
- `DEPLOYMENT_SUPABASE_RENDER.md`

If any supporting document conflicts with this BRD, this document wins.

---

## 2. Product Positioning

Boundaryless-WorkOS Workforce Operations Core is an internal workforce operations platform for employee master data, client/project allocation, timesheets, utilization reporting, import/export, audit, and governance.

The first production handover must be premium, focused, and enterprise-safe. It must harden the current core platform instead of expanding into broad future modules.

### In Scope for Production Core

- Employee master and identity-ready workforce records
- Client master and project master
- Project/resource allocations
- Weekly client/project timesheets
- Timesheet approval and rejection
- Planned, actual, and forecast utilization
- Dashboard and scoped reports
- Data-quality report
- CSV import/export
- Audit trail and governance visibility
- Role-based access control using identity, selected active role, permissions, and scoped data access
- Production-mode hardening that disables demo fallback when backend mode is required
- Company handover documentation and operational checklists

### Out of Scope for Production Core

- Leave management workflow
- Employee self-service leave balance and leave calendar
- Microsoft Teams bot, Adaptive Cards, or Teams action tokens
- Microsoft Entra SSO
- Email/Teams notification delivery engine
- Billing, invoicing, rate cards, or revenue recognition
- AI, Gemini, assistants, forecasting intelligence, or recommendations
- Kanban/task management
- Broad workflow engine
- Payroll or HRMS replacement

The out-of-scope items can be designed as future phases, but they must not block the Production Core handover.

---

## 3. Long-Term BRD Vision

The v4 strategic BRD positioned the product as an employee-first workforce operating system. That direction is accepted as the long-term product vision, but it is intentionally phased after Production Core.

Long-term product promise:

```text
One trusted operational layer for employees, capacity, availability, allocations, time, approvals, notifications, reporting, and governance.
```

| Long-Term Module | BRD Intent | Current Status | Production Core Decision |
|---|---|---|---|
| Employee Master as root | Employee data feeds identity, reporting, capacity, allocations, timesheets, approvals, future leave, notifications, and Teams identity. | Partially complete | Included now; future identity/leave/Teams fields remain nullable placeholders. |
| ESS Portal | Employee self-service for profile, allocations, timesheets, future leave, notifications, and manager views. | Partial | Employee workspace and timesheets are included; leave and notifications are future. |
| Leave Management | Leave requests, balances, policies, calendars, approvals, and utilization availability impact. | Pending | Future phase; only placeholders and availability-ready fields now. |
| Approval Management | Common approval model for timesheets, leave, allocation changes, delegations, and SLAs. | Partial | Timesheet approvals included; generic approval engine deferred. |
| Notification Center | Role/scope/event based in-app, email, and Teams notifications. | Pending | Future phase; audit/source model is being prepared now. |
| Microsoft Teams | Personal tab, deterministic bot commands, Adaptive Cards, and secure action tokens. | Pending | Future phase; Teams identity placeholders only. |
| Microsoft Entra SSO | Enterprise identity and group-to-role mapping. | Pending | Future phase; username/password remains Production Core auth. |
| Resource Planning Board | Availability-aware allocation planning and bench/roll-off visibility. | Pending | Future phase after leave and allocation backend stability. |
| Workforce Command Center | Executive dashboard with utilization, availability, attention items, and data confidence. | Partial | Dashboard and data-quality report included now; availability/leave metrics deferred. |
| Reports | Utilization, allocation, timesheet, data-quality, future leave, notification, and audit reports. | Partial | Core workforce/utilization/data-quality/audit reports included now; leave/notification reports deferred. |

This preserves the career-grade product direction without inflating the first production handover.

---

## 4. Business Objectives

1. Replace spreadsheet-led workforce utilization tracking with a controlled web application.
2. Provide a centralized source of truth for employees, clients, projects, allocations, and approved timesheets.
3. Make planned, actual, and forecast utilization visible at company, Country Director, project, client, and employee levels.
4. Keep utilization calculations delivery-capacity focused.
5. Support multi-role users without allowing inactive roles to bypass authorization.
6. Preserve a full audit trail for production-relevant mutations and exports.
7. Support real-data onboarding through controlled CSV imports and validation reports.
8. Prepare the company for production handover with clear runbooks, UAT checklists, security checklists, rollback guidance, and environment ownership.

---

## 5. Roles and Access Model

The required authorization model is:

```text
identity + selected activeRole + action permission + data scope
```

Assigned roles alone must not authorize a request. A multi-role user can only perform actions allowed by the role they selected for the current session.

| Role | Core Permissions | Required Data Scope |
|---|---|---|
| Employee | View own profile, assigned projects, allocations, own timesheets; draft/submit/correct timesheets. | Own employee record and own timesheets. |
| Team Lead | View mapped team/resource information and team utilization where configured; may participate in timesheet governance if allowed by policy. | Team Lead mapping rules; final company rule pending. |
| Project Manager | View owned projects, project resources, allocation context, project utilization; manage allocations where permitted. | Projects they manage and employees allocated to those projects. |
| Country Director | View mapped employees, projects, utilization, submitted timesheets; approve/reject scoped timesheets. | Employees mapped to that Country Director, including shared employees. |
| HR | Maintain employee master and workforce catalogs; view workforce/utilization reports where permitted. | Broad workforce visibility, excluding Admin-only security operations unless assigned. |
| Admin | Full platform administration, settings, audit, imports/exports, users, roles, and all data. | Global. |

### Authorization Rules

- Frontend navigation must hide unauthorized routes.
- Backend APIs must enforce active-role checks.
- Backend reads and writes must enforce row/data scope.
- Exports and reports must obey backend data scope in production.
- Audit logs must include actor, active role, source, entity type, entity ID, old value, new value, reason where applicable, and timestamp.

---

## 6. Core Functional Requirements

### Employee Master

Required production fields:

- Employee ID, name, email, designation, department, country, status
- Primary Country Director and mapped Country Directors
- Reporting manager
- Joining date and exit date
- Standard weekly hours
- Capacity type and contract type
- Utilization eligibility
- Username/login linkage
- Nullable placeholders for Entra ID, Teams user ID, Teams channel ID, leave policy ID, and holiday calendar ID

Status: **Mostly complete.** Demo and backend schema support exist. Final real-data load and company identity mappings are pending.

### Client and Project Master

Required:

- Client master records with industry/status/scope metadata
- Project master records linked to clients and Project Managers
- Project status and dependency guardrails
- Project detail views showing assigned resources, allocation percentages, actual contribution, Country Director mapping, and ownership

Status: **Mostly complete.** Backend APIs and UI are implemented for core flows. Final backend-mode UAT and real-data validation are pending.

### Allocation Control

Required:

- Employee, project, allocation percentage, date range, status, billable/client-related indicator, and comments
- Planned utilization calculated from active allocations
- Over-allocation detection based on thresholds
- Allocation edits available from project, employee, or allocation context while keeping allocation logic centralized

Status: **Partial.** UI and backend endpoints exist with validation guardrails. Remaining work is deeper API parity tests, concurrency behavior, and full role-scope UAT.

### Timesheets

Required:

- Weekly client/project timesheets
- Assigned project entries and client miscellaneous task entries
- Draft, submitted, approved, rejected statuses
- Rejection reason required and visible to employee
- Approved client/project hours only count toward actual utilization
- Draft, submitted, and rejected timesheets do not count toward actual utilization
- Future timesheets must be blocked or controlled by business rule

Status: **Mostly complete for controlled UAT.** UI and backend flows exist. Remaining work is role-by-role browser UAT and final PM/Team Lead approval rules.

### Utilization

Required:

- Planned utilization from active allocation percentages
- Actual utilization from approved client/project timesheet hours divided by expected weekly hours
- Forecast utilization from future allocation date ranges for 1, 2, and 3 month horizons
- Company metrics must count each active person once and use delivery-eligible employees for utilization denominators
- Country Director metrics can include shared employees in each mapped CD view but must avoid double-counting in company totals

Status: **Mostly complete.** Frontend and backend report endpoints exist for planned, actual, and forecast reports. Dashboard/report parity and real-data validation remain pending.

### Dashboard and Reports

Required:

- Company KPIs
- Utilization-eligible FTE
- Governance user separation
- Country Director portfolio
- Immediate attention panel
- Client/project/resource drilldowns
- Planned, actual, forecast, dashboard, and data-quality reports

Status: **Mostly complete for demo and controlled UAT.** Data-quality and dashboard endpoints exist. Final production browser UAT and report/export scope validation remain pending.

### Import and Export

Required:

- CSV-first import/export
- Templates for employees, clients, projects, allocations, and timesheets
- Backend import apply endpoints
- Validation feedback before data is trusted
- Import/export history and audit
- Shared export/audit path where practical

Status: **Partial.** CSV templates, import apply endpoints, history persistence, and export audit hardening exist. Remaining work is real-file UAT, duplicate handling refinements, and optional XLSX/PDF only if company requires them.

### Audit and Governance

Required:

- Critical mutation audit trail
- Imports, exports, approvals, rejections, password changes/resets, settings changes, and master-data changes audited
- Source and active-role metadata captured
- Client audit events constrained to approved UI-generated actions
- Admin audit visibility

Status: **Partial but improving.** Backend audit exists for major writes and export events; arbitrary client audit source submission has been blocked. Remaining work is full immutable audit coverage, retention policy, and audit export governance.

---

## 7. Public Interfaces and Configuration

### Required Environment Variables

```text
APP_MODE=production|demo
DISABLE_DEMO_FALLBACK=true|false
DATABASE_URL=postgresql://...
API_SESSION_SECRET=<company-owned secret>
PGSSLMODE=require|disable|...
APP_URL=https://...
PASSWORD_MIN_LENGTH=<number>
NODE_ENV=production
AUTO_SEED_DEMO=false
```

Frontend deployments should use the matching Vite-prefixed values where required:

```text
VITE_APP_MODE=production
VITE_DISABLE_DEMO_FALLBACK=true
```

### Implemented API Surface

- `GET /api/health`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/switch-role`
- `GET /api/auth/me`
- `POST /api/auth/change-password`
- `POST /api/users/:id/password-reset`
- Employee, client, project, allocation, timesheet, settings, catalog, Country Director, role, audit, and import/export endpoints
- `GET /api/reports/planned-utilization`
- `GET /api/reports/actual-utilization`
- `GET /api/reports/forecast-utilization`
- `GET /api/reports/data-quality`
- `GET /api/reports/dashboard`
- CSV import apply endpoints for employees, clients, projects, allocations, and timesheets

---

## 8. Completed vs Pending Status

### Completed or Ready for Controlled UAT

| Area | Status | Evidence |
|---|---|---|
| Product rename | Complete | App, code, package name, docs, and Git remote use Boundaryless-WorkOS. |
| Production-mode fallback guard | Complete | `APP_MODE` and `DISABLE_DEMO_FALLBACK` are implemented and covered by production hardening checks. |
| Demo credential wording cleanup | Complete for production path | Production copy no longer relies on old demo product framing. |
| Active-role backend authorization | Complete foundation | Backend role guard checks selected `activeRole`; production hardening smoke covers inactive-role bypass risk. |
| Multi-role role switching | Complete foundation | Backend role switch endpoint and frontend active-role handling exist. |
| Employee production fields | Complete foundation | Production-core migration adds manager, weekly hours, capacity, contract, Entra/Teams placeholders, and related fields. |
| Data-quality report | Complete foundation | UI route and backend endpoint exist; export is audited. |
| Dashboard report endpoint | Complete foundation | Backend endpoint exists for command-center style summary. |
| Hosted report smoke coverage | Complete foundation | Backend API and role smoke tests now cover planned, actual, forecast, dashboard, and data-quality report endpoints. |
| CSV import templates | Complete | Templates exist and are covered by `test:import-templates`. |
| Backend CSV apply endpoints | Complete foundation | Employees, clients, projects, allocations, and timesheets apply endpoints exist. |
| Password change/reset foundation | Complete foundation | Self-service change, Admin/HR reset endpoints, hashing, and audit exist. |
| Production hardening smoke | Complete | `test:prod-hardening` covers production mode, active-role guard, data-quality report, migration, and audit restrictions. |
| Handover docs | Complete foundation | Runbook, real-data guide, security checklist, role UAT checklist, deployment guide, and handover checklist exist. |

### Pending Before Company Production

| Priority | Area | Pending Requirement | Blocked By Company Input |
|---:|---|---|---|
| P0 | Company infrastructure | Replace personal/demo Supabase/Render values with company-owned DB, hosting account, secrets, domain, and HTTPS. | Yes |
| P0 | Real data | Load real catalogs, employees, users, clients, projects, allocations, and optional historical timesheets. | Yes |
| P0 | Role UAT | Complete Admin, HR, Country Director, Project Manager, Team Lead, and Employee browser UAT in backend mode. | Partly |
| P0 | Team Lead rules | Confirm final visibility and approval authority. | Yes |
| P0 | Project Manager rules | Confirm whether PMs can approve timesheets or only view/recommend. | Yes |
| P0 | Auth operations | Final password policy, reset channel, initial admin users, lockout policy, session expiry, and user lifecycle sign-off. | Yes |
| P0 | Backup/restore | Define backup frequency, retention, restore owner, and run at least one restore test. | Yes |
| P0 | Monitoring/logging | Add production log ownership, health monitoring, and alert channel. | Yes |
| P0 | Audit governance | Finalize retention, export permissions, and immutable audit expectations. | Yes |
| P1 | Backend report parity | Hosted smoke coverage now includes core report endpoints. Remaining work: DB-backed calculation fixtures, client/CD report reconciliation, and browser validation against real/UAT data. | No |
| P1 | Import hardening | Validate real CSV files, duplicate handling, rejected-row handling, and operational import runbook. | Partly |
| P1 | Automated browser QA | Add Playwright or equivalent workflows for core roles and high-risk journeys. | No |
| P2 | Code consolidation | Continue reducing table/filter/report duplication after UAT stabilizes requirements. | No |
| P2 | Loading/error polish | Standardize save/loading/error states across every API-backed page. | No |

---

## 9. Updated Technical Plan

### Phase 0: Stabilized Production Core Baseline

Status: **Mostly complete.**

Exit criteria:

- Lint/build/backend/access/requirements/import-template/prod-hardening tests pass.
- Production mode fails closed when backend is unavailable and demo fallback is disabled.
- Active-role authorization is enforced by backend.
- Production-core schema fields and data-quality report exist.
- Core handover docs exist.

Remaining Phase 0 work:

- Run the full readiness suite after every hardening change.
- Keep `.agent/` runtime files out of commits.
- Keep demo seed disabled before any real-data edits.

### Phase 1: Company-Owned Controlled UAT

Status: **Next major step.**

Work:

1. Configure company-owned PostgreSQL/Supabase and hosting secrets.
2. Run migrations.
3. Seed only required baseline catalogs/admins.
4. Import real or UAT data using documented templates.
5. Review the data-quality report and resolve blockers.
6. Run role UAT for Admin, HR, Country Director, Project Manager, Team Lead, and Employee.
7. Validate exports and audit entries.
8. Validate dashboard, planned, actual, forecast, and data-quality reports against real/UAT data.

Exit criteria:

- `/api/health` reports `database: connected`.
- `APP_MODE=production`, `DISABLE_DEMO_FALLBACK=true`, and `AUTO_SEED_DEMO=false`.
- No production-critical role bypass or data-scope issue remains.
- UAT evidence is attached to the handover package.

### Phase 2: Production Operations Hardening

Status: **Pending company decisions.**

Work:

1. Finalize password policy, reset delivery, lockout, and session settings.
2. Add production logging and monitoring ownership.
3. Define backup/restore schedule and run restore test.
4. Finalize audit retention and audit export policy.
5. Confirm support owner, release owner, rollback owner, and escalation channel.
6. Freeze demo credentials and demo seed behavior out of company production.

Exit criteria:

- Security operations checklist signed off.
- Production runbook has company-specific values.
- Backup and restore are tested.
- Monitoring and alert ownership are assigned.

### Phase 3: Production Release Candidate

Status: **Pending UAT and operations sign-off.**

Work:

1. Run complete test suite.
2. Run hosted backend smoke tests with `BACKEND_SMOKE_BASE_URL`.
3. Complete browser UAT evidence.
4. Resolve P0/P1 UAT defects.
5. Tag release and hand over deployment notes.

Exit criteria:

- Company technical owner accepts code, env, data, runbook, UAT evidence, and rollback plan.
- No known P0 defects.
- Known P1/P2 items are documented as post-go-live backlog.

---

## 10. Required Verification Commands

Run locally before each handover build:

```bash
npm run lint
npm run build
npm run test:backend
npm run test:access
npm run test:requirements
npm run test:import-templates
npm run test:prod-hardening
npm run test:prod-readiness
```

Run against hosted backend when available:

```bash
BACKEND_SMOKE_BASE_URL=<url> npm run test:backend-api
BACKEND_SMOKE_BASE_URL=<url> npm run test:backend-roles
```

`test:backend-api` and `test:backend-roles` skip hosted checks unless `BACKEND_SMOKE_BASE_URL` is set.

---

## 11. UAT Acceptance

Production Core is acceptable for company handover only when:

- Admin can manage master data, settings, imports, exports, audit, and password resets.
- HR can maintain workforce data and validate reports within allowed scope.
- Country Director can view scoped employees/projects/reports and approve/reject scoped timesheets.
- Project Manager can view owned project/resource data and perform only approved actions.
- Team Lead can view only the scope confirmed by company policy.
- Employee can view own data and submit/correct timesheets.
- Multi-role users cannot use inactive roles to bypass permissions.
- Data-quality issues are reviewed and accepted or fixed.
- Real-data reports reconcile against expected operational totals.
- Production env, backup, monitoring, audit, and rollback ownership are documented.

---

## 12. Company Inputs Still Needed

| Input | Required For |
|---|---|
| Company database connection and SSL mode | Production persistence |
| Company hosting target and deployment owner | Production deployment |
| Internal URL/domain and HTTPS approach | Secure access and cookie settings |
| Company secret management approach | `API_SESSION_SECRET`, DB credentials, rotation |
| Initial production admin users | First login and user provisioning |
| Password and reset policy | Auth lifecycle |
| Team Lead visibility/approval policy | Final RBAC |
| Project Manager approval policy | Timesheet governance |
| Real employee/client/project/allocation/timesheet files | Real-data UAT |
| Governance vs delivery capacity mapping | Accurate utilization denominators |
| Import/export format requirement | Decide whether CSV is enough or XLSX/PDF is required |
| Audit retention and export policy | Governance and compliance |
| Backup/restore policy | Operations sign-off |
| Monitoring/logging tool and owner | Production support |

---

## 13. Future Roadmap After Production Core

Do not start these until Production Core is accepted unless the company explicitly changes priority:

1. Microsoft Entra SSO.
2. Teams notification and approval surfaces.
3. Leave management and holiday calendars.
4. Role/scope-based notification center.
5. Advanced resource planning board.
6. Generic workflow/approval engine.
7. Billing/rate cards/invoicing.
8. AI-assisted forecasting or recommendations.
9. Kanban/task management.
