# Resource Utilization Tracker - Business User Flow Guide

**Audience:** HR, Admin, Country Directors, Project Managers, Team Leads, Employees, and Business Leadership  
**Purpose:** Explain how the Resource Utilization Tracker should be used in day-to-day operations without requiring technical knowledge.  
**Recommended Use:** Internal operating guide for demo, onboarding, weekly governance, and business adoption.

---

## 1. What This Tracker Is For

The Resource Utilization Tracker is an internal business application used to manage:

- Employees and their reporting/director mappings
- Clients and active delivery portfolios
- Projects/processes under each client
- Planned allocation percentages by employee and project
- Weekly timesheet submissions
- Actual utilization based on approved timesheets
- Utilization forecasts for upcoming months
- Country Director-level workload and portfolio visibility
- Audit history and import/export governance

The tracker should be treated as the operational source of truth for resource planning, delivery capacity, and utilization reporting.

---

## 2. Recommended Business Operating Flow

The application works best when used in this order:

| Step | Owner | Screen | Purpose |
|---|---|---|---|
| 1 | Admin / HR | Governance Settings | Maintain roles, departments, countries, Country Directors, industries, and operating thresholds |
| 2 | Admin / HR | Employee Master | Create or maintain employee records and director mappings |
| 3 | Admin / HR / Country Director | Client Portfolio | Maintain clients and client ownership |
| 4 | Admin / PM / HR | Project Master | Create and maintain projects/processes under clients |
| 5 | Admin / PM / Country Director / HR | Allocation Control / Project Detail / Employee Detail | Assign employees to projects with planned allocation percentages |
| 6 | Employee | My Timesheet | Log weekly client/project work |
| 7 | Country Director / PM / Team Lead | Timesheet Governance | Approve or reject submitted timesheets |
| 8 | HR / Leadership / Country Director | Dashboards and Utilization Pages | Review planned, actual, variance, and forecast utilization |
| 9 | Admin | Import / Export and Audit Trail | Export reports, review history, and maintain governance evidence |

This sequence keeps data clean. Master data should be correct before allocations are created, and timesheets should be submitted only after allocations are available.

---

## 3. User Roles and What Each Role Should Do

| Role | Main Responsibility | Typical Screens |
|---|---|---|
| Employee | Submit weekly timesheets and view own allocation details | My Timesheet, own Employee Detail |
| Team Lead | Review team-level delivery and timesheet status where permitted | Timesheet Approvals, Utilization |
| Project Manager | Manage project resources and planned project allocations | Project Master, Project Detail, Allocation Control |
| Country Director | Monitor mapped employees, clients, projects, utilization, and approve timesheets | Dashboard, Employee Master, Project Master, Timesheet Governance, Utilization |
| HR | Maintain employee records, review utilization and staffing health | Employee Master, Allocation Control, Utilization, Governance Settings |
| Admin | Full platform governance, setup, audit, import/export, and troubleshooting | All screens |

Some users may have multiple business responsibilities. The selected login role controls what they can access during that session.

---

## 4. Login and Access

### Ideal Use

Users should sign in with their assigned username and password. After login, they should only see the screens relevant to their role.

### Business Notes

- Admin and HR users can maintain master data.
- Employees should not edit allocations or approve timesheets.
- Country Directors should see employees mapped to them, including employees who are shared across multiple directors.
- Project Managers should see projects they manage and resources assigned to those projects.

---

## 5. Overview Dashboard

### Purpose

The Overview Dashboard gives leadership and operations users a quick view of current workforce health.

### What To Review

- Total active employees
- Average planned utilization
- Overloaded employees
- Underutilized employees
- Pending timesheet logs
- Risk projects or staffing gaps
- Country Director portfolio cards

### How To Use It

Start each weekly review from the dashboard:

1. Check whether total utilization is within the expected range.
2. Review overloaded and underutilized counts.
3. Open Country Director cards to understand regional/client/project load.
4. Click FTE, client scope, project, or employee links to drill into the correct detailed page.
5. Use the dashboard as a decision screen, not as the place to edit all data.

