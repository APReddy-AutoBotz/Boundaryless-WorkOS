# Resource Utilization Tracker — Version 2 Production Readiness Requirements & QA Brief

**Document Owner:** AP  
**Application:** Resource Utilization Tracker  
**Target Stack:** React + TypeScript + Tailwind CSS frontend, Node.js API backend, PostgreSQL database  
**Current State:** Near-production internal product build with local demo mode, Render/Supabase backend deployment, dual-mode async service layer, PostgreSQL schema/migrations/seed, scoped backend APIs, backend settings/timesheet/import-export history support, backend utilization report endpoints, backend CSV import apply endpoints, and handover documentation
**Last Reconciled:** 6 May 2026
**Next Step:** Disable demo reseeding before real data edits, run browser UAT by role, replace personal Supabase/Render with company-owned infrastructure, validate backend-mode report/import flows end to end, harden password lifecycle/operations, and load real data

---

## 1. Purpose

This document guides Antigravity in evaluating and upgrading the current Resource Utilization Tracker codebase into a near-production internal web application.

The application should manage:

- Employee/project allocation percentages
- Weekly client-related timesheets
- Country Director/Country Lead approval workflow
- Planned utilization
- Actual utilization
- Forecast utilization
- Company-wide and Country Director-wise visibility
- Employee and project master data
- Client master data
- Auditability and governance

This should no longer be treated as a static prototype. It should behave like a real internal business application with working routes, working forms, working filters, persisted data, role-based access behavior, and backend-ready architecture.

---

## 2. Product Positioning

The system is an internal **Resource Allocation, Timesheet Approval, and Utilization Forecasting Platform**.

It is not intended to be:

- A leave management system
- Payroll system
- Billing/invoicing system
- HRMS replacement
- Advanced skill-based staffing tool
- Scenario simulation engine

For Phase 1 / near-production readiness, the system should focus on reliable manual data entry, clean workflows, and accurate utilization reporting.

---

## 3. Business Context

The company currently uses an Excel-based resource utilization tracker. The new application should replace Excel as the primary operational tool after go-live.

Because the organization currently has a limited number of employees and projects, master data can be maintained manually within the application. Bulk import/export is useful, but manual maintenance should be fully supported and reliable.

---

## 4. Primary Objectives

The application must:

1. Provide a centralized source of truth for employees, clients, projects, allocations, and client-related timesheets.
2. Allow manual creation and maintenance of employee and project records.
3. Track project allocation percentages per employee.
4. Track weekly client/project-related timesheet hours.
5. Route timesheets to Country Directors/Country Leads for approval.
6. Calculate planned utilization from allocations.
7. Calculate actual utilization from approved client-related timesheet hours.
8. Forecast utilization for the next 1–3 months using future allocation dates.
9. Provide company-level and Country Director-level dashboards.
10. Support multi-Country Director mapping for employees.
11. Maintain audit logs for critical actions.
12. Be ready for real backend integration using Node.js and PostgreSQL.

### 4.1 Current Enhancement Decisions

The following product decisions have been added based on implementation review and user feedback:

- Dashboard should prioritize operational decisions, not decorative charts.
- Country Director portfolio should be compact enough to review without excessive scrolling.
- Country Director cards should show planned utilization, actual utilization, FTE, active projects, and clients in scope.
- Country Director client scope should open a client/project/resource view.
- FTE values in Country Director context should route to the mapped employee list or equivalent filtered employee view.
- Project cards/lists should not show confusing project-level utilization percentages as if projects themselves are utilized.
- Project pages should show assigned resources, role/designation, allocation percentage, actual contribution, Country Director mapping, and Project Manager ownership.
- Allocations may be initiated from project detail, employee detail, or allocation control, but allocation editing should remain logically centralized and return the user to the originating context.
- Employee detail changes should happen from Employee pages.
- Project detail changes should happen from Project pages.
- Allocation percentage changes may be made by Admin, HR, Country Director, or Project Manager where permissions allow.
- Project Managers can also have allocation percentages on projects.
- Planned utilization comes from allocation records.
- Actual utilization comes from approved employee timesheets.
- Client distribution is more valuable than generic project distribution for leadership and HR views.
- Clients should be maintained as master data, not only inferred from project text.
- Client rename/deactivation must cascade or guard dependent project/reporting data.
- Demo data should be realistic enough to test every major feature without manual setup.

---

## 5. Target Technology Direction

### Frontend

- React
- TypeScript
- Tailwind CSS
- Minimal animation only where useful
- Component-based structure
- Clear route structure
- No unnecessary UI framework lock-in
- No Firebase/Supabase dependency unless explicitly approved later

### Backend

- Node.js
- Express.js or similar structured API framework
- PostgreSQL
- REST API preferred for Phase 1
- Backend-enforced role checks
- Backend-enforced validation
- Environment-based configuration

### Database

- PostgreSQL
- Relational schema with foreign keys
- Proper indexes for filters/search/reporting
- Migration scripts or schema setup SQL
- Seed data support for demo and testing

### Deployment

- Company server or approved internal environment
- HTTPS required for production
- Environment variables for secrets/config
- No hardcoded credentials
- Clear build/run instructions

---

## 6. Application Roles

The system must support these roles:

1. Employee
2. Team Lead
3. Project Manager
4. Country Director / Country Lead
5. HR
6. Admin

Role behavior must be enforced in both frontend navigation and backend APIs when backend is introduced.

---

## 7. Role-Based Requirements

### 7.1 Employee

An employee can:

- Log in
- View own profile
- View own assigned projects
- View own allocation details
- Enter weekly client/project-related timesheet hours
- Add client miscellaneous task entries where applicable
- Save timesheet as draft
- Submit timesheet for approval
- View approval/rejection status
- View rejection reason
- Correct and resubmit rejected timesheets

An employee cannot:

- View all company employees
- View all company projects unless assigned
- Approve timesheets
- Edit allocation records
- Access admin settings
- Access audit logs

### 7.2 Team Lead

A Team Lead can:

- View mapped team members
- View team-level utilization where allowed
- View timesheet status of team members if business rules permit
- Support operational tracking

A Team Lead cannot:

- Access full company data unless additionally assigned
- Override Country Director approval unless explicitly configured

### 7.3 Project Manager

A Project Manager can:

- View projects assigned to them
- View employees allocated to their projects
- Manage allocation requests/entries for their projects if permitted
- View project-wise utilization
- View timesheet data related to their projects if permitted

A Project Manager cannot:

- View all unrelated projects
- See all company timesheets
- Approve Country Director-owned timesheets unless explicitly allowed

### 7.4 Country Director / Country Lead

A Country Director can:

- View all employees mapped to them
- View employees mapped to them even if those employees are also mapped to another Country Director
- View projects involving their mapped employees
- View Country Director-level utilization metrics
- View submitted timesheets from mapped employees/resources
- Approve submitted timesheets
- Reject submitted timesheets with mandatory rejection reason
- View planned, actual, and forecast utilization for their scope

A Country Director cannot:

- Submit own timesheet by default
- See unrelated Country Director data unless Admin or explicitly permitted
- Modify admin settings

### 7.5 HR

HR can:

- View employee master
- Add/edit/deactivate employees if permitted
- Maintain employee details such as designation, department, status, reporting mappings
- View utilization reports if permitted

HR cannot:

- Approve timesheets unless explicitly configured
- Manage allocations unless explicitly configured
- Access admin settings unless additionally assigned

### 7.6 Admin

Admin can:

- Access all modules
- Manage users and roles
- Add/edit/deactivate employees
- Add/edit/deactivate projects
- Manage allocations
- View and manage system settings
- View audit logs
- Export data
- Configure thresholds and policies

Admin should not submit timesheets as a normal employee unless a clearly labeled demo/test mode is enabled.

---

## 8. Core Data Relationships

### 8.1 Employee to Project

- One employee can be assigned to multiple projects.
- One project can have multiple employees.
- This is a many-to-many relationship represented through allocation records.

### 8.2 Employee to Country Director

- One employee can be mapped to one or more Country Directors.
- One Country Director can have multiple employees.
- Employees mapped to multiple Country Directors must appear in each mapped Country Director view.
- Company-wide totals must count each employee only once.

### 8.3 Employee to Timesheet

- One employee can have multiple weekly timesheets.
- Each timesheet belongs to one employee and one reporting week.
- A submitted timesheet is routed to the mapped Country Director/Country Lead for approval.

### 8.4 Timesheet to Entries

- One weekly timesheet can contain multiple rows.
- Rows may represent assigned project work or client miscellaneous task.
- Internal Boundaryless work must not be captured in this timesheet module.

---

## 9. Key Business Rules

### 9.1 Allocation Rules

Each allocation must capture:

- Employee
- Project
- Allocation percentage
- Start date
- End date
- Billable/client-related indicator
- Status
- Optional comments

Rules:

- Active allocations contribute to planned utilization.
- Completed/inactive projects should not contribute to current planned utilization.
- Allocation date ranges must be respected.
- If overlapping allocations push employee load above configured threshold, the system must warn or block based on admin settings.
- Over-allocation should be visible to Admin, Project Manager, and relevant Country Director.

### 9.2 Timesheet Rules

Timesheets must capture only client/project-related effort.

Allowed entries:

1. Assigned project work
2. Client miscellaneous task

Not allowed:

- Internal Boundaryless admin work
- Internal meetings
- Internal training
- Internal discussions
- Non-client activities

Client miscellaneous task examples:

- Client call
- Client clarification
- Client documentation support
- Client follow-up
- Client workshop preparation
- Client escalation support
- Client-related PM activity

Rules:

- Client Misc Task requires remarks if hours are entered.
- Timesheets are weekly.
- Employee can save draft.
- Employee can submit for approval.
- Country Director/Country Lead approves or rejects.
- Rejection requires reason.
- Rejected timesheet reason must be visible to the employee.
- Approved timesheets are used for actual utilization.
- Draft, submitted-but-not-approved, and rejected timesheets must not count toward actual utilization unless business rules later change.

---

## 10. Utilization Calculation Rules

### 10.0 Utilization Population / Eligibility

