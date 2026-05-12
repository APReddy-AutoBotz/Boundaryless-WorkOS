/**
 * apiClient.ts
 * Low-level HTTP client + backend availability detection + response normalizers.
 * All production API calls go through here.
 */

import type {
  Employee, Project, Allocation, Client, CountryDirector,
  TimesheetSummary, TimesheetEntry, AuditLog, SystemSettings,
  RoleDefinition, CatalogItem, UserSession, UserRole, ImportExportLog,
  UtilizationReport,
} from '../types';
import { roundMetric } from '../lib/format';

// ─── Backend availability detection ──────────────────────────────────────────

let _backendStatus: 'unknown' | 'connected' | 'offline' = 'unknown';
let _checkPromise: Promise<boolean> | null = null;

export const checkBackend = (): Promise<boolean> => {
  if (_backendStatus === 'connected') return Promise.resolve(true);
  if (_backendStatus === 'offline') return Promise.resolve(false);
  if (_checkPromise) return _checkPromise;

  _checkPromise = (async () => {
    try {
      const res = await fetch('/api/health', {
        signal: AbortSignal.timeout(3000),
        credentials: 'include',
      });
      if (!res.ok) { _backendStatus = 'offline'; return false; }
      const data = await res.json();
      _backendStatus = data.database === 'connected' ? 'connected' : 'offline';
    } catch {
      _backendStatus = 'offline';
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
  primaryCountryDirectorId: String(r.primary_country_director_id),
  mappedCountryDirectorIds: Array.isArray(r.mapped_country_director_ids)
    ? (r.mapped_country_director_ids as string[])
    : [],
  status: r.status as Employee['status'],
  utilizationEligible: r.utilization_eligible === undefined ? true : Boolean(r.utilization_eligible),
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
  primaryCountryDirectorId: String(r.primary_country_director_id),
  mappedCountryDirectorIds: Array.isArray(r.mapped_country_director_ids)
    ? (r.mapped_country_director_ids as string[])
    : [],
  status: r.status as Employee['status'],
  utilizationEligible: r.utilization_eligible === undefined ? true : Boolean(r.utilization_eligible),
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
  action: String(r.action),
  module: String(r.module),
  details: String(r.details),
  entityType: r.entity_type ? String(r.entity_type) : undefined,
  entityId: r.entity_id ? String(r.entity_id) : undefined,
  oldValue: r.old_value ?? undefined,
  newValue: r.new_value ?? undefined,
  reason: r.reason ? String(r.reason) : undefined,
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
