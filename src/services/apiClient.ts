/**
 * apiClient.ts
 * Low-level HTTP client + backend availability detection + response normalizers.
 * All production API calls go through here.
 */

import type {
  Employee, Project, Allocation, Client, CountryDirector,
  TimesheetSummary, TimesheetEntry, AuditLog, SystemSettings,
  RoleDefinition, CatalogItem, UserSession, UserRole, ImportExportLog,
  UtilizationReport, DataQualityReport, DashboardReport,
  LeaveType, LeavePolicy, HolidayCalendar, Holiday, LeaveBalance, LeaveRequest,
} from '../types';
import { roundMetric } from '../lib/format';

const frontendEnv = ((import.meta as unknown as { env?: Record<string, string | undefined> }).env || {});
const appMode = frontendEnv.VITE_APP_MODE || frontendEnv.APP_MODE || 'demo';
const disableDemoFallback = frontendEnv.VITE_DISABLE_DEMO_FALLBACK || frontendEnv.DISABLE_DEMO_FALLBACK;

export const isDemoFallbackAllowed = () =>
  appMode !== 'production' && String(disableDemoFallback || '').toLowerCase() !== 'true';

// ─── Backend availability detection ──────────────────────────────────────────

let _backendStatus: 'unknown' | 'connected' | 'offline' = 'unknown';
let _checkPromise: Promise<boolean> | null = null;

export const checkBackend = (): Promise<boolean> => {
  if (_backendStatus === 'connected') return Promise.resolve(true);
  if (_backendStatus === 'offline') {
    if (!isDemoFallbackAllowed()) {
      return Promise.reject(new Error('Backend API is required because demo fallback is disabled.'));
    }
    return Promise.resolve(false);
  }
  if (_checkPromise) return _checkPromise;

  _checkPromise = (async () => {
    try {
      const res = await fetch('/api/health', {
        signal: AbortSignal.timeout(3000),
        credentials: 'include',
      });
      if (!res.ok) { _backendStatus = 'offline'; }
      const data = await res.json();
      _backendStatus = data.database === 'connected' ? 'connected' : 'offline';
    } catch {
      _backendStatus = 'offline';
    }
    if (_backendStatus !== 'connected' && !isDemoFallbackAllowed()) {
      throw new Error('Backend API is required because demo fallback is disabled.');
    }
    return _backendStatus === 'connected';
  })();

  return _checkPromise;
};

/** Force re-check (called on login/logout) */
export const resetBackendCheck = () => {
  _backendStatus = 'unknown';
  _checkPromise = null;
};

// ─── Token management ─────────────────────────────────────────────────────────

const TOKEN_KEY = 'rut_api_token';
export const storeToken = (token: string) => sessionStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => sessionStorage.removeItem(TOKEN_KEY);
export const getToken = () => sessionStorage.getItem(TOKEN_KEY);

// ─── Core fetch wrapper ───────────────────────────────────────────────────────

type ApiError = { error: string; reason?: string };

const buildHeaders = (): HeadersInit => {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

async function apiFetch<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: buildHeaders(),
    credentials: 'include',
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (res.status === 401) {
    clearToken();
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    throw new Error('Authentication required');
  }

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = json as ApiError;
    throw new Error(err.error || `API error ${res.status}`);
  }
  return json as T;
}

export const api = {
  get:    <T>(path: string) => apiFetch<T>('GET', path),
  post:   <T>(path: string, body: unknown) => apiFetch<T>('POST', path, body),
  patch:  <T>(path: string, body: unknown) => apiFetch<T>('PATCH', path, body),
  delete: <T>(path: string, body?: unknown) => apiFetch<T>('DELETE', path, body),
};

// ─── Response normalizers (snake_case → camelCase) ────────────────────────────