Utilization measures delivery capacity, not total company payroll.

Rules:

- Utilization-eligible people include delivery employees, consultants, developers, Business Analysts, Solution Architects, interns, support/delivery roles, and other client-delivery capacity.
- Admin, HR, and Country Director governance users must remain available for login, approvals, settings, ownership, and reporting, but must be excluded from planned, actual, and forecast utilization denominators.
- Project Managers count in utilization only when they have an active project allocation or project capacity contribution.
- Admin/HR/Country Director records must not be deleted just to correct utilization metrics; they must be classified as non-utilization governance users.
- Company-level, Country Director-level, planned, actual, forecast, employee filters, dashboards, and exports must use the same utilization eligibility rule.
- A future admin override may expose this as `utilizationEligible` or `capacityCategory`, but the production default rule is delivery-only.

### 10.1 Planned Utilization

**Formula:**

```text
Planned Utilization % = Sum of active allocation percentages for selected period
```

Example:

- Project A: 50%
- Project B: 40%
- Planned Utilization = 90%

Rules:

- Only active allocations should be counted.
- Allocation date ranges should be respected.
- Completed/inactive project allocations should be excluded.
- Only utilization-eligible people should be counted in utilization denominators.
- Project Manager planned allocation should contribute when the PM has an active allocation.
- If allocation total exceeds threshold, employee should be flagged as overloaded.
- If allocation total is below threshold, employee should be flagged as underutilized or bench depending on rules.

### 10.2 Actual Utilization

**Formula:**

```text
Actual Utilization % = Approved client-related hours / Expected weekly hours × 100
```

Example:

- Expected weekly hours = 40
- Approved hours = 32
- Actual Utilization = 80%

Rules:

- Expected weekly hours must come from Admin/System Settings.
- Default can be 40 if no setting exists.
- Only approved client-related timesheet hours count.
- Only utilization-eligible people should be counted in actual utilization denominators.
- Project Manager approved client/project timesheet hours should contribute when the PM is allocated to that project.
- Rejected timesheets do not count.
- Draft timesheets do not count.
- Submitted but unapproved timesheets do not count unless later business rule changes.
- Internal Boundaryless work must not count.

### 10.3 Forecast Utilization

**Formula:**

```text
Forecast Utilization % = Projected allocation percentage based on future allocation date ranges
```

Required horizons:

- 1 month
- 2 months
- 3 months

Rules:

- Forecast should be based on allocation start and end dates.
- Employees rolling off projects should be identified.
- Future bench employees should be identified.
- Upcoming over-allocation should be identified.
- Forecast denominators should include only utilization-eligible people for each forecast date.
- Forecast should not rely only on static mock values.

### 10.4 Company-Level Metrics

Company-level metrics must:

- Show total active people separately from utilization-eligible FTE.
- Count each active person once in total people metrics.
- Count only utilization-eligible people in average planned, average actual, forecast, overloaded, underutilized, and bench utilization metrics.
- Show Admin/HR/Country Director governance users separately where useful.
- Not double-count employees mapped to multiple Country Directors.
- Exclude inactive employees where applicable.
- Show overall company health.

### 10.5 Country Director Metrics

Country Director-level metrics must:

- Include delivery/resources mapped to that Country Director for utilization/FTE metrics.
- Exclude the Country Director governance user from utilization/FTE metrics unless that person is separately configured as delivery capacity.
- Include mapped employees even if they are also mapped to another Country Director.
- Clearly explain that shared employees may appear in multiple CD views.
- Avoid double-counting in company-level totals.

Recommended tooltip:

```text
Employees mapped to multiple Country Directors appear in each of their mapped views. Company totals count each employee only once.
```

---

## 11. Dashboard Requirements

The dashboard must be operational and decision-focused, not marketing-style.

### 11.1 Top Row — Overall Company Metrics

Top row must always show company-wide metrics, not filtered by Country Director.

Required KPIs:

- Total People / Total Employees
- Utilization-Eligible FTE
- Governance Users where useful
- Average Utilization %
- Overloaded Employees
- Underutilized Employees
- Pending Timesheets
- Projects at Risk

### 11.2 Country Director / Region View

Replace unnecessary load trend analysis with Country Director/region-wise metrics.

Each Country Director card/row should show:

- Country Director name
- Utilization-eligible FTE / delivery resources in scope
- Average planned utilization
- Average actual utilization
- Active projects and clients in scope
- Overloaded count based on eligible delivery resources
- Underutilized count based on eligible delivery resources
- Pending timesheets
- Projects at risk if applicable

Clicking a Country Director/region should filter relevant sections below.

### 11.3 Immediate Attention Panel

Must show actionable issues such as:

- Overloaded employees
- Underutilized employees
- Projects with staffing gaps
- Pending timesheets
- Rejected timesheets requiring correction

Each item should show:

- Name/entity
- Issue
- Value
- Suggested action
- View/Fix button where applicable

### 11.4 Visual Summary

Keep charts limited and useful.

Recommended charts:

1. Utilization distribution:
   - Underutilized
   - Balanced
   - Overloaded

2. Client distribution:
   - Clients with highest resource concentration
   - Clients with the most active projects/processes
   - Clients with staffing pressure
   - Clients with under-supported delivery footprint

Avoid making historical trend charts dominant in Phase 1.

If trend charts exist, label clearly:

```text
Indicative based on current local/demo data
```

### 11.5 Project Health Table

Required columns:

- Project name
- Project manager
- Resource count
- Assigned resources with allocation percentages
- Status
- Staffing gap
- Action/view link

Project-level utilization percentages should not be shown unless clearly defined. Utilization is primarily a resource metric. Project views should instead explain who is allocated to the project, at what planned percentage, and what actual approved effort has been recorded.

### 11.6 Country Director Portfolio

The Country Director portfolio should be a premium, compact operational panel.

Each Country Director card should show:

- Region / scope
- Country Director name
- Planned utilization
- Actual utilization
- FTE count
- Active project/process count
- Clients in scope
- Clear action to open client/project/resource scope

Rules:

- Employees mapped to multiple Country Directors must appear in each relevant director scope.
- Company totals must count shared employees only once.
- Clicking FTE should route to the mapped employee list.
- Clicking clients in scope should open a scoped client portfolio showing clients, projects/processes, resources, planned allocation, and actual effort.
- Avoid vague labels such as "pressure points" unless the calculation is clearly explained and actionable.

---

## 12. Required Application Modules

### 12.1 Login / Authentication

Near-production expectations:

- Login page must work.
- Logout must work.
- Session should persist until logout.
- Role-based routing must work.
- Demo shortcuts can exist for testing, but should be clearly identified as demo/test utilities.
- Future backend should replace local authentication with secure server-side authentication.

Required demo users:

- At least one Employee
- At least one Team Lead
- At least one Project Manager
- At least one Country Director
- At least one HR
- At least one Admin

### 12.2 Employee Master

Must support:

- Add employee
- Edit employee
- Deactivate employee
- Search employee
- Filter by department
- Filter by country
- Filter by Country Director
- Filter by employee status
- Filter by utilization band
- Filter by assigned/bench status

Employee fields:

- Employee ID
- Name
- Email
- Designation
- Department
- Country
- Reporting lead
- Mapped Country Directors
- Status
- Expected/contracted hours if supported in future
- Notes/comments if required

### 12.3 Employee Detail View

Must show:

- Employee summary
- All mapped Country Directors
- All assigned projects under one roof
- Allocation percentages
- Planned utilization
- Actual utilization
- Timesheet summary
- Status and risk indicators

### 12.4 Project Master

Must support:

- Add project
- Edit project
- Deactivate/close project
- Search project
- Filter by client
- Filter by project manager
- Filter by project type
- Filter by billable/non-billable
- Filter by status
- Filter by utilization/health band

Project fields:

- Project code
- Project name
- Client
- Project manager
- Project type
- Billable/non-billable
- Start date
- End date
- Status
- Region/country if applicable
- Notes/comments

### 12.4A Client Master

Client data must be managed as explicit master data, not only as project free text.

Must support:

- Add client
- Edit client name
- Edit industry/category
- Map client to one or more Country Directors
- Deactivate client when no active/proposed/on-hold projects reference it
- Block client deactivation when active project dependencies exist
- Use client master records in Project Master client selection
- Cascade client name changes to linked project display values
- Support client-scoped project and resource drilldowns
- Support client CSV import/export
- Audit client create/update/deactivate actions

Client fields:

- Client ID
- Client name
- Industry/category
- Account owner, if used
- Country Director mappings
- Status: Active, Inactive
- Created/updated metadata

Rules:

- Project forms should prefer selecting an existing active client.
- New client creation should happen through Client Portfolio / Client Master controls or controlled import.
- Historical submitted/approved timesheets may preserve the submitted display name for audit purposes.
- Future backend implementation must enforce client uniqueness and dependency guardrails transactionally.

### 12.5 Project Detail View

Must show:

- Project summary
- All employees working under the project
- Allocation percentages by employee
- Planned allocation by employee
- Actual approved timesheet contribution by employee
- Project health
- Staffing gaps
- Related timesheet/activity summary if applicable

Project detail should derive all headcount and staffing values from active allocations, not from stale project master fields. Project Manager assignment should be shown separately and the Project Manager may also have a planned allocation percentage.

### 12.6 Allocation Management

Must support:

- Create allocation
- Edit allocation
- End allocation
- Employee-wise view
- Project-wise view
- Allocation percentage entry
- Allocation date range
- Billable/client-related flag
- Overlap warnings
- Over-allocation warning/blocking based on settings
- Update related employee/project/dashboard/reporting views
- Launching allocation edits from project detail and employee detail with return-to behavior
- Permission-based allocation editing for Admin, HR, Country Director, and Project Manager where allowed

Views:

1. Employee-wise: shows all projects under each employee
2. Project-wise: shows all employees under each project

Allocation control is the system of record for allocation records, but users should be able to start from the page that matches their intent:

- Employee page: change a resource's assignments.
- Project page: change staffing for that project.
- Allocation page: manage allocation records directly.

After saving or cancelling, the user should return to the context they came from whenever possible.

