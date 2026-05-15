# Role UAT Checklist

Run this checklist in backend mode before production go-live. Record tester name, date, environment URL, and pass/fail evidence for each role.

## Admin

- Login with Admin account.
- Open Dashboard and confirm KPIs load.
- Open Employee Master and Employee Detail.
- Create/edit/deactivate employee in UAT only.
- Reset a user password and confirm forced password change.
- Open Project Master and Project Detail.
- Open Allocation Control.
- Open Planned, Actual, and Forecast Utilization.
- Open My Timesheet and Timesheet Governance.
- Open Import / Export and download templates.
- Open Audit Trail and export logs.
- Open Data Quality and record score/issues before and after UAT data cleanup.
- If `FEATURE_LEAVE=true`, open ESS, My Leave, Team Leave Calendar, and Leave Administration.
- If `FEATURE_LEAVE=true`, submit a test leave request, approve it, and confirm balance, availability, and audit entries update.
- Export one employee, utilization, timesheet governance, and audit report; confirm each creates an audit event.
- Open Governance Settings and verify catalogs/settings.

## HR

- Login with HR account.
- Confirm Employee Master and employee edit actions are visible.
- Confirm Audit Trail and Import / Export are not visible unless explicitly approved later.
- Open Employee Detail and reset password.
- Open utilization reports.
- Open Data Quality and confirm visible issues are scoped to allowed data.
- If `FEATURE_LEAVE=true`, verify Leave Administration, leave balances, policy visibility, and team leave calendar scope.
- Confirm scoped navigation does not expose Admin-only controls.

## Country Director

- Login with Country Director account.
- Confirm Dashboard shows regional/scoped data.
- Open Employee Master and verify only scoped employees appear.
- Open Project Master and verify projects with scoped employees appear.
- Open Client Portfolio if allowed.
- Open Allocation Control and verify scoped allocation behavior.
- Open Timesheet Governance and approve/reject a submitted timesheet in UAT only.
- Open Data Quality and confirm visible issues are scoped to the Country Director region.
- If `FEATURE_LEAVE=true`, approve/reject a scoped leave request and confirm out-of-scope employee requests are unavailable.
- Confirm Admin Settings, Audit Trail, and Import / Export are not visible.

## Project Manager

- Login with Project Manager account.
- Confirm only managed projects and assigned resources are visible.
- Open Project Detail for a managed project.
- Confirm unmanaged project detail is blocked or unavailable.
- Open Allocation Control and manage only allowed project allocations in UAT.
- Open Timesheet Governance and verify approval scope.
- If `FEATURE_LEAVE=true`, confirm project/team leave visibility matches approved scope and does not expose unrelated employee balances.
- If the account has multiple roles, switch active role from the profile menu and confirm navigation/data scope changes.
- Confirm Admin-only controls are hidden.

## Team Lead

- Login with Team Lead account when company/UAT role mapping is available.
- Confirm assigned team visibility matches approved business rules.
- Open Employee Master for permitted team members.
- Open utilization reports.
- Open Timesheet Governance if Team Lead approval is approved.
- If `FEATURE_LEAVE=true`, approve/reject only direct-report leave requests and confirm unrelated employees are blocked.
- Confirm visibility does not exceed the signed Team Lead scope.

Note: the current deployed demo seed may not include a Team Lead credential. Use company UAT data or a seeded Team Lead account for final sign-off.

## Employee

- Login with Employee account.
- Confirm only own timesheet and own employee detail are available.
- If `FEATURE_LEAVE=true`, open ESS/My Leave, submit a leave request, and confirm only own balances and own requests are visible.
- Submit a current or past week timesheet in UAT only.
- Confirm future week/future-dated entries are blocked.
- Confirm Employee cannot open Admin Settings, Audit Trail, Import / Export, or unmanaged project data.

## Evidence

Capture:

- Environment URL.
- User/role tested.
- Date/time.
- Pass/fail result.
- Screenshots for failures.
- Defect ID or notes for follow-up.