export const normalizeEmployee = (r: Record<string, unknown>): Employee => ({
  id: String(r.id),
  employeeId: String(r.employee_id),
  name: String(r.name),
  email: String(r.email),
  designation: String(r.designation),
  department: String(r.department),
  country: String(r.country),
  reportingManagerId: r.reporting_manager_id ? String(r.reporting_manager_id) : undefined,
  primaryCountryDirectorId: String(r.primary_country_director_id),
  mappedCountryDirectorIds: Array.isArray(r.mapped_country_director_ids)
    ? (r.mapped_country_director_ids as string[])
    : [],
  status: r.status as Employee['status'],
  utilizationEligible: r.utilization_eligible === undefined ? true : Boolean(r.utilization_eligible),
  joiningDate: r.joining_date ? String(r.joining_date).slice(0, 10) : undefined,
  exitDate: r.exit_date ? String(r.exit_date).slice(0, 10) : undefined,
  standardWeeklyHours: r.standard_weekly_hours === undefined || r.standard_weekly_hours === null ? undefined : Number(r.standard_weekly_hours),
  capacityType: r.capacity_type ? String(r.capacity_type) : undefined,
  contractType: r.contract_type ? String(r.contract_type) : undefined,
  leavePolicyId: r.leave_policy_id ? String(r.leave_policy_id) : undefined,
  entraObjectId: r.entra_object_id ? String(r.entra_object_id) : undefined,
  teamsUserId: r.teams_user_id ? String(r.teams_user_id) : undefined,
  plannedUtilization: 0,
  actualUtilization: 0,
  activeProjectCount: 0,
});

export const normalizeUtilizationReportEmployee = (r: Record<string, unknown>): Employee => ({
  id: String(r.id),
  employeeId: String(r.employee_id),
  name: String(r.name),
  email: String(r.email),
  designation: String(r.designation),
  department: String(r.department),
  country: String(r.country),
  reportingManagerId: r.reporting_manager_id ? String(r.reporting_manager_id) : undefined,
  primaryCountryDirectorId: String(r.primary_country_director_id),
  mappedCountryDirectorIds: Array.isArray(r.mapped_country_director_ids)
    ? (r.mapped_country_director_ids as string[])
    : [],
  status: r.status as Employee['status'],
  utilizationEligible: r.utilization_eligible === undefined ? true : Boolean(r.utilization_eligible),
  joiningDate: r.joining_date ? String(r.joining_date).slice(0, 10) : undefined,
  exitDate: r.exit_date ? String(r.exit_date).slice(0, 10) : undefined,
  standardWeeklyHours: r.standard_weekly_hours === undefined || r.standard_weekly_hours === null ? undefined : Number(r.standard_weekly_hours),
  capacityType: r.capacity_type ? String(r.capacity_type) : undefined,
  contractType: r.contract_type ? String(r.contract_type) : undefined,
  leavePolicyId: r.leave_policy_id ? String(r.leave_policy_id) : undefined,
  entraObjectId: r.entra_object_id ? String(r.entra_object_id) : undefined,
  teamsUserId: r.teams_user_id ? String(r.teams_user_id) : undefined,
  plannedUtilization: roundMetric(Number(r.planned_utilization ?? 0)),
  actualUtilization: roundMetric(Number(r.actual_utilization ?? 0)),
  activeProjectCount: Number(r.active_project_count ?? 0),
});

export const normalizeUtilizationReport = (r: Record<string, unknown>): UtilizationReport => {
  const thresholds = r.thresholds as Record<string, unknown> | undefined;
  const summary = r.summary as Record<string, unknown> | undefined;
  const rows = Array.isArray(r.rows) ? (r.rows as Record<string, unknown>[]) : [];
  return {
    mode: r.mode as UtilizationReport['mode'],
    asOfDate: String(r.asOfDate),
    sourceDate: String(r.sourceDate),
    forecastMonths: r.forecastMonths === null || r.forecastMonths === undefined ? null : Number(r.forecastMonths),
    expectedWeeklyHours: Number(r.expectedWeeklyHours ?? 40),
    thresholds: {
      high: Number(thresholds?.high ?? 100),
      low: Number(thresholds?.low ?? 80),
      bench: Number(thresholds?.bench ?? 20),
    },
    summary: {
      rows: Number(summary?.rows ?? rows.length),
      averagePlanned: Number(summary?.averagePlanned ?? 0),
      averageActual: Number(summary?.averageActual ?? 0),
      overloaded: Number(summary?.overloaded ?? 0),
      underutilized: Number(summary?.underutilized ?? 0),
      bench: Number(summary?.bench ?? 0),
    },
    rows: rows.map(normalizeUtilizationReportEmployee),
  };
};