### Best Practice

Use the dashboard to identify action areas, then move to the correct master or transaction screen to make changes.

---

## 6. Employee Master

### Purpose

Employee Master is where HR/Admin users maintain employee records.

### Key Data

- Employee ID
- Name and email
- Designation
- Department
- Country
- Primary Country Director
- Additional mapped Country Directors
- Status: Active, On Leave, or Exited
- Planned utilization
- Actual utilization
- Active project count

### Ideal User Flow

1. Open Employee Master.
2. Search or filter the employee.
3. Open the employee detail page to review assignments and utilization.
4. Use Edit to update employee details.
5. Change status to Exited when an employee leaves instead of deleting historical records.

### Business Rules

- If an employee changes role, department, or director mapping, update it here first.
- If an employee is mapped to multiple Country Directors, each relevant director should be able to see them in their scoped view.
- Deactivating/exiting an employee should preserve historical allocations, timesheets, and audit history.

---

## 7. Employee Detail

### Purpose

Employee Detail shows one employee's allocation, utilization, and project participation.

### What To Use It For

- Check where the employee is currently allocated.
- Review planned vs actual utilization.
- Understand if the employee is overloaded, underutilized, or balanced.
- Navigate to related projects.
- Start or review allocation planning for that employee if your role permits.

### Best Practice

Use Employee Detail when the business question starts with: "What is this person working on?"

---

## 8. Client Portfolio

### Purpose

Client Portfolio is the client-level operating view.

### What To Review

- Active clients
- Client industry
- Client ownership
- Country Director scope
- Projects/processes under the client
- Resources assigned to client work

### Ideal User Flow

1. Open Client Portfolio.
2. Select or search the client.
3. Review associated projects and assigned resources.
4. Use the project links to inspect specific delivery work.
5. Keep client names and industries clean because they are used in leadership reporting.

### Best Practice

Use this page when the business question starts with: "Which clients are consuming the most resources?"

---

## 9. Project Master

### Purpose

Project Master is where projects/processes are created and maintained.

### Key Data

- Project/process code
- Project/process name
- Client
- Project Manager
- Start and end dates
- Status: Proposed, Active, On Hold, Completed
- Billable flag
- Assigned resources

### Ideal User Flow

1. Open Project Master.
2. Search or filter the project.
3. Open Project Detail to review assigned resources.
4. Use Update Project to change project details.
5. Use Add Resource or Plan Allocation to assign people to the project.

### Business Rules

- Project utilization should be understood through the assigned resources and their allocation percentages.
- Project status should be updated when work is completed or paused.
- Project Manager assignment should be maintained carefully because it controls ownership and reporting.

### Best Practice

Use Project Master when the business question starts with: "Who is working on this project/process?"

---

## 10. Project Detail

### Purpose

Project Detail gives a focused view of one project/process.

### What To Review

- Project blueprint
- Client and project manager
- Timeline and current status
- Assigned consultants
- Each consultant's role on the project
- Allocation percentage
- Actual contribution from approved timesheets
- Country Director mapping

### Ideal User Flow

1. Open the project from Project Master, dashboard, client portfolio, or global search.
2. Review assigned consultants.
3. Check whether allocation percentages match the expected delivery plan.
4. Use Plan/Add Resource if a resource allocation needs to change.
5. If project details need correction, use Update Project and stay within the project context.

### Best Practice

Do not treat Project Detail as a generic utilization dashboard. It should answer project ownership, staffing, and contribution questions.

---

## 11. Allocation Control

### Purpose

Allocation Control is the central planning area for planned utilization.

### What Allocation Means

An allocation is a planned percentage of an employee's work capacity assigned to a project for a date range.

Example:

- Emp-15 assigned 50% to Client A Project from 1 May to 30 June
- Emp-15 assigned 30% to Client B Project from 1 May to 31 May
- Planned utilization for that period becomes 80%

### Who Should Use It

- Admin
- HR
- Country Director
- Project Manager, where permitted

### Ideal User Flow

