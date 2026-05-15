# Boundaryless-WorkOS BRD and Technical Plan

**Single source of truth for product scope, production-core requirements, implementation status, and next technical plan.**

**Product:** Boundaryless-WorkOS Workforce Operations Core  
**Owner:** AP  
**Last updated:** 15 May 2026  
**Current release target:** Enterprise Workforce OS phased handover  
**Current implementation state:** Production Core is a strong controlled-UAT build. Workforce OS roadmap implementation is now active behind feature flags; final company production still requires company-owned infrastructure, real data, final UAT, security sign-off, backup/restore, and monitoring.

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

The first production handover must remain premium, focused, and enterprise-safe, while the broader Workforce OS modules are implemented in controlled phases behind feature flags.

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
- Microsoft Teams chatbot behavior or production Graph-connected Adaptive Cards
- Production Microsoft Entra SSO sign-in
- Production email/Teams delivery credentials
- Billing, invoicing, rate cards, or revenue recognition
- AI, Gemini, assistants, forecasting intelligence, or recommendations
- Kanban/task management
- Broad workflow engine
- Payroll or HRMS replacement

Out-of-scope commercial/product-adjacent items can be considered later, but they must not block the Workforce OS handover.

---

## 3. Workforce OS Implementation Vision

The v4 strategic BRD positioned the product as an employee-first workforce operating system. That direction is now accepted as the enterprise implementation target, delivered in phased, feature-flagged releases.

Long-term product promise:

```text
One trusted operational layer for employees, capacity, availability, allocations, time, approvals, notifications, reporting, and governance.
```

| Workforce OS Module | BRD Intent | Current Status | Implementation Decision |
|---|---|---|---|
| Employee Master as root | Employee data feeds identity, reporting, capacity, allocations, timesheets, approvals, leave, notifications, and Teams identity. | Partially complete | Included now; identity/leave/Teams fields are the bridge into Workforce OS phases. |
| ESS Portal | Employee self-service for profile, allocations, timesheets, leave, notifications, and manager views. | Phase 2 in progress | Feature-flagged ESS home now shows profile, leave balances, pending requests, and leave-adjusted availability. |
| Leave Management | Leave requests, balances, policies, calendars, approvals, and utilization availability impact. | Phase 2 in progress | Leave data model, backend APIs, local/demo services, self-service UI, team calendar, admin policy view, balance report, and availability report are implemented. |
| Approval Management | Common approval model for timesheets, leave, allocation changes, delegations, and SLAs. | Phase 3 in progress | Shared approval records, approval inbox/history, delegation model, SLA report, and timesheet/leave approval linkage are implemented. |
| Notification Center | Role/scope/event based in-app, email, and Teams notifications. | Phase 4 in progress | In-app notification events, templates, preferences, delivery attempts, mock provider logging, and notification center UI are implemented. |
| Microsoft Teams | Personal tab, deterministic bot commands, Adaptive Cards, and secure action tokens. | Phase 5 complete foundation | Teams user links, deterministic action tokens, mock action execution, event logs, and health UI/API are implemented; real Graph credentials remain company handover work. |
| Microsoft Entra SSO | Enterprise identity and group-to-role mapping. | Phase 5 complete foundation | Identity provider links, Entra group-role mappings, mock/local adapter surface, event logs, and health UI/API are implemented; production SSO remains company handover work. |
| Resource Planning Board | Availability-aware allocation planning and bench/roll-off visibility. | Phase 1 foundation | Feature-flagged route foundation now; planning reports/UI in Phase 6. |
| Workforce Command Center | Executive dashboard with utilization, availability, attention items, and data confidence. | Partial | Current dashboard exists; enterprise command-center route foundation now; upgraded reports in Phase 6. |
| Reports | Utilization, allocation, timesheet, data-quality, leave, notification, and audit reports. | Partial | Core reports exist; leave/notification/approval/planning reports added by phase. |