export const normalizeProject = (r: Record<string, unknown>): Project => ({
  id: String(r.id),
  projectCode: String(r.project_code),
  name: String(r.name),
  clientId: r.client_id ? String(r.client_id) : undefined,
  client: String(r.client),
  managerId: String(r.manager_id),
  managerName: String(r.manager_name),
  startDate: String(r.start_date).slice(0, 10),
  endDate: String(r.end_date).slice(0, 10),
  status: r.status as Project['status'],
  billable: Boolean(r.billable),
  plannedUtilization: 0,
  actualUtilization: 0,
  resourceCount: 0,
});

export const normalizeAllocation = (
  r: Record<string, unknown>,
  projectMap: Map<string, Project>,
): Allocation => {
  const project = projectMap.get(String(r.project_id));
  return {
    id: String(r.id),
    employeeId: String(r.employee_id),
    projectId: String(r.project_id),
    projectName: project?.name ?? String(r.project_id),
    projectManager: project?.managerName ?? '',
    roleOnProject: r.role_on_project ? String(r.role_on_project) : undefined,
    percentage: Number(r.percentage),
    startDate: String(r.start_date).slice(0, 10),
    endDate: String(r.end_date).slice(0, 10),
    billable: Boolean(r.billable),
    status: r.status as Allocation['status'],
  };
};

export const normalizeClient = (r: Record<string, unknown>): Client => ({
  id: String(r.id),
  name: String(r.name),
  industry: String(r.industry ?? 'Unclassified'),
  accountOwnerId: r.account_owner_id ? String(r.account_owner_id) : undefined,
  countryDirectorIds: Array.isArray(r.country_director_ids)
    ? (r.country_director_ids as string[])
    : [],
  status: r.status as Client['status'],
  createdAt: String(r.created_at),
  updatedAt: String(r.updated_at),
});

export const normalizeTimesheetSummary = (
  r: Record<string, unknown>,
  employeeMap: Map<string, Employee>,
): TimesheetSummary => {
  const entries = Array.isArray(r.entries) ? (r.entries as Record<string, unknown>[]) : [];
  return {
    id: r.id ? String(r.id) : undefined,
    employeeId: String(r.employee_id),
    employeeName: employeeMap.get(String(r.employee_id))?.name ?? String(r.employee_id),
    weekEnding: String(r.week_ending).slice(0, 10),
    totalHours: roundMetric(Number(r.total_hours)),
    billableHours: roundMetric(Number(r.billable_hours)),
    status: r.status as TimesheetSummary['status'],
    rejectionReason: r.rejection_reason ? String(r.rejection_reason) : undefined,
    submittedAt: r.submitted_at ? String(r.submitted_at) : undefined,
    approvedAt: r.approved_at ? String(r.approved_at) : undefined,
    approvedBy: r.approved_by ? String(r.approved_by) : undefined,
    rejectedAt: r.rejected_at ? String(r.rejected_at) : undefined,
    rejectedBy: r.rejected_by ? String(r.rejected_by) : undefined,
    updatedAt: r.updated_at ? String(r.updated_at) : undefined,
    entries: entries.map((entry): TimesheetEntry => ({
      id: String(entry.id),
      employeeId: String(entry.employee_id ?? r.employee_id),
      projectId: entry.project_id ? String(entry.project_id) : undefined,
      projectName: entry.project_name ? String(entry.project_name) : undefined,
      workType: entry.work_type as TimesheetEntry['workType'],
      clientName: entry.client_name ? String(entry.client_name) : undefined,
      category: entry.category ? String(entry.category) : undefined,
      date: String(entry.work_date).slice(0, 10),
      hours: roundMetric(Number(entry.hours)),
      remark: entry.remark ? String(entry.remark) : undefined,
      status: (entry.status || r.status) as TimesheetEntry['status'],
      billable: Boolean(entry.billable) as true,
      weekEnding: String(entry.week_ending ?? r.week_ending).slice(0, 10),
    })),
  };
};

