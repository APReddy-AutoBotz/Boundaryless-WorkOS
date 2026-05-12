# Real Data Import Guide

This guide prepares the application for real company data while the final database and files are still pending.

## 1. Import Load Order

1. Confirm catalogs: departments, countries, industries, job roles.
2. Confirm Country Directors and regions.
3. Import employees and user mappings.
4. Import clients.
5. Import projects.
6. Import allocations.
7. Import optional historical timesheets.
8. Reconcile reports, scoped views, and audit logs.

Do not import allocations before employees and projects exist. Do not import projects before clients and project managers exist.

## 2. Templates

CSV templates are checked into:

```text
templates/import/employees-template.csv
templates/import/clients-template.csv
templates/import/projects-template.csv
templates/import/allocations-template.csv
templates/import/timesheets-template.csv
```

The same field names are used by the in-app Import / Export page.

## 3. Employee Master Columns

| Column | Required | Notes |
|---|---:|---|
| `employeeId` | Yes | Unique company employee ID. |
| `name` | Yes | Display name. |
| `email` | Yes | Unique work email. |
| `designation` | Recommended | Used for role/context and utilization interpretation. |
| `department` | Recommended | Should match company department catalog. |
| `country` | Recommended | Should match company country catalog. |
| `primaryCountryDirectorId` | Yes | Must reference an existing Country Director ID. |
| `mappedCountryDirectorIds` | Optional | Pipe-separated IDs, for example `cd-1|cd-3`. |
| `utilizationEligible` | Recommended | `true` for delivery capacity, `false` for governance users. |
| `roles` | Optional | Pipe-separated app roles if provisioning users through import. |
| `initialPassword` | Optional | Temporary password for newly provisioned users. Prefer reset workflow. |
| `status` | Optional | `Active`, `On Leave`, or `Exited`. |

## 4. Client Master Columns

| Column | Required | Notes |
|---|---:|---|
| `id` | Optional | Stable client ID if available. |
| `name` | Yes | Unique client name. |
| `industry` | Recommended | Should match company industry catalog. |
| `accountOwnerId` | Optional | Employee ID or internal owner ID. |
| `countryDirectorIds` | Optional | Pipe-separated director IDs. |
| `status` | Optional | `Active` or `Inactive`. |

## 5. Project Master Columns

| Column | Required | Notes |
|---|---:|---|
| `projectCode` | Yes | Unique process/project code. |
| `name` | Yes | Project/process name. |
| `clientId` | Optional | Preferred if stable client IDs are available. |
| `client` | Yes | Must resolve to an active client. |
| `managerId` | Yes | Employee ID or employee record ID for the Project Manager. |
| `startDate` | Yes | `YYYY-MM-DD`. |
| `endDate` | Yes | `YYYY-MM-DD`, on or after start date. |
| `status` | Optional | `Proposed`, `Active`, `On Hold`, or `Completed`. |
| `billable` | Optional | `true` or `false`. |
| `projectType` | Optional | Company-defined type. |
| `country` | Optional | Delivery or client country. |
| `notes` | Optional | Free text. |

## 6. Allocation Columns

| Column | Required | Notes |
|---|---:|---|
| `id` | Optional | Stable allocation ID for updates. |
| `employeeId` | Yes | Employee ID or employee record ID. |
| `projectId` | Yes | Project code or project record ID. |
| `roleOnProject` | Optional | Defaults to employee designation when absent. |
| `percentage` | Yes | 0-200. Production policy may block overlapping load above 100. |
| `startDate` | Yes | `YYYY-MM-DD`; must fit project timeline. |
| `endDate` | Yes | `YYYY-MM-DD`; must fit project timeline. |
| `billable` | Optional | `true` or `false`. |
| `status` | Optional | `Active`, `Paused`, or `Completed`. |
| `comments` | Optional | Free text. |

## 7. Timesheet Columns

| Column | Required | Notes |
|---|---:|---|
| `employeeId` | Yes | Employee ID or employee record ID. |
| `weekEnding` | Yes | `YYYY-MM-DD`; future weeks are blocked. |
| `workType` | Yes | `Project Work` or `Client Misc Task`. |
| `projectId` | Required for project work | Project code or project record ID. |
| `clientName` | Required for misc client task | Client name for non-project work. |
| `category` | Optional | Work category. |
| `date` | Yes | Work date, not future-dated. |
| `hours` | Yes | 0-24. |
| `remark` | Optional | Free text. |
| `billable` | Optional | `true` or `false`. |
| `status` | Optional | `Draft`, `Submitted`, `Approved`, or `Rejected`. |
| `rejectionReason` | Required when rejected | Reason visible in governance. |

## 8. Reconciliation Checklist

- Employee count matches source HR file.
- Active/exited/on-leave totals match source.
- Governance users have `utilizationEligible=false`.
- Delivery users have `utilizationEligible=true`.
- Project Managers count toward utilization only when actively allocated.
- Every project has a valid active or non-exited manager.
- Every allocation references a valid employee and project.
- No allocation dates sit outside project dates.
- Planned utilization report rows match expected delivery population.
- Role-scoped views are tested for Admin, HR, CD, PM, Team Lead, and Employee.
- Import/export history contains a record for each load.

## 9. Pre-Import Quality Rules

- Use stable IDs. Avoid names as durable identifiers where possible.
- Resolve duplicate employee IDs and duplicate emails before import.
- Resolve duplicate client names before project import.
- Confirm Country Director IDs before employee/client import.
- Decide whether `AUTO_SEED_DEMO` is disabled before any real-data import.
- Keep original source files outside the repository if they contain personal or confidential data.