This preserves the stable Production Core while making the career-grade Workforce OS implementation explicit and actionable.

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
API_SESSION_TTL_HOURS=<number>
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
VITE_FEATURE_LEAVE=true|false
VITE_FEATURE_NOTIFICATIONS=true|false
VITE_FEATURE_TEAMS=true|false
VITE_FEATURE_ENTRA=true|false
VITE_FEATURE_PLANNING=true|false
```

### Implemented API Surface

- `GET /api/health`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/switch-role`
- `GET /api/auth/me`
- `POST /api/auth/change-password`
- `POST /api/users/:id/password-reset`
- Employee, client, project, allocation, timesheet, leave, holiday calendar, settings, catalog, Country Director, role, audit, and import/export endpoints
- `GET /api/reports/planned-utilization`
- `GET /api/reports/actual-utilization`
- `GET /api/reports/forecast-utilization`
- `GET /api/reports/data-quality`
- `GET /api/reports/dashboard`
- `GET /api/reports/availability`
- `GET/POST /api/leave/requests`
- `PATCH /api/leave/requests/:id/status`
- `GET/POST /api/leave/policies`
- `GET/POST /api/leave/balances`
- `GET/POST /api/holiday-calendars`
- `GET /api/approvals`
- `PATCH /api/approvals/:id/status`
- `GET/POST /api/approval-delegations`
- `GET /api/reports/approval-sla`
- `GET /api/notifications`
- `PATCH /api/notifications/:id/read`
- `GET/POST /api/notification-templates`
- `GET/POST /api/notification-preferences`
- `GET /api/notification-delivery-attempts`
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
| BRD traceability UI | Complete foundation | `/governance/brd-traceability` maps new BRD modules to Production Core, future roadmap, UI status, API/data status, and next actions. |
| Enterprise feature flag foundation | Complete foundation | ESS, Leave, Approvals, Notifications, Integrations, Planning, and Command Center routes/navigation are gated by Workforce OS feature flags. |
| ESS home | Phase 2 complete foundation | `/ess` renders employee profile, leave balances, pending request count, and leave/holiday adjusted availability behind `FEATURE_LEAVE`. |
| Leave request workflow | Phase 2 complete foundation | `/leave/my` supports leave balance review and employee leave request submission; service and backend APIs persist requests with audit. |
| Team leave calendar | Phase 2 complete foundation | `/leave/team-calendar` shows scoped leave requests, approval/rejection actions, and availability timeline. |
| Leave administration and reports | Phase 2 complete foundation | `/leave/admin` shows leave policies, holiday calendars, and balance reporting; policy save is audited. |
| Leave data model and migration | Phase 2 complete foundation | `007_workforce_os_leave.sql` adds leave types, policies, policy-type mapping, holiday calendars, holidays, balances, and requests. |
| Availability-adjusted capacity | Phase 2 complete foundation | `GET /api/reports/availability` and local service calculate annual availability hours from standard weekly hours minus approved leave and holidays. |
| Leave smoke coverage | Complete | `test:leave` covers leave seed data, request submission, approval, balance impact, availability impact, and audit entries. |
| Generic approval data model | Phase 3 complete foundation | `008_workforce_os_approvals.sql` adds approval records and approval delegations with entity type, entity ID, subject employee, active role, status, comments, source, timestamps, and SLA due date. |
| Shared approval APIs | Phase 3 complete foundation | `GET /api/approvals`, `PATCH /api/approvals/:id/status`, delegation APIs, and approval SLA report are implemented with active-role data scope. |
| Timesheet/leave approval migration | Phase 3 complete foundation | Submitted timesheets and leave requests create approval records; decisions through module endpoints or `/approvals` update the shared approval record. |
| Approval workspace UI | Phase 3 complete foundation | `/approvals` renders approval inbox, history, delegations, and SLA metrics behind the Workforce OS feature flag. |
| Approval smoke coverage | Complete | `test:approvals` covers generic approval records for submitted timesheets and leave requests, linked entity decisions, and SLA rows. |
| Notification data model | Phase 4 complete foundation | `009_workforce_os_notifications.sql` adds notification events, templates, preferences, and delivery attempts. |
| Notification center UI | Phase 4 complete foundation | `/notifications` renders inbox, preferences, admin templates, and delivery monitoring behind the Workforce OS feature flag. |
| Mock notification delivery | Phase 4 complete foundation | Approval request/decision events create in-app notification events, mock delivery attempts, and notification audit records. |
| Notification smoke coverage | Complete | `test:notifications` covers notification events, read state, template editing, and mock delivery logging. |
| Identity integration foundation | Phase 5 complete foundation | `/integrations/identity` renders identity provider links, Entra role mappings, integration health, and event logs behind `FEATURE_ENTRA`. |
| Teams integration foundation | Phase 5 complete foundation | `/integrations/teams` renders Teams user links, deterministic Teams action tokens, integration health, and event logs behind `FEATURE_TEAMS`. |
| Integration data model and migration | Phase 5 complete foundation | `010_workforce_os_integrations.sql` adds identity provider links, Entra group-role mappings, Teams user links, Teams action tokens, and integration event logs. |
| Integration adapter smoke coverage | Complete | `test:integrations` covers local/mock identity links, Entra role mappings, Teams links, action token execution, health, and integration events. |
| Hosted report smoke coverage | Complete foundation | Backend API and role smoke tests now cover planned, actual, forecast, dashboard, and data-quality report endpoints. |
| CSV import templates | Complete | Templates exist and are covered by `test:import-templates`. |
| Backend CSV apply endpoints | Complete foundation | Employees, clients, projects, allocations, and timesheets apply endpoints exist. |
| Import duplicate-row guardrails | Complete foundation | Employee, client, project, and allocation backend imports reject duplicate identifiers inside a single file instead of silently upserting later rows. |
| Password change/reset foundation | Complete foundation | Self-service change, Admin/HR reset endpoints, hashing, and audit exist. |
| Configurable session lifetime | Complete foundation | `API_SESSION_TTL_HOURS` now controls signed token expiry and HTTP-only session cookie max age; login and role switch responses expose `sessionExpiresAt`. |
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
| P0 | Auth operations | Session lifetime is configurable. Remaining work: final password policy, reset channel, initial admin users, lockout persistence policy, refresh behavior, and user lifecycle sign-off. | Yes |
| P0 | Backup/restore | Define backup frequency, retention, restore owner, and run at least one restore test. | Yes |
| P0 | Monitoring/logging | Add production log ownership, health monitoring, and alert channel. | Yes |
| P0 | Audit governance | Finalize retention, export permissions, and immutable audit expectations. | Yes |
| P1 | Backend report parity | Hosted smoke coverage now includes core report endpoints. Remaining work: DB-backed calculation fixtures, client/CD report reconciliation, and browser validation against real/UAT data. | No |
| P1 | Import hardening | Duplicate identifier handling is implemented for core master-data imports. Remaining work: real CSV UAT, rejected-row workflow validation with business files, duplicate-resolution policy sign-off, and operational import runbook rehearsal. | Partly |
| P1 | Automated browser QA | Add Playwright or equivalent workflows for core roles and high-risk journeys. | No |
| P2 | Code consolidation | Continue reducing table/filter/report duplication after UAT stabilizes requirements. | No |
| P2 | Loading/error polish | Standardize save/loading/error states across every API-backed page. | No |