export const normalizeAuditLog = (r: Record<string, unknown>): AuditLog => ({
  id: String(r.id),
  userId: String(r.user_id),
  userName: String(r.user_name),
  userRole: String(r.user_role),
  activeRole: r.active_role ? String(r.active_role) : undefined,
  source: r.source ? String(r.source) : undefined,
  action: String(r.action),
  module: String(r.module),
  details: String(r.details),
  entityType: r.entity_type ? String(r.entity_type) : undefined,
  entityId: r.entity_id ? String(r.entity_id) : undefined,
  oldValue: r.old_value ?? undefined,
  newValue: r.new_value ?? undefined,
  reason: r.reason ? String(r.reason) : undefined,
  ipAddress: r.ip_address ? String(r.ip_address) : undefined,
  sessionId: r.session_id ? String(r.session_id) : undefined,
  timestamp: String(r.created_at),
});

export const normalizeImportExportLog = (r: Record<string, unknown>): ImportExportLog => ({
  id: String(r.id),
  operation: r.operation as ImportExportLog['operation'],
  channel: String(r.channel),
  fileName: String(r.file_name),
  status: r.status as ImportExportLog['status'],
  totalRows: Number(r.total_rows),
  validRows: Number(r.valid_rows),
  errorRows: Number(r.error_rows),
  errors: Array.isArray(r.errors) ? r.errors as ImportExportLog['errors'] : undefined,
  userName: String(r.user_name),
  timestamp: String(r.created_at),
});

export const normalizeDataQualityReport = (r: Record<string, unknown>): DataQualityReport => {
  const byType = r.byType && typeof r.byType === 'object' ? r.byType as Record<string, number> : {};
  const issues = Array.isArray(r.issues) ? r.issues as Record<string, unknown>[] : [];
  return {
    score: Number(r.score ?? 0),
    totalRecords: Number(r.totalRecords ?? 0),
    issueCount: Number(r.issueCount ?? issues.length),
    byType,
    generatedAt: String(r.generatedAt ?? new Date().toISOString()),
    issues: issues.map(issue => ({
      entityType: String(issue.entity_type ?? issue.entityType ?? ''),
      entityId: String(issue.entity_id ?? issue.entityId ?? ''),
      entity: String(issue.entity ?? ''),
      issueType: String(issue.issue_type ?? issue.issueType ?? ''),
      owner: String(issue.owner ?? ''),
      impact: String(issue.impact ?? ''),
      suggestedAction: String(issue.suggested_action ?? issue.suggestedAction ?? ''),
    })),
  };
};

export const normalizeDashboardReport = (r: Record<string, unknown>): DashboardReport => {
  const workforce = r.workforce as Record<string, unknown> | undefined;
  return {
    generatedAt: String(r.generatedAt ?? new Date().toISOString()),
    settings: r.settings && typeof r.settings === 'object' ? r.settings as Record<string, unknown> : {},
    workforce: {
      activePeople: Number(workforce?.active_people ?? workforce?.activePeople ?? 0),
      utilizationEligibleFte: Number(workforce?.utilization_eligible_fte ?? workforce?.utilizationEligibleFte ?? 0),
      governanceUsers: Number(workforce?.governance_users ?? workforce?.governanceUsers ?? 0),
    },
    projectStaffingRisks: Number(r.projectStaffingRisks ?? r.project_staffing_risks ?? 0),
    pendingTimesheets: Number(r.pendingTimesheets ?? r.pending_timesheets ?? 0),
    dataQuality: normalizeDataQualityReport((r.dataQuality ?? r.data_quality ?? {}) as Record<string, unknown>),
  };
};