1. Choose employee and project.
2. Enter planned allocation percentage.
3. Select start and end dates.
4. Confirm role/designation on the project.
5. Save allocation.
6. Review employee/project utilization after saving.

### Business Rules

- Planned utilization comes from allocation records.
- Actual utilization does not come from allocations; it comes from approved timesheets.
- Avoid over-allocation above 100% unless the business has explicitly agreed to it.
- Allocations should have correct date ranges so forecast reporting is meaningful.

### Best Practice

Use allocations to represent planned work, not actual hours already worked.

---

## 12. My Timesheet

### Purpose

My Timesheet is where employees record weekly client/project work.

### What Employees Should Do

1. Open My Timesheet.
2. Select the correct week.
3. Add hours against assigned project work.
4. Add client miscellaneous work if applicable.
5. Save as draft if not ready.
6. Submit for approval when complete.

### Business Rules

- Future-dated timesheets should not be submitted.
- Timesheets should be submitted weekly.
- Rejected timesheets should be corrected and resubmitted.
- Approved timesheets feed actual utilization reporting.

### Best Practice

Employees should submit only client/project-related work that should count toward utilization.

---

## 13. Timesheet Governance / Timesheet Approvals

### Purpose

This screen is used by approvers to review submitted timesheets.

### Who Uses It

- Country Directors
- Project Managers, where permitted
- Team Leads, where permitted
- Admins for governance or testing

### Ideal User Flow

1. Review submitted timesheets.
2. Check employee, week, project/client effort, and total hours.
3. Approve if the entry is correct.
4. Reject with a clear reason if correction is needed.
5. Use approved data for actual utilization reporting.

### Business Rules

- Rejection should always include a useful reason.
- Approval should reflect business confirmation of client/project effort.
- Only approved timesheets should drive official actual utilization.

---

## 14. Planned Utilization

### Purpose

Planned Utilization shows expected capacity usage based on allocation records.

### What To Review

- Employees above capacity
- Employees below expected capacity
- Department/country/director-level planned load
- Allocation coverage
- Planned utilization variance

### How To Use It

Use this page before the week/month starts to answer:

- Are we overloading anyone?
- Do we have bench capacity?
- Which teams need rebalancing?
- Are future allocations correctly planned?

### Best Practice

This should be the primary planning report for HR, PMs, and Country Directors.

---

## 15. Actual Utilization

### Purpose

Actual Utilization shows utilization based on approved timesheets.

### What To Review

- Approved effort
- Pending review
- Missing logs
- Actual vs planned variance
- Employees with major utilization gaps

### How To Use It

Use this page after timesheet approvals to answer:

- Did people work according to plan?
- Where are the biggest gaps between planned and actual effort?
- Which timesheets are still pending?
- Which teams are missing logs?

### Best Practice

Actual utilization should be reviewed after approval cut-off, not before all submissions are processed.

---

## 16. Forecast Utilization

### Purpose

Forecast Utilization helps leadership understand expected utilization for upcoming months.

### What It Should Reflect

- Future allocation start and end dates
- Project completion dates
- Employee availability
- Potential roll-offs
- Future underutilization or overload risk

### How To Use It

Use this page for monthly planning:

- Identify employees rolling off soon.
- Detect future bench risk.
- See upcoming overload periods.
- Support hiring, redeployment, and sales pipeline decisions.

### Best Practice

Forecast quality depends on clean allocation date ranges.

---

## 17. Import / Export

### Purpose

Import / Export is used for controlled data movement and reporting.

### Typical Use Cases

- Export employee master data.
- Export project master data.
- Export allocation data.
- Export utilization reports.
- Import controlled master data where supported.

### Business Rules

- Use export for reporting and audit discussions.
- Review imported files carefully before using them for production data.
- Timesheet imports should remain controlled because timesheets affect official utilization.

### Best Practice

Manual maintenance is preferred for small changes. Use import/export for bulk updates or governance reporting.

---

## 18. Audit Trail

### Purpose

Audit Trail shows who changed what and when.

### What To Review

- Login/logout events
- Employee changes
- Project changes
- Allocation changes
- Timesheet approvals/rejections
- Settings changes
- Import/export activity