---

### BRD Feature to UI/API Traceability

| BRD Feature | Production Core Decision | UI Status | API/Data Status | Plan Status |
|---|---|---|---|---|
| Employee Master as root | Included now | Employee Master, Employee Detail, imports, data quality | Backend employee APIs and production fields exist | Complete foundation; real data pending |
| ESS / Employee Workspace | Partially included now | My Workspace and My Timesheet exist | Employee-scoped APIs and timesheet APIs exist | Partial; leave/notifications deferred |
| Client and Project Master | Included now | Client Portfolio, Project Master, Project Detail | Backend client/project APIs and imports exist | Complete foundation; UAT pending |
| Allocation Management | Included now | Allocation Control and project/employee allocation entry points | Backend allocation APIs and import guardrails exist | Partial; deeper UAT pending |
| Timesheet Management | Included now | My Timesheet and Timesheet Governance | Backend timesheet, entries, status, approval, import APIs exist | Partial; PM/Team Lead rules pending |
| Workforce Command Center | Included now | Dashboard and Data Quality | Dashboard and data-quality report endpoints exist | Partial; real-data validation pending |
| Reports | Included now for core reports | Planned, Actual, Forecast, Data Quality, Audit, Import/Export | Core report endpoints and hosted smoke coverage exist | Partial; DB fixtures/browser QA pending |
| Import / Export | Included now as CSV-first | Import / Export center with dry run, errors, history, and exports | Backend apply endpoints, duplicate-row guardrails, logs | Partial; real-file UAT pending |
| Audit and Governance | Included now | Audit Trail, Governance Settings, Data Quality | Backend audit metadata and constrained audit events exist | Partial; retention/sign-off pending |
| Leave Management | Feature-flagged Workforce OS phase | ESS, My Leave, Team Calendar, and Leave Admin available when `FEATURE_LEAVE` is enabled | Leave tables, APIs, approvals, balances, holidays, and availability report exist | Phase 2 complete foundation; UAT/hardening pending |
| Notification Center | Feature-flagged Workforce OS phase | Notification center available when `FEATURE_NOTIFICATIONS` is enabled | Events, templates, preferences, delivery attempts, and mock delivery logging exist | Phase 4 complete foundation; production adapters pending |
| Microsoft Teams | Feature-flagged Workforce OS phase | Teams Mapping available when `FEATURE_TEAMS` is enabled | Teams user links, deterministic action tokens, mock execution, health, and event logs exist | Phase 5 complete foundation; Graph credentials/UAT pending |
| Microsoft Entra SSO | Feature-flagged Workforce OS phase | Identity Mapping available when `FEATURE_ENTRA` is enabled | Identity provider links, Entra group-role mappings, health, and event logs exist | Phase 5 complete foundation; production SSO credentials/UAT pending |
| Resource Planning Board | Feature-flagged Workforce OS phase | Route foundation available when `FEATURE_PLANNING` is enabled | Allocation/report data can support implementation | Phase 6 implementation pending |