### 12.7 My Timesheet

Employee-facing module.

Must support:

- Weekly view
- Assigned project rows
- Client Misc Task rows
- Daily or weekly hour entry
- Remarks
- Save draft
- Submit for approval
- Show approval status
- Show rejection reason
- Correct and resubmit rejected timesheet

Must not include:

- Internal Boundaryless work
- Internal training
- Internal admin
- Internal meetings

### 12.8 Timesheet Approval

Country Director/Country Lead-facing module.

Must support:

- View submitted timesheets for mapped employees
- Filter by employee
- Filter by project
- Filter by week
- Filter by status
- View project hours
- View client misc task hours
- View remarks
- Approve timesheet
- Reject timesheet with mandatory reason
- Send back/correction flow if implemented
- Update actual utilization after approval

### 12.9 Planned Utilization

Must show:

- Planned utilization by employee
- Planned utilization by project
- Planned utilization by Country Director
- Planned utilization by department/team
- Overloaded employees
- Underutilized employees
- Bench employees
- Filters
- Backend/API mode should use the server-side planned utilization report endpoint where available.
- Local demo mode should produce equivalent rows through the same frontend report service fallback.

### 12.10 Actual Utilization

Must show:

- Actual utilization based on approved timesheets
- Employee-wise actual utilization
- Project-wise actual utilization
- Country Director-wise actual utilization
- Pending/rejected timesheet indicators
- Approved client misc hours if applicable
- Filters
- Backend/API mode should use the server-side actual utilization report endpoint where available.
- Non-utilization governance users should appear as directory/governance records, not as 0% bench delivery capacity.

### 12.11 Forecast Utilization

Must show:

- 1M forecast
- 2M forecast
- 3M forecast
- Future over-allocation risks
- Future bench employees
- Employees rolling off projects
- Projects with upcoming staffing pressure
- Filters
- Backend/API mode should use the server-side forecast utilization report endpoint for selected horizons where available.
- Client-side monthly snapshots may remain as UI analysis helpers until backend snapshot/report parity is fully expanded.

### 12.12 Import / Export

Near-production priority:

Manual entry is primary. Import/export is secondary.

Export should support:

- Employee data
- Project data
- Allocation data
- Timesheet data
- Utilization reports
- Audit logs where permitted

Import can be phased:

- CSV import first if feasible
- Excel/XLSX import later if required
- Backend CSV apply transactions should exist for Employee Master, Client Master, Project Master, Allocation Control, and Timesheet Import before production UAT.
- Import history should be persisted server-side in backend mode.

Validation should include:

- Required fields
- Duplicate checks
- Invalid dates
- Missing employee/project references
- Timesheet entry hours must be 0-24 per date/project row.
- Timesheet imports must validate employee, project, work type, week ending, work date, status, and future-date rules.

### 12.13 Audit Trail

Must log:

- Login/logout
- Employee create/edit/deactivate
- Project create/edit/deactivate
- Allocation create/edit/end
- Timesheet save/submit/approve/reject
- Rejection reason
- Admin settings changes
- Threshold changes
- Import/export actions if implemented

Audit record should contain:

- Timestamp
- User
- Role
- Module
- Action
- Entity type
- Entity ID/name
- Old value if applicable
- New value if applicable
- Reason/comment if applicable

### 12.14 Admin Settings

Must support:

- User/role management
- Role catalog add/delete for demo and operational setup
- Country Director catalog add/delete for Admin/HR setup
- Expected weekly hours setting
- Overallocated threshold
- Underutilized threshold
- Bench threshold
- Timesheet policy settings
- Admin demo/test mode if required
- Import/export policy settings if applicable

Settings must persist and must affect calculations.

---

## 13. Near-Production Expectations for Antigravity

Antigravity should evaluate and improve the downloaded codebase against these expectations.

### 13.1 Routing

- All sidebar routes must work.
- Detail page routes must work.
- Invalid routes should show a friendly not-found page.
- Role-restricted routes should redirect appropriately.

### 13.2 Forms

All important forms must work:

- Add employee
- Edit employee
- Add project
- Edit project
- Create allocation
- Edit allocation
- Timesheet entry
- Timesheet approval/rejection
- Admin settings

Forms must include validation, error messages, save/cancel behavior, success feedback, and persistence.

### 13.3 Filters

Filters must work across:

- Dashboard sections
- Employee Master
- Project Master
- Allocations
- Timesheets
- Planned Utilization
- Actual Utilization
- Forecast Utilization
- Audit Trail

### 13.4 Data Persistence

For near-production demo:

- Existing localStorage persistence is acceptable temporarily.
- Data must survive refresh.
- Added records must persist.
- Updated records must persist.
- Login session must persist until logout.

For production backend:

- Replace localStorage with Node.js API + PostgreSQL.
- Backend must enforce validation and role access.

### 13.5 No Decorative Buttons

No button should be purely decorative unless clearly labeled as future/placeholder.

Key buttons must function:

- Add
- Edit
- Save
- Cancel
- Submit
- Approve
- Reject
- Export
- Filter
- Clear filter
- View detail

---

## 14. Recommended PostgreSQL Data Model

Antigravity should evaluate current TypeScript models and align them with a future PostgreSQL schema.

Recommended core tables:

### Identity and Access

- users
- roles
- user_roles
- sessions or auth tokens if implemented

### Organization

- employees
- departments
- countries
- country_directors
- employee_country_director_map
- reporting_hierarchy

### Projects and Allocations

- clients
- client_country_director_map
- projects
- project_managers
- project_allocations
- allocation_history

### Timesheets

- timesheets
- timesheet_entries
- timesheet_status_history

### Settings and Governance

- system_settings
- utilization_thresholds
- audit_logs
- import_export_logs

---

## 15. API Contract Direction

Future Node.js backend should expose APIs similar to:

### Auth

- POST /api/auth/login
- POST /api/auth/logout
- GET /api/auth/me

### Employees

- GET /api/employees
- GET /api/employees/:id
- POST /api/employees
- PUT /api/employees/:id
- PATCH /api/employees/:id/deactivate

### Projects

- GET /api/projects
- GET /api/projects/:id
- POST /api/projects
- PUT /api/projects/:id
- PATCH /api/projects/:id/status

### Clients

- GET /api/clients
- GET /api/clients/:id
- POST /api/clients
- PUT /api/clients/:id
- PATCH /api/clients/:id/deactivate

### Allocations

- GET /api/allocations
- POST /api/allocations
- PUT /api/allocations/:id
- PATCH /api/allocations/:id/end

### Timesheets

- GET /api/timesheets
- GET /api/timesheets/:id
- POST /api/timesheets
- PUT /api/timesheets/:id
- POST /api/timesheets/:id/submit
- POST /api/timesheets/:id/approve
- POST /api/timesheets/:id/reject

### Reports

- GET /api/reports/dashboard
- GET /api/reports/planned-utilization
- GET /api/reports/actual-utilization
- GET /api/reports/forecast-utilization

### Import / Export

- GET /api/import-export-logs
- POST /api/import-export-logs
- POST /api/imports/employees/apply
- POST /api/imports/clients/apply
- POST /api/imports/projects/apply
- POST /api/imports/allocations/apply
- POST /api/imports/timesheets/apply

### Admin

- GET /api/settings
- PUT /api/settings
- GET /api/audit-logs

---

## 16. Non-Functional Requirements

### 16.1 Performance

The system should comfortably support:

- up to 200 employees initially
- 10–50 projects initially
- weekly timesheet entry
- dashboard/report loading within acceptable time

### 16.2 Security

Production implementation must include:

- Secure authentication
- Role-based access control on backend
- Password hashing if individual login is used
- No hardcoded secrets
- HTTPS
- Input validation
- Audit logging
- Protection against unauthorized data access

### 16.3 Usability

The application should be:

- Easy for non-technical users
- Clean and professional
- Not overloaded with technical terms
- Decision-focused
- Fast to navigate

### 16.4 Maintainability

Code should be:

- Modular
- Typed
- Componentized
- Easy to hand over
- API-ready
- Not overly dependent on AI-generated hardcoding

---

## 17. Demo Data Requirement

For realistic testing/demo, maintain at least:

- 100+ delivery employees
- 10 Project Managers
- 8 Country Directors
- 1 HR user
- 1 Admin user
- 40-60 projects/processes
- 12-15 clients
- A mix of active, proposed, on-hold, and completed projects
- Project Manager allocation records where PM effort is planned
- Employee names suitable for demos such as Emp-1, Emp-2, etc.
- Project Manager demo names such as PM-1, PM-2, etc.
- Country Director demo names such as CD-1, CD-2, etc.
- Admin demo user such as Admin-1
- HR demo user such as HR-1
- Roles such as Solution Architect, RPA Developer, Business Analyst, Project Manager, Intern, Support Team, Operations Executive, Data Analyst, QA Analyst, DevOps Engineer, Automation Lead, and similar delivery roles
- Multi-role examples such as BA + PM and Developer + Solution Architect
- Employees assigned to multiple projects with different project designations
- Employees mapped to multiple Country Directors
- Projects with multiple employees
- Clients with multiple projects/processes
- Approved, submitted, rejected, and draft timesheets
- Overloaded, underutilized, balanced, and bench examples

Current enhanced demo target:

- Around 60-70% overall planned utilization for utilization-eligible active delivery capacity.
- Enough mapped allocations to test dashboard, Country Director, client, project, employee, planned utilization, actual utilization, forecast, timesheet, and audit flows.
- Admin, HR, and Country Director demo users exist as governance users and do not reduce utilization averages.
- Project Manager demo users are counted in utilization only when they have project allocations.

Original minimum baseline:

- 30+ employees
- 10 projects
- 1 HR user
- 1 Admin user
- Employees assigned to multiple projects
- Projects with multiple employees
- Employees mapped to multiple Country Directors
- Approved, submitted, rejected, and draft timesheets
- Overloaded, underutilized, balanced, and bench examples

---

## 18. Known Accepted Limitations for Current Demo State

These are acceptable for near-production demo but must be addressed before true production:

1. Frontend data currently persists through localStorage in demo mode.
2. Multi-user concurrency is not real until the frontend is migrated to the Node/PostgreSQL API and write operations are transaction-safe.
3. Historical trend snapshots may be indicative unless monthly snapshotting is implemented server-side.
4. Real authentication is not yet production-grade, although the starter backend supports scrypt password hashes and signed sessions.
5. PostgreSQL schema, starter API, migration runner, and demo seed/provisioning exist, but frontend integration, incremental production migrations, real company data-load scripts, and full backend CRUD parity are pending.
6. Import/export may require backend or library hardening.
7. Employee-level contracted hours may be needed later for part-time resources.
8. Utilization eligibility is implemented through a default delivery-only policy and data field; a dedicated admin UI override can be added later if business owners want manual exceptions.

---

## 19. Must-Fix Before Production

Before true production go-live:

- Replace localStorage with PostgreSQL backend.
- Enforce RBAC on backend.
- Implement secure authentication.
- Add server-side validation.
- Complete incremental database migrations and production data-load process.
- Preserve the delivery-only utilization eligibility policy when replacing demo data with real employee records.
- Add error handling and logging.
- Add deployment configuration.
- Add backup/restore strategy.
- Test with real company data.
- UAT with Admin, Country Director, PM, Employee, HR roles.
- Ensure no demo-only shortcuts are enabled in production.

---

## 20. Antigravity Evaluation Checklist

Antigravity should evaluate the codebase for:

### Functional Correctness

- Are all routes working?
- Are forms functional?
- Are filters functional?
- Are calculations correct?
- Are roles enforced?
- Are dashboards data-driven?

### Code Quality

- Is code modular?
- Are components reusable?
- Are types clean?
- Is business logic separated from UI?
- Is localStorage/data logic centralized?
- Is it easy to replace with APIs?

### Data Integrity

- Are orphan records prevented?
- Are IDs consistent?
- Are inactive records handled?
- Are allocation/project/employee relationships consistent?

### UX Quality

- Is the dashboard useful?
- Is terminology business-friendly?
- Are empty states present?
- Are errors clear?
- Are workflows intuitive?

### Backend Readiness

- Can service functions be replaced with API calls?
- Are models aligned with PostgreSQL?
- Are role checks clear?
- Are calculations centralized enough to move backend-side?

---

## 21. Recommended Antigravity Task Prompt

Use this with Antigravity after uploading/exporting the code:

```text
Evaluate the current Resource Utilization Tracker codebase against the attached requirements document.

The goal is to convert this from an AI Studio-generated local interactive app into a near-production internal application foundation.

Do not redesign unnecessarily. Preserve the current Boundaryless-inspired UI direction.

Focus on:
1. code quality
2. working routes
3. working forms
4. working filters
5. correct calculations
6. role-based behavior
7. data persistence
8. service layer readiness
9. PostgreSQL backend readiness
10. removal of dead/placeholder code

Please audit the codebase and produce:
- current implementation status
- missing requirements
- bugs or broken flows
- hardcoded/mock areas
- recommended refactoring plan
- proposed backend/API integration plan using Node.js + PostgreSQL
- immediate fixes needed before leadership demo
- immediate fixes needed before near-production deployment
```

---

## 22. Final Success Criteria

The application can be considered near-production ready when:

- All key routes work.
- All major forms save data.
- Filters work.
- Login/logout and role-specific routing work.
- Country Director approval flow works.
- Employee timesheet submission works.
- Planned, actual, and forecast utilization calculations work.
- Dashboard values are data-driven.
- Audit logs are captured.
- Admin settings affect calculations.
- Data persists reliably.
- Code is clean enough for backend replacement.
- Backend integration path is clearly defined.
- Demo-only elements are clearly separated from production elements.

---

## 23. Final Guidance

This should be treated as a real internal business application.

Manual data entry is acceptable for Phase 1 because the current company size is manageable.

The immediate priority is not adding more features. The priority is making the existing scope stable, reliable, understandable, and backend-ready.

Future backend direction should remain:

```text
React + TypeScript frontend
Node.js API backend
PostgreSQL database
Company server deployment
```

---

## 24. Current Implementation Status Register

Status values:

- **Done:** Implemented and smoke-tested in the current frontend demo.
- **Partial:** Implemented enough for demo, but requires hardening, broader UAT, or backend support.
- **Pending:** Not implemented or not production-ready.
- **Failing:** Implemented or previously passing, but the latest verification currently fails and must be repaired before sign-off.
- **Needs UAT:** Implemented, but must be tested by the target role users.

Priority values:

- **P0:** Required before production go-live.
- **P1:** Required before serious UAT / near-production sign-off.
- **P2:** Important quality, maintainability, and usability improvement.
- **P3:** Nice-to-have or later phase.

### 24.0 Current Architecture Reconciliation

The current application should be described as a strong near-production frontend demo with an in-progress production API migration, not yet as a fully production multi-user system.

- The frontend service layer has moved from purely synchronous localStorage access to a dual-mode async pattern. `src/services/apiClient.ts` detects backend availability, stores API tokens, wraps fetch calls, and normalizes backend snake_case rows into frontend camelCase models.
- `src/services/api.ts` now attempts to use the backend when `/api/health` reports `database: connected`, then falls back to `DataStorage`/localStorage for demo mode.
- The backend provides a real Node/Express/PostgreSQL foundation with login, protected routes, catalog APIs, utilization report APIs, CSV import apply APIs, core write guardrails, demo seeding, production static serving, and backend contract smoke coverage.
- Production readiness now requires browser-proving the whole app in backend mode against a real PostgreSQL database, validating backend report/import flows with realistic company files, and completing company-specific security/operations hardening.
- Admin/HR users can manage operational catalogs that legitimately change over time: job roles, Country Directors, departments, countries, and industries.
- Core lifecycle statuses should remain fixed workflow enums. Employee, project, allocation, timesheet, client, and account status keys drive calculations, permissions, and lifecycle side effects, so they should not be user-editable in production. If business users need wording changes, implement display labels without changing the underlying keys.
- Redundancy has been reduced through shared UI primitives, but a full DRY pass is still pending. `PageHeader`, `KPIStrip`, `FilterBar`, `SortableHeader`, and `DataTable` exist; `DataTable` is currently adopted in Employee Master and Project Master and should be expanded carefully to other table-heavy pages after workflow UAT.
- Latest QA state as of 6 May 2026: smoke coverage has been updated for backend report/import contracts and utilization eligibility. `npm run lint`, `npm run build`, `npm run test:backend`, `npm run test:access`, and `npm run test:requirements` are expected to pass before push/deploy. Backend API smoke remains optional unless `BACKEND_SMOKE_BASE_URL` is set.

### 24.1 Product Enhancements Added