### Best Practice

Admins should use Audit Trail when investigating data changes or preparing governance evidence.

---

## 19. Governance Settings

### Purpose

Governance Settings controls the business configuration of the tracker.

### What Admin/HR Can Maintain

- Utilization thresholds
- Expected weekly hours
- Role catalog
- Department catalog
- Country catalog
- Industry catalog
- Country Directors
- Demo/testing controls where enabled

### Business Rules

- Do not frequently change thresholds without leadership agreement.
- Keep catalogs clean because dropdowns and reports depend on them.
- Country Director changes should be made carefully because they affect dashboard visibility and access scoping.

### Best Practice

Governance Settings should be owned by a small Admin/HR group.

---

## 20. Global Search

### Purpose

Global Search helps users quickly find employees, projects, clients, and insights.

### Ideal Use

1. Search by employee name, employee ID, project name, project code, or client.
2. Select the correct result.
3. The app should route to the relevant page and focus on the selected record.

### Best Practice

Use search for direct navigation. Use filters when comparing many records.

---

## 21. How Utilization Is Calculated

### Planned Utilization

Planned utilization is calculated from active allocation percentages during the relevant period.

Example:

| Allocation | Percentage |
|---|---:|
| Project A | 40% |
| Project B | 30% |
| Project C | 20% |
| Total Planned Utilization | 90% |

### Actual Utilization

Actual utilization is calculated from approved timesheet hours.

Example:

| Value | Example |
|---|---:|
| Approved client/project hours | 32 hours |
| Expected weekly hours | 40 hours |
| Actual utilization | 80% |

### Forecast Utilization

Forecast utilization is calculated from future allocation date ranges and expected project timelines.

### Important Difference

| Type | Comes From | Used For |
|---|---|---|
| Planned | Allocation records | Planning and capacity commitments |
| Actual | Approved timesheets | Delivery performance and reporting |
| Forecast | Future allocations | Upcoming capacity and staffing risk |

---

## 22. Weekly Business Rhythm

### Monday

- PMs and Country Directors review planned allocations.
- HR checks underutilized and overloaded employees.
- Admin updates any master data changes.

### During the Week

- Employees save timesheet drafts.
- PMs and Country Directors adjust allocations if delivery plans change.

### Friday / Week Close

- Employees submit timesheets.
- Approvers review submitted timesheets.
- Rejections are sent back with reasons.

### Following Monday

- Leadership reviews actual utilization and variance.
- HR/Operations reviews staffing actions.
- Forecast utilization is checked for upcoming gaps.

---

## 23. Common Business Scenarios

### Add a New Employee

1. Go to Employee Master.
2. Add employee details.
3. Assign country, department, role, and Country Director mapping.
4. Confirm user access is created.
5. Allocate the employee to projects if required.

### Move an Employee to Another Director

1. Open Employee Master.
2. Edit the employee.
3. Update primary or additional Country Director mappings.
4. Save.
5. Confirm the employee appears in the correct director dashboard scope.

### Add a New Project

1. Go to Project Master.
2. Create the project/process.
3. Select client and Project Manager.
4. Set dates, billable status, and project status.
5. Add resource allocations.

### Assign an Employee to a Project

1. Open Project Detail or Allocation Control.
2. Add the employee as a resource.
3. Set role on project.
4. Set allocation percentage and date range.
5. Save and verify planned utilization.

### Approve Timesheets

1. Open Timesheet Governance.
2. Filter submitted timesheets.
3. Review entries and totals.
4. Approve correct entries.
5. Reject incorrect entries with reason.

### Investigate a Utilization Gap

1. Open Actual Utilization.
2. Review variance watchlist.
3. Open employee detail.
4. Compare allocation plan and approved timesheets.
5. Correct allocation or timesheet data based on the business reality.

---

## 24. Data Quality Rules

For reliable reporting:

- Keep employee names, IDs, departments, and countries accurate.
- Maintain clients as client records, not just text inside project names.
- Keep project dates current.
- Close completed projects.
- Keep allocation date ranges accurate.
- Avoid duplicate employee or client records.
- Use Exited/Completed/Inactive statuses instead of deleting business history.
- Approve timesheets only after review.
- Use Audit Trail for investigation instead of guessing.