The same mapping is available in the application at `/governance/brd-traceability` for reviewers and UAT leads.

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

## 13. Workforce OS Phased Implementation

Implement these in order behind feature flags, updating BRD traceability, tests, runbooks, and UAT evidence after each phase:

1. Phase 1: enterprise feature flags, route foundations, adapter-first configuration, and traceability.
2. Phase 2: ESS and Leave Management. Core leave model, APIs, ESS, self-service leave, team calendar, admin policy view, balance report, availability report, and smoke test are complete; remaining hardening is richer manager hierarchy, accrual automation, calendar UX, and browser UAT evidence.
3. Phase 3: generic approval engine. Shared records, APIs, approval workspace, delegation model, SLA report, and timesheet/leave approval linkage are complete; remaining hardening is allocation-change approvals, delegation enforcement in decision routing, and browser UAT evidence.
4. Phase 4: notification center with in-app, mock email, and mock Teams adapters. In-app events, templates, preferences, delivery attempts, mock delivery logging, UI, and smoke coverage are complete; remaining hardening is SMTP/Graph adapter implementation, Teams provider credentials, template variable rendering, and browser UAT evidence.
5. Phase 5: Entra-ready identity mapping and deterministic Teams action foundation. Identity links, group-role mappings, Teams user links, deterministic action tokens, mock execution, event logs, integration health, UI, migration, and smoke coverage are complete; remaining hardening is Microsoft Graph/Entra credential wiring, action-token external URL signing policy, and browser UAT evidence.
6. Phase 6: resource planning board and upgraded workforce command center.
7. Phase 7: production readiness hardening for all new modules.

Billing, AI, and Kanban/task management remain excluded from this enterprise build.