export const normalizeLeaveType = (r: Record<string, unknown>): LeaveType => ({
  id: String(r.id),
  code: String(r.code),
  name: String(r.name),
  paid: Boolean(r.paid),
  requiresApproval: r.requires_approval === undefined ? Boolean(r.requiresApproval ?? true) : Boolean(r.requires_approval),
  active: r.active === undefined ? true : Boolean(r.active),
  createdAt: r.created_at ? String(r.created_at) : r.createdAt ? String(r.createdAt) : undefined,
  updatedAt: r.updated_at ? String(r.updated_at) : r.updatedAt ? String(r.updatedAt) : undefined,
});

export const normalizeLeavePolicy = (r: Record<string, unknown>): LeavePolicy => ({
  id: String(r.id),
  name: String(r.name),
  country: String(r.country ?? 'Global'),
  annualAllowanceDays: Number(r.annual_allowance_days ?? r.annualAllowanceDays ?? 0),
  carryForwardDays: Number(r.carry_forward_days ?? r.carryForwardDays ?? 0),
  accrualMethod: String(r.accrual_method ?? r.accrualMethod ?? 'Annual'),
  status: String(r.status ?? 'Active') as LeavePolicy['status'],
  leaveTypeIds: Array.isArray(r.leave_type_ids)
    ? (r.leave_type_ids as string[])
    : Array.isArray(r.leaveTypeIds)
      ? (r.leaveTypeIds as string[])
      : [],
  createdAt: r.created_at ? String(r.created_at) : r.createdAt ? String(r.createdAt) : undefined,
  updatedAt: r.updated_at ? String(r.updated_at) : r.updatedAt ? String(r.updatedAt) : undefined,
});

export const normalizeHoliday = (r: Record<string, unknown>): Holiday => ({
  id: String(r.id),
  calendarId: String(r.calendar_id ?? r.calendarId),
  name: String(r.name),
  date: String(r.holiday_date ?? r.date).slice(0, 10),
  type: String(r.holiday_type ?? r.type ?? 'Public') as Holiday['type'],
});

export const normalizeHolidayCalendar = (r: Record<string, unknown>): HolidayCalendar => ({
  id: String(r.id),
  name: String(r.name),
  country: String(r.country ?? 'Global'),
  year: Number(r.calendar_year ?? r.year),
  status: String(r.status ?? 'Active') as HolidayCalendar['status'],
  holidays: Array.isArray(r.holidays) ? (r.holidays as Record<string, unknown>[]).map(normalizeHoliday) : [],
  createdAt: r.created_at ? String(r.created_at) : r.createdAt ? String(r.createdAt) : undefined,
  updatedAt: r.updated_at ? String(r.updated_at) : r.updatedAt ? String(r.updatedAt) : undefined,
});

export const normalizeLeaveBalance = (r: Record<string, unknown>): LeaveBalance => ({
  id: String(r.id),
  employeeId: String(r.employee_id ?? r.employeeId),
  employeeName: r.employee_name ? String(r.employee_name) : r.employeeName ? String(r.employeeName) : undefined,
  leaveTypeId: String(r.leave_type_id ?? r.leaveTypeId),
  leaveTypeName: r.leave_type_name ? String(r.leave_type_name) : r.leaveTypeName ? String(r.leaveTypeName) : undefined,
  policyId: r.policy_id ? String(r.policy_id) : r.policyId ? String(r.policyId) : undefined,
  year: Number(r.balance_year ?? r.year),
  openingDays: Number(r.opening_days ?? r.openingDays ?? 0),
  accruedDays: Number(r.accrued_days ?? r.accruedDays ?? 0),
  usedDays: Number(r.used_days ?? r.usedDays ?? 0),
  adjustedDays: Number(r.adjusted_days ?? r.adjustedDays ?? 0),
  pendingDays: Number(r.pending_days ?? r.pendingDays ?? 0),
  availableDays: Number(r.available_days ?? r.availableDays ?? 0),
  updatedAt: r.updated_at ? String(r.updated_at) : r.updatedAt ? String(r.updatedAt) : undefined,
});