---

## 25. Demo Guidance

For demo purposes, the mock data can be used to show:

- Employee and project search
- Country Director portfolio views
- Client/resource distribution
- Planned vs actual utilization
- Timesheet submission and approval
- Allocation updates
- Import/export
- Audit trail
- Governance catalog maintenance

When replacing mock data with real business data:

1. Update catalogs first.
2. Update Country Directors.
3. Update employees.
4. Update clients.
5. Update projects.
6. Update allocations.
7. Start timesheet submissions.

This keeps downstream reports consistent.

---

## 26. What Users Should Not Do

- Do not create allocations before employee and project data is correct.
- Do not use project pages to change employee master details.
- Do not use employee pages to change client/project master details.
- Do not submit future timesheets.
- Do not approve timesheets without checking entries.
- Do not delete/deactivate master records without understanding dependent reports.
- Do not treat planned utilization and actual utilization as the same number.

---

## 27. Quick Reference: Which Screen Should I Use?

| Question | Go To |
|---|---|
| What is the overall company utilization? | Overview Dashboard |
| Which employees are underutilized or overloaded? | Planned Utilization / Employee Master |
| What did people actually work on? | Actual Utilization |
| Who works for this Country Director? | Dashboard Country Director card / Employee Master |
| Which clients consume the most people? | Client Portfolio |
| Who is assigned to this project? | Project Detail |
| How do I change someone's planned allocation? | Allocation Control, Project Detail, or Employee Detail |
| How does an employee submit hours? | My Timesheet |
| How do I approve submitted hours? | Timesheet Governance |
| Where do I add a new role or department? | Governance Settings |
| Where do I export data? | Import / Export |
| Who changed this record? | Audit Trail |

---

## 28. Success Criteria for Business Adoption

The tracker is being used correctly when:

- Employees submit timesheets every week.
- Approvers approve or reject timesheets on time.
- PMs maintain allocation percentages before work starts.
- HR uses underutilization and overload reports for action.
- Country Directors use portfolio cards to review their delivery scope.
- Leadership uses planned, actual, and forecast reports for decisions.
- Admins use governance settings and audit trail to maintain clean operations.

---

## 29. Glossary

| Term | Meaning |
|---|---|
| Allocation | Planned percentage of an employee's capacity assigned to a project |
| Planned Utilization | Expected usage based on allocation records |
| Actual Utilization | Usage calculated from approved timesheet hours |
| Forecast Utilization | Expected future usage based on upcoming allocations |
| Country Director Mapping | Relationship between an employee and one or more Country Directors |
| Client Misc Task | Client-related work not tied to a specific project allocation |
| Approval | Confirmation that submitted timesheet work is valid |
| Rejection | Request for correction with a reason |
| Soft Delete | Marking a record inactive/exited/completed instead of permanently removing history |

---

## 30. Recommended Governance Ownership

| Area | Primary Owner | Backup Owner |
|---|---|---|
| Employee master data | HR | Admin |
| Client master data | Admin / Operations | HR |
| Project master data | Project Manager | Admin / Country Director |
| Allocations | Project Manager / Country Director | HR |
| Timesheet submission | Employee | Team Lead |
| Timesheet approval | Country Director | Project Manager / Team Lead |
| Utilization reporting | HR / Leadership | Admin |
| Settings and catalogs | Admin | HR |
| Audit and exports | Admin | Leadership-approved users |

---

## 31. Final Business Guidance

The tracker should be used as a planning and governance system, not only as a reporting dashboard.

The most reliable operating model is:

1. Keep master data accurate.
2. Plan allocations before work starts.
3. Submit timesheets weekly.
4. Approve timesheets promptly.
5. Review planned vs actual gaps.
6. Use forecast views for proactive staffing decisions.

When this rhythm is followed, the tracker gives HR, Country Directors, PMs, and leadership a shared view of capacity, delivery load, and utilization health.
