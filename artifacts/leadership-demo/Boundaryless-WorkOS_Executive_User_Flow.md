# Boundaryless-WorkOS

## Executive User Flow and Leadership Demo Script

### Purpose

The Boundaryless-WorkOS is an internal operating workspace for delivery capacity, project staffing, weekly effort evidence, and governance traceability.

The leadership story is simple:

**Signal -> drilldown -> action -> governance**

The product should be demonstrated as a connected operating model, not as separate screens.

### What Leadership Should Understand

The tracker answers five business questions:

1. Where is delivery capacity committed right now?
2. Which people, projects, clients, or regions need attention?
3. Are planned allocations aligned with actual approved effort?
4. Who owns each employee, client, project, and approval action?
5. Can the company replace demo data with real data without breaking reporting?

### Recommended Live Demo Order

Use this order for a leadership walkthrough:

1. Login screen
2. Overview Dashboard
3. Client Portfolio / Country Director scope
4. Employee Detail
5. Project Detail
6. Allocation Control
7. My Timesheet
8. Timesheet Governance
9. Actual Utilization / planned-vs-actual variance
10. Governance Settings and Audit Trail

This sequence shows the full operating loop: access, signal, scope, ownership, planning, submission, approval, reporting, and traceability.

### Slide-by-Slide Leadership Script

| Slide | What to Say | What the Screenshot Proves |
|---|---|---|
| 1. Boundaryless-WorkOS | "This is a production-oriented command center for capacity, client delivery, weekly evidence, and governance." | The product has a real internal workspace and dashboard, not a marketing-style landing page. |
| 2. Why this matters | "Utilization is credible only when the path from plan to approved effort is visible." | Login is role based and the product is designed for internal governed access. |
| 3. Command center | "Leadership starts with portfolio health, not raw tables." | Dashboard KPIs, Country Director portfolio, and attention queues are visible above the fold. |
| 4. Client scope | "Country Directors need a client-and-project lens, not only an FTE number." | Client concentration, project count, mapped resources, allocated FTE, and billable footprint are visible together. |
| 5. Traceability | "Every link should land on the exact operational object." | Employee and project details tie people, PMs, projects, allocations, and actual delivery together. |
| 6. Planned utilization | "Allocation Control is the source of planned capacity." | Planned utilization is created through person, project, role, date range, and percentage, not manually typed into reports. |
| 7. Actual utilization | "Actual utilization comes from approved timesheets." | Employees submit weekly work and approvers validate effort before it influences actual utilization. |
| 8. Decision model | "Planned, actual, and forecast answer different leadership questions." | Variance reporting reconciles allocation expectation against approved effort. |
| 9. Governance and traceability | "Production confidence comes from controlled settings, catalogs, audit history, and exportable evidence." | Settings and audit surfaces make the product governable. |
| 10. Leadership ask | "Approve structured UAT with real users and real operating cadence." | The product flow is complete enough for role-based UAT and demo-data replacement planning. |

### How Each Role Should Use the Tracker

| Role | Ideal Use |
|---|---|
| Admin | Configure settings, manage catalogs, oversee audit trail, handle imports/exports, and govern users. |
| HR | Maintain employee master data, roles, departments, countries, and people lifecycle status. |
| Country Director | Review scoped employees, clients, projects, portfolio pressure, and approval queues. |
| Project Manager | Maintain managed projects and project-level planned allocations. |
| Team Lead | Support timesheet review and team-level operational follow-up where configured. |
| Employee | View own assignments and submit weekly timesheets against assigned work. |

### Correct Operating Rhythm

| Timing | Business Action |
|---|---|
| Start of week | Review planned allocation, underutilization, overload, roll-offs, and missing ownership data. |
| During week | Update project staffing and allocation percentages when delivery plans change. |
| Week close | Employees submit timesheets against assigned projects. |
| Approval window | PMs, Country Directors, or configured approvers approve or reject submitted effort. |
| Leadership review | Compare planned vs actual, review forecast pressure, and decide redeployment or hiring action. |

### Utilization Logic for Business Users

| Utilization View | Meaning |
|---|---|
| Planned utilization | Capacity committed through active allocations and date ranges. |
| Actual utilization | Approved timesheet hours compared against expected weekly capacity. |
| Forecast utilization | Future allocation load and roll-off risk based on upcoming date ranges. |

Important utilization policy:

- Admin, HR, and Country Director governance users remain in the app but are excluded from delivery-utilization denominators.
- Project Managers count in utilization only when they have active project allocation.
- Delivery employees, consultants, developers, BAs, SAs, support roles, interns, and allocation-carrying PMs are the utilization population.

### Demo Data Replacement Guidance

The current demo records can be renamed and replaced with real company data while preserving stable IDs and links.

Recommended replacement order:

1. Catalogs: roles, departments, countries, industries
2. Country Directors and governance users
3. Employees and user accounts
4. Clients
5. Projects and PM ownership
6. Allocations
7. Optional historical timesheets

Before editing demo records into real records in a hosted database, disable demo reseeding:

```text
AUTO_SEED_DEMO=false
```

### What Good Adoption Looks Like

The tracker is being used correctly when:

- Master data is maintained before allocations are changed.
- Allocations are updated before delivery work starts.
- Employees submit timesheets every week.
- Approvers clear pending timesheets quickly.
- Leadership reviews planned, actual, and forecast together.
- Audit and export are used for evidence instead of manual reconstruction.

### Deliverables in This Demo Pack

- `output/Boundaryless-WorkOS_Leadership_Demo_Screenshot_Driven.pptx`
- `previews/slide-01.png` through `previews/slide-10.png`
- `previews/montage.png`
- `screenshots/01-login-internal-access.png` through `screenshots/12-audit-trail.png`
- `screenshots/contact-sheet.png`