| Area | Enhancement / Requirement | Priority | Status | Notes |
|---|---|---:|---|---|
| Demo data | 100+ employee-scale demo data with PMs, CDs, HR, Admin, clients, projects, allocations, and timesheets | P1 | Done | Current demo data is suitable for feature-by-feature testing. |
| Demo data | 60 projects/processes across 12-15 clients, including completed projects | P1 | Done | Supports client, project, allocation, and forecast demos. |
| Demo data | Overall utilization-eligible planned utilization around 60-70% | P1 | Done | Current demo target supports realistic dashboard review without Admin/HR/CD governance users diluting delivery capacity. |
| Roles | Role catalog add/delete | P1 | Done | Useful for Admin/HR setup demos. |
| Master data | Department, country, and industry catalogs with add/retire guardrails | P1 | Done | Admin Settings now manages these catalogs; deletes are blocked while employees, roles, or clients still reference values. Core workflow statuses remain fixed enums. |
| Master data | Approved Admin/HR catalog governance | P1 | Done | Admin/HR can add or retire job roles, Country Directors, departments, countries, and industries. These are the master-data areas expected to change operationally. |
| Master data | Fixed lifecycle status keys | P0 | Done | Employee, project, allocation, timesheet, client, and account statuses remain controlled enums because calculations, route permissions, account disablement, project close behavior, and approvals depend on exact values. |
| Country Directors | Country Director catalog add/delete | P1 | Done | Supports Admin/HR setup demos. |
| Employee mapping | Employees can map to multiple Country Directors | P0 | Done | Company totals must continue counting shared employees once. |
| Allocation model | Employees can be assigned to multiple projects with different designations | P0 | Done | Allocation records carry role/designation context. |
| Allocation model | Project Managers can have planned allocation percentages on projects | P1 | Done | PM allocations are represented in demo data. |
| Routing | Project detail edit should stay on project detail | P1 | Done | Previously redirected unexpectedly to allocation page. |
| Routing | Employee detail edit should stay on employee detail | P1 | Done | Employee edit is now contextual. |
| Routing | Allocation edits launched from project/employee context should return to origin | P1 | Done | Return-to routing implemented and browser-tested for key flows. |
| Routing | Hyperlinks should land at the correct top-level page context | P1 | Done | Workspace content pane now resets scroll/focus on route changes so employee/project/client links do not open halfway down a previous page. Hash anchors remain supported for future section-level links. |
| Routing/access | Centralized frontend route-role matrix and detail access helpers | P0 | Done | App routes and sidebar navigation now share one route-role source, with reusable employee/project detail access checks. |
| Dashboard | Country Director portfolio redesigned into compact operational panel | P1 | Done | Premium compact layout replaces confusing card wall. |
| Dashboard | FTE click should open/filter employees mapped to that Country Director | P1 | Done | Director cards and selected scope summary link to the mapped employee list. |
| Dashboard | Clients in scope should open scoped client/project/resource view | P1 | Done | Client Portfolio view added for scoped drilldown. |
| Dashboard | Replace vague risk/pressure point labels with actionable metrics | P1 | Done | Director cards use planned, actual, FTE, active projects, clients in scope, and clear drilldown actions. |
| Dashboard | Replace project distribution with client distribution where more useful | P1 | Done | Client-focused distribution is the preferred requirement. |
| Clients | Explicit Client Master with add/edit/deactivate guardrails | P0 | Done | Client Portfolio now manages client master records, industry, CD scope, active/inactive status, guarded deactivation, and audit logs. |
| Clients | Client rename cascade to linked projects | P0 | Done | Client master rename updates linked project display values while preserving historical submitted timesheet snapshots. |
| Clients | Project creation uses active Client Master selection | P0 | Done | Project forms now select active clients instead of uncontrolled client free text. |
| Projects | Remove confusing project-level utilization percentages from project list | P1 | Done | Project list should focus on assigned resources and allocation percentages. |
| Projects | Project detail headcount must derive from allocations, not stale project fields | P0 | Done | Fixes cases such as negative or inconsistent headcount. |
| Projects | Project detail should show assigned consultants/resources and percentages | P1 | Done | Resource allocation view is now the core project detail behavior. |
| Projects | Assignment role labels must distinguish project role from employee home role | P1 | Done | Project detail, employee detail, and allocation control now label project-specific role, home role, and practice explicitly to avoid stale-data confusion. |
| Allocations | Admin, HR, Country Director, and Project Manager can manage planned allocation where permitted | P0 | Partial | Frontend scoping exists; backend enforcement is pending. |
| Timesheets | Actual utilization should update from approved timesheets only | P0 | Done | Frontend calculation/service behavior implemented. |
| Timesheets | Future-week timesheet save/submit must be blocked | P1 | Done | My Timesheet locks future-week navigation and the service rejects future-week saves/submissions. Submitted entries also cannot contain future-dated hours. |
| Timesheets | Timesheet Approval rejection modal, bulk approve, CSV ops export, and PM project-ID scoping | P1 | Done | Replaces prompt/alert behavior and removes decorative approval actions. |
| Forecast | Point-in-time 1M/2M/3M utilization snapshots | P1 | Done | Forecast page now uses monthly checkpoints from allocation/project date ranges instead of broad horizon overlap totals. |
| Forecast | Dynamic pressure, roll-off, and bench analysis | P1 | Done | Removed static forecast assumptions and replaced them with peak pressure, horizon roll-offs, future bench, and date-driven ledger values. |
| Utilization eligibility | Delivery-only denominator with governance users excluded | P0 | Done | Admin, HR, and Country Directors stay visible for directory/governance workflows but are excluded from planned, actual, and forecast utilization denominators. Allocated PMs remain counted. |
| Utilization UI | Excluded-capacity users labeled clearly | P1 | Done | Employee Master, Employee Detail, and capacity cards show governance users as excluded from utilization instead of Bench/0% delivery capacity. |
| Utilization reports | Dual-mode frontend report service | P0 | Done | Planned, Actual, and Forecast pages consume `utilizationReportService`, which calls backend report endpoints in API mode and computes equivalent local fallback reports in demo mode. |
| Audit | Audit Trail should read persisted audit logs, not static mock data | P1 | Done | Audit page now uses stored logs. |
| Import/export | CSV export for main entities and reports | P1 | Done | CSV export exists for employees, clients, projects, utilization, timesheet logs, allocation matrix, and audit logs. |
| Import/export | Dry-run CSV import with row-level validation report and live import/export history | P1 | Done | Employee, client, project, allocation, and timesheet imports validate before writing, apply only valid rows on confirmation, and replace placeholder import history with persisted operation logs. |
| Import/export | Backend CSV apply transactions | P0 | Done | Backend apply endpoints exist for Employee Master, Client Master, Project Master, Allocation Control, and Timesheet Import. Remaining production work is realistic file UAT, duplicate-handling refinements, and optional XLSX/PDF. |
| Logo/brand | Replace weak text logo with original Boundaryless logo asset | P2 | Done | SVG assets added under public assets. |
| Backend | Starter Node API auth middleware and route-level role checks | P0 | Done | Protected API routes now require signed token/cookie authentication and role authorization. |
| Backend | Starter PostgreSQL relational schema | P0 | Done | `server/schema.sql` includes users, roles, employees, clients, client-CD map, Country Directors, role definitions, projects, allocations, timesheets, entries, settings, audit logs, foreign keys, checks, and indexes. |
| Backend | Baseline PostgreSQL migration runner | P0 | Done | `npm run api:migrate` applies the baseline schema and records `001_initial_schema` in `schema_migrations` for version tracking. |
| Backend | Starter API routes for auth and core reads/writes | P0 | Partial | Auth, health, employee upsert/deactivate, client catalog, project create/status update, allocation create/update/soft-end, timesheet save/approve/reject, settings/CD/role/audit reads, guarded catalog writes, utilization report reads, and import apply endpoints exist. Full browser UAT, complete data-level scoping, and deeper DB-backed fixtures remain pending. |
| Backend | Utilization report APIs | P0 | Done | Planned, actual, and forecast utilization report endpoints return scoped server-side rows and summaries for frontend report pages. |
| Backend | Starter server-side business validation for write paths | P0 | Done | Project, allocation, employee deactivate, timesheet save/approval, and guarded catalog APIs now enforce active references, date ranges, project close allocation completion, login disable, future-timesheet blocking, rejection reasons, PM/CD write scoping, and optional over-allocation blocking. |
| Testing | Requirements smoke test for demo data, auth, client master cascade, planned utilization, actual utilization, forecast snapshots, PM allocations, future timesheet blocking, and company metrics | P0 | Done | Added `npm run test:requirements` for fast regression coverage without a new test framework. |
| Testing | Frontend route/access smoke test for Admin, HR, PM, CD, and Employee flows | P0 | Done | Added `npm run test:access` to protect role-scoped route visibility and employee/project detail access rules. |
| CRUD lifecycle | Employee quick deactivate with login disable sync | P1 | Done | Employee Master now exposes a direct deactivate action and the service immediately disables the generated account. |
| CRUD lifecycle | Project quick close with active allocation end | P1 | Done | Project Registry now exposes a close action; closing a project completes active allocations for the project. |
| CRUD lifecycle | Allocation delete converted to soft end | P0 | Done | Allocation deletion now completes the allocation and preserves audit history instead of removing the record. |
| CRUD lifecycle | Country Director and role delete guardrails | P0 | Done | Service layer blocks deletion when employees or allocations still reference the record. |
| Audit | Structured audit metadata and duplicate form log cleanup | P0 | Done | Service-owned actions now include entity metadata and old/new values where available; duplicate form-level logs were removed. |
| Projects | Project Manager name sync from employee record | P1 | Done | Project saves and employee name updates keep project manager display names synchronized from `managerId`. |
| Search | Global header search for employees, projects, clients, Country Directors, and key pages | P2 | Done | Search results are role-scoped and route directly to detail, filtered master, or module pages. |
| Tables | Reusable sortable table header and sort helper for master views | P1 | Done | Employee Master and Project Master table columns now support click-to-toggle ascending/descending/none sorting with high-contrast orange sort controls, tooltip labels, keyboard focus state, and `aria-sort` semantics. |
| Login UX | Keep login as internal access screen, not marketing landing page | P2 | Done | Login page now uses internal system context, authorized-access copy, restrained UAT shortcuts, Boundaryless branding, and a subtle low-opacity workspace background treatment without public marketing hero content. |
| Performance | Route-level lazy loading, suspense fallback, and targeted KPI icon imports | P2 | Done | Heavy pages are split into separate route chunks and the oversized Lucide icon chunk has been removed. |
| Exports | Core page export CTAs produce CSV files and audit activity | P2 | Done | Employee Master, Project Registry, Allocation Control, Planned Utilization, and Forecast Utilization exports now use current filter scope. |
| Maintainability | Remove unused legacy mock and placeholder page files | P2 | Done | Removed legacy static `mockData` and unused `PlaceholderPage` surfaces to reduce confusion during code review. |
| Maintainability | Centralize fixed workflow status values | P1 | Done | Added shared status constants for user, client, employee, project, allocation, and timesheet lifecycle values; forms and master filters now consume the constants instead of duplicating literals. Status keys remain fixed business enums. |
| Maintainability | Reusable DataTable shell for stable master tables | P2 | Done | Added a shared `DataTable` wrapper and migrated Employee Master and Project Master table shells while preserving existing row rendering, sorting, and visual behavior. |
| Maintainability | Shared UI primitive inventory | P2 | Partial | `PageHeader`, `KPIStrip`, `FilterBar`, `SortableHeader`, and `DataTable` now exist. The next refactor should expand them to Audit, Timesheet Governance, Allocation Control, Import/Export, and report tables without changing page behavior. |
| Maintainability | Reduce utilization/report page duplication | P2 | Pending | Planned, Actual, and Forecast pages still share similar filtering, KPI, and report-card patterns. Extract shared report components only after calculation UAT to avoid hiding domain differences. |
| Maintainability | Frontend service adapter for backend migration | P0 | Partial | `apiClient.ts` now provides backend detection, token storage, fetch wrapper, and response normalizers. Remaining work: route parity, async form await fixes, backend-mode UAT, and environment-controlled mode selection. |
| Backend migration | Dual-mode frontend services | P0 | Partial | `api.ts` now prefers REST APIs when PostgreSQL is connected and falls back to local demo storage. This is a good migration direction, but API mode is not yet production-proven. |
| Backend migration | Backend route parity for current frontend calls | P0 | Partial | Settings write, backend timesheet IDs/entries, utilization report reads, and import apply endpoints exist. Remaining work is browser UAT across every route plus final edge-case parity for reports, imports, and role-scoped writes. |
| QA | Smoke tests after async service migration | P0 | Passing | `npm run lint`, `npm run build`, `npm run test:backend`, `npm run test:access`, and `npm run test:requirements` have been reconciled for async services, demo v7, utilization eligibility, and report/import contracts. |
| UX hardening | Replace browser alerts/confirms with in-app confirmation and notice patterns | P2 | Done | Login errors, timesheet messages, allocation validation, employee deactivation, project close, allocation end, dashboard reminders, and Admin Settings guardrails now use app UI. |
| Admin Settings | Replace dead governance CTAs with clear behavior | P2 | Done | Recalculate Bounds now saves/refreshed settings; unavailable invite/branding actions show explicit product notices instead of silent no-ops. |
| Audit Trail | Filtered audit exports, quick event filters, detail export, and entity navigation | P2 | Done | Audit export now respects current filters, quick filters cover today's events and critical governance actions, and detail drawer actions are wired. |
| Backend catalog parity | Department, country, and industry catalogs persisted in PostgreSQL | P0 | Done | Added `catalog_items` schema, seeded production catalogs, authenticated catalog read routes, guarded Admin/HR create/update/deactivate routes, audit logging, and dependency blocking for in-use catalog values. |
| Deployment | Single-process production startup serves API and built frontend | P0 | Done | Added `npm start`, production env validation, and Express static serving for `dist` with SPA fallback after API routes. |
| Security | Login rate limiting and production secret guardrails | P0 | Done | Backend login now has an in-memory brute-force throttle and production startup blocks unsafe/missing `DATABASE_URL` or `API_SESSION_SECRET`. |
| Backend seed | PostgreSQL demo seed/provisioning for multi-user UAT | P0 | Done | Added `npm run api:seed:demo` with optional `-- --reset` to seed Country Directors, clients, employees, projects, allocations, timesheets, catalogs, role definitions, users, and user-role mappings from the canonical demo dataset. |
| Testing | Backend contract smoke test for catalog/API deployment guardrails | P0 | Done | Added `npm run test:backend` to verify catalog schema/routes, static serving, start script, demo seed script, and login-rate-limit guardrails exist. |