export const normalizeLeaveRequest = (r: Record<string, unknown>): LeaveRequest => ({
  id: String(r.id),
  employeeId: String(r.employee_id ?? r.employeeId),
  employeeName: r.employee_name ? String(r.employee_name) : r.employeeName ? String(r.employeeName) : undefined,
  leaveTypeId: String(r.leave_type_id ?? r.leaveTypeId),
  leaveTypeName: r.leave_type_name ? String(r.leave_type_name) : r.leaveTypeName ? String(r.leaveTypeName) : undefined,
  startDate: String(r.start_date ?? r.startDate).slice(0, 10),
  endDate: String(r.end_date ?? r.endDate).slice(0, 10),
  totalDays: Number(r.total_days ?? r.totalDays ?? 0),
  status: String(r.status ?? 'Submitted') as LeaveRequest['status'],
  reason: r.reason ? String(r.reason) : undefined,
  approverId: r.approver_id ? String(r.approver_id) : r.approverId ? String(r.approverId) : undefined,
  approverName: r.approver_name ? String(r.approver_name) : r.approverName ? String(r.approverName) : undefined,
  comments: r.comments ? String(r.comments) : undefined,
  submittedAt: r.submitted_at ? String(r.submitted_at) : r.submittedAt ? String(r.submittedAt) : undefined,
  decidedAt: r.decided_at ? String(r.decided_at) : r.decidedAt ? String(r.decidedAt) : undefined,
  createdAt: r.created_at ? String(r.created_at) : r.createdAt ? String(r.createdAt) : undefined,
  updatedAt: r.updated_at ? String(r.updated_at) : r.updatedAt ? String(r.updatedAt) : undefined,
});

export const normalizeSettings = (rows: Array<{ key: string; value: unknown }>): SystemSettings => {
  const map = Object.fromEntries(rows.map(r => [r.key, r.value]));
  return {
    utilizationThresholdHigh: Number(map.utilizationThresholdHigh ?? 100),
    utilizationThresholdLow: Number(map.utilizationThresholdLow ?? 80),
    expectedWeeklyHours: Number(map.expectedWeeklyHours ?? 40),
    benchThreshold: Number(map.benchThreshold ?? 20),
    timesheetPolicyMaxHours: Number(map.timesheetPolicyMaxHours ?? 40),
    blockOverAllocation: Boolean(map.blockOverAllocation),
    demoSubmissionMode: Boolean(map.demoSubmissionMode),
    currency: String(map.currency ?? 'GBP'),
  };
};

export const normalizeCatalogItem = (r: Record<string, unknown>): CatalogItem => ({
  id: String(r.id),
  name: String(r.name),
  active: Boolean(r.active),
  createdAt: String(r.created_at),
  updatedAt: r.updated_at ? String(r.updated_at) : undefined,
});

export const normalizeRoleDefinition = (r: Record<string, unknown>): RoleDefinition => ({
  id: String(r.id),
  name: String(r.name),
  department: String(r.department),
  description: r.description ? String(r.description) : undefined,
  active: Boolean(r.active),
  createdAt: String(r.created_at),
});

export const normalizeCountryDirector = (r: Record<string, unknown>): CountryDirector => ({
  id: String(r.id),
  name: String(r.name),
  region: String(r.region),
});

/**
 * Decode the JWT payload from the stored token.
 * Returns null if no token or invalid.
 */
export const decodeToken = (): Record<string, unknown> | null => {
  const token = getToken();
  if (!token || !token.includes('.')) return null;
  try {
    return JSON.parse(atob(token.split('.')[0]));
  } catch {
    return null;
  }
};