### 24.2 Current Requirement Status

| Requirement Area | Priority | Status | Implementation Notes / Pending Work |
|---|---:|---|---|
| Login/logout | P0 | Partial | Username/password demo login works in local mode. Backend login supports scrypt password hashes, signed token/cookie sessions, and frontend token storage. Remaining work: production password lifecycle, user provisioning, reliable backend-mode role switching, and test harness support for sessionStorage. |
| Frontend role navigation | P0 | Partial | Route guards, role-specific navigation, centralized route-role rules, and route/access smoke coverage exist for Admin, HR, Country Director, Project Manager, Team Lead, and Employee. Full multi-role browser UAT is still required. |
| Backend-enforced RBAC | P0 | Partial | Starter Node API routes enforce signed-token authentication and route-level role checks. Data-level scoping, write-path authorization, and full frontend API integration are pending. |
| Employee Master | P1 | Done | Add/edit/deactivate/search/filter/sort, catalog-backed department/country filters, CD scope filtering, CSV export, and employee detail flows are implemented for demo. Needs backend validation parity later. |
| Employee Detail | P1 | Done | Shows mapped CDs, assignments, utilization, project-role labels, and allocation entry points. |
| Client Master | P0 | Done | Add/edit/deactivate, catalog-backed industry selection, CD scope mapping, dependency guardrails, client-scoped drilldowns, CSV import/export, and project rename cascade are implemented in the current frontend. Backend transaction parity is still required. |
| Project Master | P1 | Done | Add/edit/close/search/filter/sort, active client master selection, CD/client scoped routing, CSV export, resource allocation summaries, and detail routing are implemented for demo. |
| Project Detail | P1 | Done | Shows allocation-derived staffing, assigned consultants, project role vs home role, planned allocation, actual contribution, PM ownership, and allocation entry points. |
| Allocation Management | P0 | Partial | Create/edit/soft-end allocation works in frontend with scoped views and return-to-origin routing. Server-side validation, permissions, and concurrency handling are pending. |
| Operational catalogs | P1 | Done | Admin/HR management exists for role definitions, Country Directors, departments, countries, and industries with guarded delete/deactivate behavior. Backend catalog APIs exist for departments/countries/industries; frontend still needs API cutover for production persistence. |
| Workflow statuses | P0 | Done | Status keys are intentionally fixed enums and centralized in shared constants. Do not expose raw lifecycle status creation/deletion to users; add configurable display labels later only if needed. |
| Planned utilization | P0 | Done | Uses active allocations, project status, project dates, allocation date ranges, and utilization eligibility. Planned report page consumes the dual-mode report service. |
| Actual utilization | P0 | Done | Uses approved client-related timesheets only, excludes governance users from delivery capacity, and consumes report rows through the dual-mode report service. |
| Forecast utilization | P1 | Done | Uses allocation/project date ranges for point-in-time 1M/2M/3M snapshots, dynamic roll-offs, future bench, peak demand pressure, CSV export, and backend forecast rows where available. |
| My Timesheet | P1 | Partial | Draft/submit flows exist and future-week submissions are blocked in UI and service logic. Needs full UAT for rejected correction/resubmit and week edge cases. |
| Timesheet Approval | P1 | Needs UAT | Rejection modal, mandatory reason, filtered Ops CSV export, filtered Admin bulk approve, and PM scoping by project ID are implemented. Final role-based UAT is pending. |
| Dashboard | P1 | Done | Company KPIs, CD portfolio, attention queue, and value-added operational views are implemented for demo. |
| Country Director scope | P1 | Partial | Multi-CD mapping and scoped portfolio exist. Needs CD role UAT for all drilldowns. |
| Client Portfolio | P1 | Done | Supports client master cards, CD/client/project/resource drilldown, active project/resource coverage, and client master maintenance for Admin/HR. |
| Import/export | P1 | Partial | CSV export, dry-run import, apply-valid-rows workflow, row-level validation report, live operation history, and backend apply endpoints are implemented for employee/client/project/allocation/timesheet data. XLSX/PDF exports, deeper duplicate resolution, and realistic-file UAT remain pending. |
| Audit Trail | P0 | Partial | UI reads persisted logs, supports filtered exports/detail review, and service-owned actions include structured metadata. Production immutable server-side audit is still pending. |
| Admin Settings | P1 | Partial | Thresholds, settings, role catalog, department catalog, country catalog, industry catalog, CD catalog, guarded delete flows, and demo reset are available. PostgreSQL-backed catalog APIs now exist; frontend still needs HTTP service migration for production persistence. |
| Not-found route | P2 | Done | Invalid routes render a branded not-found view with navigation back to the dashboard. |
| Empty/error states and dead actions | P2 | Partial | Export CTAs and major action feedback are functional and audited; browser alert/confirm flows were replaced with app-native notices/modals. Remaining work: finish consistent empty states across every report table and edge workflow. |
| Search/header global search | P2 | Done | Header search is wired to live employees, projects, clients, Country Directors, and navigation pages with role-scoped results. |
| Shared table/filter components | P2 | Partial | Sortable headers and `DataTable` are adopted in Employee Master and Project Master. `PageHeader`, `KPIStrip`, and `FilterBar` exist, but table/filter standardization across all remaining pages is still pending. |
| Automated tests | P0 | Passing smoke level | `npm run lint`, `npm run build`, `npm run test:backend`, `npm run test:access`, and `npm run test:requirements` are reconciled. Formal unit/API/Playwright suites and backend-mode browser UAT are still pending. |
| Backend/API | P0 | Partial | Node.js API scaffold, PostgreSQL schema, scrypt login, signed token/cookie session, protected starter routes, client catalog endpoints, employee/project/allocation/timesheet write guardrails, approval/rejection endpoint, guarded role/CD/catalog writes, utilization report endpoints, import apply endpoints, production static serving, demo seed/provisioning, login throttling, and frontend normalizers exist. Remaining work: backend-mode browser UAT, complete data-level authorization, real-file import UAT, and company security/ops hardening. |
| PostgreSQL schema | P0 | Partial | Starter relational schema and migration runner exist with tables, foreign keys, checks, indexes, clients, client-CD mapping, production catalog items, and demo seed data loading. Remaining work: incremental migration files instead of full-schema replay, seed scripts for real company data, row-level policies, migration rollback, and production data load process. |
| Security hardening | P0 | Partial | Backend now blocks unsafe production startup and throttles login attempts. Remaining work: HTTPS/proxy deployment verification, password policy/reset, CSRF strategy for cookie sessions, complete input validation coverage, data-level authorization, backup/restore, and production logging. |
| Bundle optimization | P2 | Done | Route-level lazy loading and targeted shared icon imports removed the production large-chunk warning. |

### 24.3 Current Feature Snapshot

#### Done in the Current Frontend Demo

- Demo dataset: 120 total people, 116 active people, 60 projects/processes, 262 allocations, 320 timesheets, 8 Country Directors, 15 explicit client master records, active/proposed/on-hold/completed project mix, PM allocations, multi-CD mappings, and 60-70% planned utilization across utilization-eligible delivery capacity.
- Authentication demo: username/password login, assigned-role selection, logout, generated user accounts, disabled login for exited employees, and demo shortcuts.
- Role-aware frontend: protected routes, role-based navigation, Admin/HR/CD/PM/Team Lead/Employee access paths, and scoped views where implemented.
- Employee workflows: add, edit, deactivate, filter, search, CD-scope filtering, detail page, mapped directors, active projects, utilization, excluded-governance labeling, and CSV export.
- Client workflows: add, edit, guarded deactivate, industry metadata, CD-scope mapping, active client cards, client-scoped project/resource drilldown, CSV import/export, and project rename cascade.
- Project workflows: add, edit, close, filter, search, active client master selection, CD/client scope filtering, allocation-derived resource display, detail page, PM ownership, resource percentages, and CSV export.
- Allocation workflows: create, edit, soft-end, scoped by role, return-to-origin routing from employee/project detail, allocation validation notices, and CSV export.
- Timesheet self-log: assigned project entries, client miscellaneous entries, mandatory remarks for client misc work, save draft, submit, rejected correction view, future-week blocking, and service-level future-date guard.
- Timesheet governance: approval/rejection modal, mandatory rejection reason, bulk approve for filtered Admin scope, PM project-ID scoping, filtered Ops CSV export, and approved-only actual utilization.
- Utilization reports: planned utilization, actual utilization, forecast utilization, backend report endpoints, dual-mode frontend report service, delivery-only utilization eligibility, forecast snapshots, dynamic roll-offs, future bench, peak pressure, and CSV exports.
- Dashboard and drilldowns: global KPIs, compact Country Director portfolio, FTE/project/client drilldowns, client distribution/deployment, attention queue, scoped Client Portfolio backed by client master data, and project health.
- Audit and governance: persisted audit log UI, structured metadata for service-owned actions, filtered audit exports, detail drawer export, quick filters, role/CD catalog, guarded delete flows, system thresholds, and demo reset.
- UX hardening and maintainability: Boundaryless logo asset, internal-system login page with subtle workspace background layer, current color/font direction preserved, global search with outside-click close, route-aware scroll restoration, app-native notices/modals, route-level lazy loading, branded not-found route, centralized fixed status constants, high-contrast sortable headers, shared page/KPI/filter/table primitives, reusable DataTable shell for master tables, and initial dual-mode API client normalizers.
- Starter backend: Node/Express API, PostgreSQL schema including clients, client-CD mapping, catalog items, scrypt password verification, signed token/cookie sessions, route-level role checks, core read/write endpoints, guarded catalog writes, utilization report endpoints, CSV import apply endpoints, health check, production static serving, demo seed/provisioning script, and server README.
- Current passing checks: `npm run lint`, `npm run build`, `npm run test:backend`, `npm run test:access`, and `npm run test:requirements`.

#### Partial / Needs UAT

- Frontend role navigation and role scoping need browser UAT across Admin, HR, Country Director, Project Manager, Team Lead, and Employee users.
- Allocation, client master, timesheet approval, import/export, audit, and admin settings are frontend-functional and have partial backend support, but still need backend-mode browser UAT, permission sign-off, and multi-user concurrency validation.
- My Timesheet needs role-user UAT for rejected correction/resubmit, partial week behavior, no-assignment cases, and historical week edge cases.
- Import/export supports CSV and dry-run validation for employee/client/project/allocation/timesheet data with backend apply endpoints, but XLSX/PDF, deeper duplicate resolution, and realistic company-file UAT are not production-ready.
- Empty states are improved in several places, but consistent report/table empty states still need a final pass.
- Shared UI components exist, but consistent adoption across every table/filter-heavy page is still partial. This should be handled as a low-risk refactor after role workflow UAT.
- Automated tests are smoke-level and passing after the async service/report/import updates. Formal browser automation and deeper API fixtures are still pending.
- Backend API mode has an adapter and normalizers, but still needs full browser UAT against the deployed PostgreSQL-backed Render environment.

#### Pending for Production

- Complete frontend service migration from localStorage `DataStorage` to verified Node/PostgreSQL API mode.
- Finish backend-to-frontend response mappers, async loading/error state patterns, and awaited form saves for API-backed pages.
- Full backend CRUD/write APIs for clients, projects, allocations, timesheets, approvals, imports, settings, audit, scoped reports, and exports.
- Managed database migrations, seed scripts, production data import, rollback process, and backup/restore.
- Data-level RBAC and authorization for Country Director, PM, Team Lead, HR, and Employee scopes.
- Immutable server-side audit for all critical writes.
- Secure production auth lifecycle: password policy, password reset/change, account lockout, session expiry, HTTPS-only cookies, and secret rotation.
- Production deployment configuration, monitoring, logging, HTTPS, environment secrets, and operational runbook.

### 24.4 Production Blockers

These items must be completed before the application is considered production-ready:

1. Replace frontend localStorage service calls with Node.js API calls backed by PostgreSQL.
2. Extend the baseline PostgreSQL migration runner with incremental migration files, seed scripts, rollback strategy, and production data-load process.
3. Complete secure username/password production authentication: password hashing policy, reset/change password, account lockout, cookie/session settings, and user provisioning.
4. Enforce backend RBAC and data-level scoping for every read/write API, including Country Director, PM, Team Lead, HR, and Employee scopes.
5. Move critical validation server-side, especially client/project dependency guardrails, allocation overlap/threshold rules, future timesheet blocking, approval routing, imports, admin settings, and catalog delete guardrails.
6. Add immutable server-side audit logging with actor, role, entity type, entity ID, old value, new value, reason, and timestamp for every critical write.
7. Add automated tests for calculation parity, role scoping, allocation overlap rules, timesheet approval/rejection, imports, routing, and browser workflows.
8. Complete full UAT with Admin, HR, Country Director, Project Manager, Team Lead, and Employee users.
9. Remove or clearly disable demo shortcuts, reset behavior, generated demo credentials, and localStorage demo mode in production.
10. Add production deployment configuration, HTTPS, environment secrets, logging, monitoring, backup, and restore procedures.

### 24.5 Recommended Next Implementation Order

1. **P0 frontend-to-backend migration:** switch `src/services/api.ts` from local `DataStorage` to HTTP endpoints behind an environment flag, then migrate modules one by one.
2. **P0 backend CRUD completion:** add remaining client, project, allocation, timesheet, approval, import/export, settings, audit, and scoped report endpoints.
3. **P0 server-side business validation:** starter guardrails now cover project writes, allocation writes/soft-end, PM/CD allocation scope, over-allocation blocking, project close allocation completion, employee deactivate/login disable, future timesheet blocking, approval/rejection reasons, and guarded Country Director/role catalog deletes. Remaining work: broader API parity tests, import validation endpoints, and final data-level authorization review.
4. **P0 production audit/security:** immutable audit writes, production secrets, HTTPS/session settings, password lifecycle, data-level RBAC, logging, monitoring, backup, and restore.
5. **P0/P1 automated test expansion:** calculation parity tests, API tests, route/access tests, and Playwright browser workflows for Admin, HR, Country Director, PM, Team Lead, and Employee.
6. **P1 import/export hardening:** backend-side validation, persisted import jobs, duplicate-resolution policies, XLSX/PDF support if required, and operational import history.
7. **P1 UAT and workflow polish:** role-specific UAT fixes, rejected timesheet correction/resubmit edge cases, consistent empty states, and final report copy.

### 24.6 Proposed Enhancements After Current Batch

These are not required for the current demo, but they are recommended for a production product roadmap.

| Enhancement | Priority | Proposed Status | Rationale |
|---|---:|---|---|
| API service adapter with demo/backend mode flag | P0 | In progress | Dual-mode services now exist for core entities and utilization reports; continue expanding loading/error states and backend-mode UAT. |
| Backend response mappers | P0 | In progress | PostgreSQL snake_case normalizers exist for core models, import/export logs, and utilization reports; continue hardening as endpoints expand. |
| Async data hooks for major entities | P0 | Proposed | Replace synchronous localStorage reads with loading/error/success states for employees, clients, projects, allocations, timesheets, catalogs, and audit logs. |
| API parity tests against a real PostgreSQL database | P0 | Proposed | Protect calculations, write guardrails, role scoping, catalog dependency checks, and migration behavior before multi-user UAT. |
| Playwright workflow suite | P0/P1 | Proposed | Browser-test Admin, HR, Country Director, Project Manager, Team Lead, and Employee journeys, including routing, scroll position, allocation edits, timesheet submit/approval, imports, and exports. |
| Expand `DataTable` adoption | P2 | Proposed | Standardize sorting, empty states, dense layout, and accessibility for Audit Trail, Timesheet Governance, Allocation Control, Import/Export history, and report tables. |
| Shared `FilterBar` adoption | P2 | Proposed | Reduce repeated search/filter/export controls and make filter behavior consistent across master data and report screens. |
| Utilization report component extraction | P2 | Proposed | Planned, Actual, and Forecast share structural patterns, but extraction should happen only after final calculation UAT because each page has different business semantics. |
| Server-side import jobs | P1 | In progress | CSV backend apply endpoints exist for employees, clients, projects, allocations, and timesheets. Remaining roadmap: duplicate-resolution refinements, XLSX support if required, realistic-file UAT, and job-style async processing if files become large. |
| Production user lifecycle | P0 | Proposed | Add admin-managed user provisioning, password reset/change, password policy, session expiry, and account lockout. |
| Configurable display labels for fixed statuses | P3 | Proposed | If leadership wants different wording, allow label overrides while preserving underlying enum keys used by calculations and workflow logic. |
| Operational runbook | P0 | Proposed | Document environment variables, deployment, migrations, seed/load process, backup/restore, logging, monitoring, and support procedures. |

---

## 25. Version 2 Production Readiness Plan

This section reflects the 6 May 2026 codebase review after Render/Supabase deployment, demo seed repair, scoped backend API hardening, timesheet backend contract repair, settings API parity, import/export history persistence, utilization report APIs, backend CSV import apply endpoints, utilization eligibility UI updates, and production handover documentation updates.

### 25.1 QA Readiness Summary

| Area | Current Readiness | Evidence | Decision |
|---|---|---|---|
| TypeScript compile | Ready | `npm run lint` passes. | Safe for continued demo/UAT iteration. |
| Production frontend bundle | Ready | `npm run build` passes and produces route-split bundles in `dist`. | Safe to package for a frontend demo. |
| Backend contract scaffold | Ready as foundation | `npm run test:backend` covers schema, static serving, start script, settings route, import/export history route, and timesheet entries contract. | Backend foundation is credible for controlled UAT; remaining work is deeper API/browser coverage. |
| Local demo mode | Ready for guided demo | Rich demo data, local persistence, role flows, dashboards, allocations, timesheets, imports/exports, and reports are implemented. | Suitable for leadership walkthrough after smoke suite passes and quick browser sanity check. |
| Automated regression suite | Improved | `test:backend`, `test:access`, `test:requirements`, and optional `test:backend-api` are aligned with async services, demo data v7, utilization eligibility, report service behavior, and import contracts. | Run on every handover hardening change. |
| Backend/PostgreSQL mode | Controlled UAT ready | Render/Supabase deployment has logged in successfully; backend APIs now cover scoped reads, settings writes, timesheet IDs/entries, import/export history, utilization report reads, and CSV import apply endpoints. | Requires browser UAT by role before company production handover. |
| Production go-live | Not ready | Company-owned infrastructure, real data migration, password lifecycle, monitoring, backups, and final security sign-off are pending. | Treat as a production handover candidate, not final go-live. |

**Estimated readiness:**

| Release Target | Readiness Estimate | Meaning |
|---|---:|---|
| Leadership demo using local or Render demo mode | 85-90% | Feature coverage is strong and deployment has loaded/logged in; run a quick role-based browser pass before stakeholders. |
| Controlled internal UAT using Render/Supabase backend | 70-80% | Backend mode is usable for controlled testing, with report/import parity improved. Role-by-role browser UAT and real-file import validation are still required. |
| Company technical handover readiness | 60-70% | Handover docs, deployment path, and backend foundation exist; company-owned secrets/DB and real data load are still needed. |
| Production go-live | 45-55% | Product scope is strong, but production auth lifecycle, operations, backups, monitoring, security review, and real-data UAT remain. |

### 25.2 What Is Done

| Workstream | Done Items | Current Confidence |
|---|---|---|
| Product scope | Employee, client, project, allocation, timesheet, approval, planned/actual/forecast utilization, dashboards, import/export, audit, and admin settings are represented. | High for demo scope. |
| Demo data | 120-person dataset, 60 projects, 15 clients, 8 CDs, PM/HR/Admin users, multi-CD mappings, realistic utilization, allocations, and daily timesheets with per-entry DB-safe hours. | High for demo and UAT seed. |
| UI/UX | Boundaryless-inspired internal UI, compact CD dashboard, client/resource drilldowns, global search, route-aware scroll reset, app-native notices/modals, better sorting affordance, and route-level lazy loading. | High for demo; needs browser UAT across roles. |
| Business user documentation | A non-technical user flow guide now exists at `Resource_Utilization_Tracker_User_Flow_Guide.md`, covering role responsibilities, ideal weekly operating rhythm, screen-by-screen usage, utilization logic, governance ownership, and data quality rules. | High for business onboarding and demo support. |
| Technical status documentation | `Resource_Utilization_Tracker_Technical_Status.md` now summarizes implemented areas, pending demo/UAT/production work, current QA status, user inputs needed, and recommended next technical actions. | High for engineering review and production-readiness tracking. |
| Core local calculations | Planned utilization, actual utilization from approved timesheets, forecast snapshots, resource headcount, and project actual contribution are implemented in frontend/local mode. | Medium-high; backend parity tests pending. |
| Admin governance | Role, Country Director, department, country, industry, threshold/settings, demo reset, and guarded delete flows exist in UI/local mode. | Medium-high; API cutover pending. |
| Backend foundation | Express API, PostgreSQL schema, migration runner, seed script, scrypt login, signed sessions/tokens, scoped route checks, catalog/settings/import-export/timesheet APIs, and static production serving exist. | Medium-high for controlled UAT; full production operations still pending. |
| Frontend API migration foundation | `apiClient.ts` provides health detection, token handling, fetch wrapper, and response normalizers; `api.ts` is dual-mode async with local fallback and backend timesheet/settings/import-export support. | Medium-high; backend-mode browser UAT remains. |

### 25.3 Production Gaps and Required Implementation

| Priority | Area | Current Gap | Required Implementation | User Input Needed |
|---:|---|---|---|---|
| P0 | Company PostgreSQL environment | Personal Supabase works for demo, but company-owned DB is not connected. | Replace `DATABASE_URL`, run migrations, seed/load data, validate API health as `database: connected`. | **Yes:** company `DATABASE_URL`, SSL requirement, backup ownership. |
| P0 | Environment/secrets | Personal/demo secret values are not final. | Set company-owned `API_SESSION_SECRET`, `NODE_ENV=production`, `LOGIN_RATE_LIMIT`, cookie/security settings, secret rotation, and `AUTO_SEED_DEMO=false` before real edits. | **Yes:** secret management approach and deployment environment. |
| P0 | Smoke test repair | Repaired in current hardening batch. | Continue running `lint`, `build`, `test:backend`, `test:access`, `test:requirements`, and optional backend API smoke before each deploy. | No. |
| P1 | Async form hardening | Employee, Project, and Allocation forms now await the main async catalog loads/saves; broader API-backed saving/error states are still not standardized across every page. | Add consistent saving/error UI, prevent close before save completes, and refresh parent state after resolved writes across all remaining async workflows. | No. |
| P0 | API route parity | Settings write, scoped core reads, backend timesheet ID/entries, and import/export history are implemented. Remaining gaps are server-side import apply jobs, scoped report endpoints, and browser UAT edge cases. | Complete report/import endpoints and run role-by-role backend browser UAT. | No, unless settings approval rules differ. |
| P0 | Backend data-level RBAC | Initial row scoping exists for Employee, PM, CD, HR/Admin reads and critical allocation/timesheet writes. | Finish report/export scoping, Team Lead rules, and PM approval visibility after business confirmation. | **Yes:** final Team Lead and PM rules. |
| P0 | Authentication lifecycle | Username/password exists and employee saves synchronize login status/roles. | Add password change/reset, password policy, account lockout, session expiry/refresh, admin user management UI, and initial password workflow. | **Yes:** password policy, reset channel, initial admin users, whether email service is available. |
| P0 | Audit immutability | Frontend/local audit exists; backend audit exists for many writes but not all production operations. | Make server-side audit mandatory and immutable for every create/update/deactivate/import/export/approval/settings action. | **Yes:** audit retention period and who can export audit data. |
| P0 | Deployment | No final target environment is defined. | Prepare production start, reverse proxy/HTTPS, static serving, environment variables, process manager/container setup, logging, monitoring, backup/restore, rollback. | **Yes:** hosting target, domain/internal URL, HTTPS certificate approach, log/monitoring tool. |
| P1 | Backend calculation parity | Frontend calculates many KPIs locally; backend scoped report/calculation APIs are incomplete. | Move/duplicate calculation logic into tested backend report endpoints for dashboard, planned, actual, forecast, client/CD scopes. | No, unless reporting definitions change. |
| P1 | Import/export hardening | CSV local import/export works and backend history persistence exists; server-side apply jobs and XLSX/PDF are pending. | Backend import jobs, duplicate resolution, validation reports, export APIs, optional XLSX/PDF. | **Yes:** accepted file templates and whether XLSX/PDF are required for go-live. |
| P1 | Browser workflow automation | No Playwright suite exists. | Add browser tests for login, role routing, employee/project/client CRUD, allocation edit, timesheet submit/approve/reject, reports, import/export, global search. | No. |
| P1 | Real data migration | Demo data is ready, but real employee/client/project data is not loaded. | Define import templates, cleanse data, load into PostgreSQL, reconcile IDs, validate calculations. | **Yes:** real master data files and mapping rules. |
| P2 | Code redundancy | Shared components exist, but table/filter/report duplication remains. | Expand `DataTable`/`FilterBar`, extract report primitives, split large pages after UAT. | No. |
| P2 | Empty/loading states | Some pages have good states; API-backed loading/error handling is not consistent. | Standardize skeleton/loading/error/empty states across all async pages. | No. |

### 25.4 Recommended Production Implementation Order

| Sequence | Phase | Goal | Exit Criteria |
|---:|---|---|---|
| 1 | Protect real data | Keep `AUTO_SEED_DEMO=false` after initial seed and before editing demo records into real records. | Real-data edits survive deploy restarts. |
| 2 | Prove backend mode in browser | Run app with backend connected and execute Admin, HR, CD, PM, Team Lead, Employee journeys. | Core browser workflows pass without falling back to localStorage. |
| 3 | Company infrastructure handover | Replace personal Supabase/Render values with company-owned DB, hosting, and secrets. | Company owns infrastructure and `/api/health` is connected. |
| 4 | Real data load | Load catalogs, CDs, employees/users, clients, projects, allocations, and optional historical timesheets. | Dashboards/cards/lists update from real records with stable IDs. |
| 5 | Complete API/report/import parity | Add remaining server-side import/report endpoints and finish backend browser UAT. | Production mode does not rely on localStorage-only features. |
| 6 | Production auth and operations | Add password lifecycle, account management, secure cookies/session expiry, logging, monitoring, backup/restore, deployment runbook. | Security checklist and operations runbook approved. |
| 7 | UAT and go-live hardening | Run multi-user UAT, fix edge cases, freeze release. | Signed UAT by Admin, HR, CD, PM, Team Lead, and Employee representatives. |

### 25.5 User Input Needed

| Needed From User / Company | Required For | Priority | Notes |
|---|---|---:|---|
| Company PostgreSQL connection details | Company-owned production data persistence | P0 | Provide `DATABASE_URL` or host, port, database, username, password, SSL mode. |
| Company deployment target | Production packaging and runbook | P0 | Internal server, VM, Docker host, Render/Railway, IIS reverse proxy, or other platform. |
| Internal URL/domain and HTTPS approach | Secure cookies and production access | P0 | Needed before production session/cookie settings can be finalized. |
| Initial production admin users | User provisioning | P0 | Names, usernames, emails, roles. |
| Password policy | Username/password production auth | P0 | Minimum length, expiry, reset process, account lockout, MFA requirement if any. |
| Team Lead business rules | Data-level RBAC | P0 | Confirm who Team Leads can view, whether they can approve, and which projects/resources they can access. |
| Project Manager approval rules | Timesheet governance | P0 | Confirm whether PMs can approve timesheets for their projects or only view/recommend. |
| Real employee/client/project/allocation data | Real-data UAT | P1 | CSV/XLSX source files and field mapping decisions. |
| Import/export requirements | Reporting and operations | P1 | Confirm whether CSV only is enough for Phase 1 or XLSX/PDF are mandatory. |
| Audit retention/export policy | Governance | P1 | Define retention period, export permissions, and audit review owners. |
| Backup/restore policy | Operations | P0 | Backup frequency, retention, restore owner, and recovery time expectation. |

### 25.6 Demo Recommendation

For the next demo, use the deployed Render/Supabase demo or local demo mode. Before showing it to stakeholders:

1. Confirm `AUTO_SEED_DEMO=false` if any demo records have been manually edited.
2. Run smoke tests and a browser pass for Admin, HR, CD, PM, Team Lead, and Employee.
3. Keep the current Boundaryless color/font styling unchanged.
4. Share `Resource_Utilization_Tracker_User_Flow_Guide.md` with business stakeholders before or during demo walkthroughs.
5. Clearly describe the system as "ready for controlled UAT and company handover hardening" rather than "final production go-live."
