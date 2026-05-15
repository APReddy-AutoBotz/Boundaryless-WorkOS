/**
 * api.ts — Dual-mode service layer.
 * AUTO-DETECTS backend: if /api/health returns database:connected → uses REST API.
 * Otherwise → falls back to localStorage (demo mode). Zero code change needed to switch.
 */
import type { Employee, Project, Allocation, TimesheetSummary, AuditLog, ImportExportLog, SystemSettings, CountryDirector, RoleDefinition, Client, CatalogItem, UtilizationReport, UtilizationReportMode, UserAccount, DataQualityReport, DashboardReport, LeaveType, LeavePolicy, HolidayCalendar, LeaveBalance, LeaveRequest, LeaveAvailabilityEntry } from '../types';
import { DataStorage, STORAGE_KEYS } from './storage';
import { authService } from './authService';
import {
  api, checkBackend,
  normalizeEmployee, normalizeProject, normalizeAllocation,
  normalizeClient, normalizeTimesheetSummary, normalizeAuditLog,
  normalizeSettings, normalizeCatalogItem, normalizeRoleDefinition,
  normalizeCountryDirector, normalizeImportExportLog, normalizeUtilizationReport,
  normalizeDataQualityReport, normalizeDashboardReport, normalizeLeaveType,
  normalizeLeavePolicy, normalizeHolidayCalendar, normalizeLeaveBalance,
  normalizeLeaveRequest,
} from './apiClient';
import { getAllocationLoad, getLatestApprovedActualUtilization, getActiveAllocationsForEmployee, getDefaultUtilizationEligible, getUtilizationEligibleEmployees } from './calculations';
import { roundMetric } from '../lib/format';

const todayIso = () => new Date().toISOString().split('T')[0];
const sha256 = async (value: string) => {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
};
const generateTemporaryPassword = () => `RUT-${crypto.randomUUID().slice(0, 8)}`;
type CsvImportRow = Record<string, string>;
type ImportApplyError = {
  rowNumber: number;
  field?: string;
  message: string;
};
type ImportApplyResult = {
  status: ImportExportLog['status'];
  totalRows: number;
  validRows: number;
  errorRows: number;
  errors: ImportApplyError[];
  log?: ImportExportLog;
};

const actor = () => {
  const s = authService.getCurrentUser();
  return { id: s?.id || 'sys', name: s?.name || 'System', role: s?.role || 'Admin' };
};

// ── Computed utilization (used in both modes) ────────────────────────────────
function enrichEmployees(employees: Employee[], allocations: Allocation[], projects: Project[], timesheets: TimesheetSummary[], settings: SystemSettings): Employee[] {
  const today = todayIso();
  return employees.map(emp => ({
    ...emp,
    plannedUtilization: getAllocationLoad(emp.id, allocations, projects, today, today),
    actualUtilization: getLatestApprovedActualUtilization(emp.id, timesheets, settings),
    activeProjectCount: getActiveAllocationsForEmployee(emp.id, allocations, projects, today, today).length,
  }));
}

// ── Employee Service ─────────────────────────────────────────────────────────
export const employeeService = {
  getAll: async (): Promise<Employee[]> => {
    if (await checkBackend()) {
      const [rawEmps, rawAllocs, rawProjects, rawTS, rawSettings] = await Promise.all([
        api.get<Record<string, unknown>[]>('/api/employees'),
        api.get<Record<string, unknown>[]>('/api/allocations'),
        api.get<Record<string, unknown>[]>('/api/projects'),
        api.get<Record<string, unknown>[]>('/api/timesheets'),
        api.get<Array<{ key: string; value: unknown }>>('/api/settings'),
      ]);
      const projects = rawProjects.map(normalizeProject);
      const projectMap = new Map(projects.map(p => [p.id, p]));
      const allocations = rawAllocs.map(r => normalizeAllocation(r, projectMap));
      const settings = normalizeSettings(rawSettings);
      const employees = rawEmps.map(normalizeEmployee);
      const timesheets = rawTS.map(r => normalizeTimesheetSummary(r, new Map()));
      return enrichEmployees(employees, allocations, projects, timesheets, settings);
    }
    return DataStorage.get<Employee[]>(STORAGE_KEYS.EMPLOYEES, []);
  },
  getById: async (id: string): Promise<Employee | undefined> => {
    const list = await employeeService.getAll();
    return list.find(e => e.id === id);
  },
  save: async (emp: Employee): Promise<void> => {
    if (await checkBackend()) {
      await api.post('/api/employees', {
        employee_id: emp.employeeId,
        name: emp.name,
        email: emp.email,
        designation: emp.designation,
        department: emp.department,
        country: emp.country,
        reporting_manager_id: emp.reportingManagerId || null,
        primary_country_director_id: emp.primaryCountryDirectorId,
        mapped_country_director_ids: emp.mappedCountryDirectorIds,
        utilization_eligible: emp.utilizationEligible ?? getDefaultUtilizationEligible(emp),
        joining_date: emp.joiningDate || null,
        exit_date: emp.exitDate || null,
        standard_weekly_hours: emp.standardWeeklyHours ?? null,
        capacity_type: emp.capacityType || null,
        contract_type: emp.contractType || null,
        leave_policy_id: emp.leavePolicyId || null,
        entra_object_id: emp.entraObjectId || null,
        teams_user_id: emp.teamsUserId || null,
        status: emp.status,
      });
      return;
    }
    // localStorage mode
    const list = DataStorage.get<Employee[]>(STORAGE_KEYS.EMPLOYEES, []);
    const idx = list.findIndex(e => e.id === emp.id);
    const nextEmployee = {
      ...emp,
      utilizationEligible: emp.utilizationEligible ?? getDefaultUtilizationEligible(emp),
    };
    if (idx >= 0) list[idx] = nextEmployee; else list.push(nextEmployee);
    DataStorage.set(STORAGE_KEYS.EMPLOYEES, list);
    DataStorage.ensureUserAccounts();
    DataStorage.recalculateUtilization();
    const u = actor();
    DataStorage.logAction(u.id, u.name, u.role, idx >= 0 ? 'Update' : 'Create', 'Employee', `${idx >= 0 ? 'Updated' : 'Created'} employee ${emp.name}`, { entityType: 'Employee', entityId: emp.id });
  },
  delete: async (id: string): Promise<void> => {
    if (await checkBackend()) {
      await api.delete(`/api/employees/${id}`);
      return;
    }
    const list = DataStorage.get<Employee[]>(STORAGE_KEYS.EMPLOYEES, []);
    DataStorage.set(STORAGE_KEYS.EMPLOYEES, list.map(e => e.id === id ? { ...e, status: 'Exited' as const } : e));
    DataStorage.ensureUserAccounts();
    DataStorage.recalculateUtilization();
  },
};

// ── Project Service ──────────────────────────────────────────────────────────
export const projectService = {
  getAll: async (): Promise<Project[]> => {
    if (await checkBackend()) {
      const raw = await api.get<Record<string, unknown>[]>('/api/projects');
      return raw.map(normalizeProject);
    }
    return DataStorage.get<Project[]>(STORAGE_KEYS.PROJECTS, []);
  },
  getById: async (id: string): Promise<Project | undefined> => {
    const list = await projectService.getAll();
    return list.find(p => p.id === id);
  },
  save: async (proj: Project): Promise<void> => {
    if (await checkBackend()) {
      const clients = await clientService.getAll();
      const client = clients.find(c => c.id === proj.clientId || c.name === proj.client);
      await api.post('/api/projects', {
        id: proj.id,
        project_code: proj.projectCode,
        name: proj.name,
        client_id: client?.id || proj.clientId,
        manager_id: proj.managerId,
        start_date: proj.startDate,
        end_date: proj.endDate,
        status: proj.status,
        billable: proj.billable,
        notes: (proj as unknown as Record<string, unknown>).notes || null,
      });
      return;
    }
    const list = DataStorage.get<Project[]>(STORAGE_KEYS.PROJECTS, []);
    const idx = list.findIndex(p => p.id === proj.id);
    if (idx >= 0) list[idx] = proj; else list.push(proj);
    DataStorage.set(STORAGE_KEYS.PROJECTS, list);
    DataStorage.recalculateUtilization();
  },
  close: async (id: string): Promise<boolean> => {
    if (await checkBackend()) {
      await api.patch(`/api/projects/${id}/status`, { status: 'Completed' });
      return true;
    }
    const list = DataStorage.get<Project[]>(STORAGE_KEYS.PROJECTS, []);
    const proj = list.find(p => p.id === id);
    if (!proj) return false;
    DataStorage.set(STORAGE_KEYS.PROJECTS, list.map(p => p.id === id ? { ...p, status: 'Completed', endDate: todayIso() } : p));
    DataStorage.recalculateUtilization();
    return true;
  },
};

// ── Client Service ───────────────────────────────────────────────────────────
export const clientService = {
  getAll: async (): Promise<Client[]> => {
    if (await checkBackend()) {
      const raw = await api.get<Record<string, unknown>[]>('/api/clients');
      return raw.map(normalizeClient);
    }
    return DataStorage.get<Client[]>(STORAGE_KEYS.CLIENTS, []);
  },
  getById: async (id: string): Promise<Client | undefined> => {
    const list = await clientService.getAll();
    return list.find(c => c.id === id);
  },
  save: async (client: Client): Promise<void> => {
    if (await checkBackend()) {
      await api.post('/api/clients', {
        id: client.id,
        name: client.name,
        industry: client.industry,
        account_owner_id: client.accountOwnerId || null,
        country_director_ids: client.countryDirectorIds,
        status: client.status,
      });
      return;
    }
    const list = DataStorage.get<Client[]>(STORAGE_KEYS.CLIENTS, []);
    const idx = list.findIndex(c => c.id === client.id);
    const previous = idx >= 0 ? list[idx] : undefined;
    if (idx >= 0) list[idx] = client; else list.push(client);
    DataStorage.set(STORAGE_KEYS.CLIENTS, list);
    if (previous && previous.name !== client.name) {
      const projects = DataStorage.get<Project[]>(STORAGE_KEYS.PROJECTS, []);
      DataStorage.set(STORAGE_KEYS.PROJECTS, projects.map(project => (
        project.clientId === client.id || project.client === previous.name
          ? { ...project, client: client.name, clientId: client.id }
          : project
      )));
    }
  },
  delete: async (id: string): Promise<boolean> => {
    if (await checkBackend()) {
      await api.delete(`/api/clients/${id}`);
      return true;
    }
    const list = DataStorage.get<Client[]>(STORAGE_KEYS.CLIENTS, []);
    const client = list.find(c => c.id === id);
    if (!client) return false;
    DataStorage.set(STORAGE_KEYS.CLIENTS, list.map(c => c.id === id ? { ...c, status: 'Inactive' as const } : c));
    return true;
  },
};

// ── Allocation Service ───────────────────────────────────────────────────────
export const allocationService = {
  getAll: async (): Promise<Allocation[]> => {
    if (await checkBackend()) {
      const [rawAllocs, rawProjects] = await Promise.all([
        api.get<Record<string, unknown>[]>('/api/allocations'),
        api.get<Record<string, unknown>[]>('/api/projects'),
      ]);
      const projects = rawProjects.map(normalizeProject);
      const projectMap = new Map(projects.map(p => [p.id, p]));
      return rawAllocs.map(r => normalizeAllocation(r, projectMap));
    }
    return DataStorage.get<Allocation[]>(STORAGE_KEYS.ALLOCATIONS, []);
  },
  save: async (alloc: Allocation): Promise<void> => {
    if (await checkBackend()) {
      await api.post('/api/allocations', {
        id: alloc.id,
        employee_id: alloc.employeeId,
        project_id: alloc.projectId,
        role_on_project: alloc.roleOnProject || null,
        percentage: alloc.percentage,
        start_date: alloc.startDate,
        end_date: alloc.endDate,
        billable: alloc.billable,
        status: alloc.status,
      });
      return;
    }
    const list = DataStorage.get<Allocation[]>(STORAGE_KEYS.ALLOCATIONS, []);
    const idx = list.findIndex(a => a.id === alloc.id);
    if (idx >= 0) list[idx] = alloc; else list.push(alloc);
    DataStorage.set(STORAGE_KEYS.ALLOCATIONS, list);
    DataStorage.recalculateUtilization();
  },
  delete: async (id: string): Promise<boolean> => {
    if (await checkBackend()) {
      await api.delete(`/api/allocations/${id}`);
      return true;
    }
    const list = DataStorage.get<Allocation[]>(STORAGE_KEYS.ALLOCATIONS, []);
    const alloc = list.find(a => a.id === id);
    if (!alloc) return false;
    DataStorage.set(STORAGE_KEYS.ALLOCATIONS, list.map(a => a.id === id ? { ...a, status: 'Completed' as const, endDate: todayIso() } : a));
    DataStorage.recalculateUtilization();
    return true;
  },
};

// ── Timesheet Service ────────────────────────────────────────────────────────
export const timesheetService = {
  getAll: async (): Promise<TimesheetSummary[]> => {
    if (await checkBackend()) {
      const [rawTS, rawEmps] = await Promise.all([
        api.get<Record<string, unknown>[]>('/api/timesheets'),
        api.get<Record<string, unknown>[]>('/api/employees'),
      ]);
      const empMap = new Map(rawEmps.map(r => [String(r.id), { ...normalizeEmployee(r), plannedUtilization: 0, actualUtilization: 0, activeProjectCount: 0 }]));
      return rawTS.map(r => normalizeTimesheetSummary(r, empMap));
    }
    return DataStorage.get<TimesheetSummary[]>(STORAGE_KEYS.TIMESHEETS, []);
  },
  save: async (ts: TimesheetSummary): Promise<void> => {
    const roundedEntries = ts.entries.map(e => ({ ...e, hours: roundMetric(e.hours) }));
    const totalHours = roundMetric(roundedEntries.reduce((sum, entry) => sum + entry.hours, 0));
    const billableHours = roundMetric(roundedEntries.filter(entry => entry.billable).reduce((sum, entry) => sum + entry.hours, 0));
    if (await checkBackend()) {
      await api.post('/api/timesheets', {
        employee_id: ts.employeeId,
        week_ending: ts.weekEnding,
        status: ts.status,
        rejection_reason: ts.rejectionReason || null,
        entries: roundedEntries.map(e => ({
          id: e.id,
          project_id: e.projectId || null,
          work_type: e.workType,
          client_name: e.clientName || null,
          category: e.category || null,
          work_date: e.date,
          hours: e.hours,
          remark: e.remark || null,
          billable: e.billable,
        })),
      });
      return;
    }
    // localStorage save with future-week guard
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const weekStart = new Date(ts.weekEnding);
    weekStart.setDate(weekStart.getDate() - 4);
    const currWeekStart = new Date(today);
    const d = currWeekStart.getDay();
    currWeekStart.setDate(currWeekStart.getDate() + (d === 0 ? -6 : 1 - d));
    if (weekStart > currWeekStart) throw new Error('Future week timesheets cannot be saved or submitted.');
    const list = DataStorage.get<TimesheetSummary[]>(STORAGE_KEYS.TIMESHEETS, []);
    const idx = list.findIndex(t => t.employeeId === ts.employeeId && t.weekEnding === ts.weekEnding);
    const next = { ...ts, entries: roundedEntries, totalHours, billableHours, updatedAt: new Date().toISOString() };
    if (idx >= 0) list[idx] = next; else list.push(next);
    DataStorage.set(STORAGE_KEYS.TIMESHEETS, list);
    DataStorage.recalculateUtilization();
  },
  approve: async (timesheetId: string, _reason?: string): Promise<void> => {
    if (await checkBackend()) {
      const backendId = timesheetId.includes(':')
        ? (await timesheetService.getAll()).find(t => `${t.employeeId}:${t.weekEnding}` === timesheetId)?.id
        : timesheetId;
      if (!backendId) throw new Error('Timesheet record was not found for approval.');
      await api.patch(`/api/timesheets/${backendId}/status`, { status: 'Approved' });
      return;
    }
    const [empId, weekEnding] = timesheetId.includes(':') ? timesheetId.split(':') : [timesheetId, ''];
    const list = DataStorage.get<TimesheetSummary[]>(STORAGE_KEYS.TIMESHEETS, []);
    DataStorage.set(STORAGE_KEYS.TIMESHEETS, list.map(t =>
      (t.employeeId === empId && t.weekEnding === weekEnding)
        ? { ...t, status: 'Approved' as const, approvedAt: new Date().toISOString() }
        : t
    ));
  },
  reject: async (timesheetId: string, reason: string): Promise<void> => {
    if (await checkBackend()) {
      const backendId = timesheetId.includes(':')
        ? (await timesheetService.getAll()).find(t => `${t.employeeId}:${t.weekEnding}` === timesheetId)?.id
        : timesheetId;
      if (!backendId) throw new Error('Timesheet record was not found for rejection.');
      await api.patch(`/api/timesheets/${backendId}/status`, { status: 'Rejected', reason });
      return;
    }
    const [empId, weekEnding] = timesheetId.includes(':') ? timesheetId.split(':') : [timesheetId, ''];
    const list = DataStorage.get<TimesheetSummary[]>(STORAGE_KEYS.TIMESHEETS, []);
    DataStorage.set(STORAGE_KEYS.TIMESHEETS, list.map(t =>
      (t.employeeId === empId && t.weekEnding === weekEnding)
        ? { ...t, status: 'Rejected' as const, rejectionReason: reason, rejectionNote: reason, rejectedAt: new Date().toISOString() }
        : t
    ));
  },
};

// ── Admin Service ────────────────────────────────────────────────────────────
const leaveDayCount = (startDate: string, endDate: string) => {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;
  let days = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) days += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
};

const refreshLocalLeaveBalances = () => {
  const balances = DataStorage.get<LeaveBalance[]>(STORAGE_KEYS.LEAVE_BALANCES, []);
  const requests = DataStorage.get<LeaveRequest[]>(STORAGE_KEYS.LEAVE_REQUESTS, []);
  const employees = DataStorage.get<Employee[]>(STORAGE_KEYS.EMPLOYEES, []);
  const leaveTypes = DataStorage.get<LeaveType[]>(STORAGE_KEYS.LEAVE_TYPES, []);
  const employeesById = new Map(employees.map(employee => [employee.id, employee]));
  const leaveTypeById = new Map(leaveTypes.map(type => [type.id, type]));
  const next = balances.map(balance => {
    const matchingRequests = requests.filter(request =>
      request.employeeId === balance.employeeId &&
      request.leaveTypeId === balance.leaveTypeId &&
      new Date(`${request.startDate}T00:00:00`).getFullYear() === balance.year
    );
    const usedDays = matchingRequests
      .filter(request => request.status === 'Approved')
      .reduce((sum, request) => sum + request.totalDays, 0);
    const pendingDays = matchingRequests
      .filter(request => request.status === 'Submitted')
      .reduce((sum, request) => sum + request.totalDays, 0);
    const availableDays = Math.max(0, balance.openingDays + balance.accruedDays + balance.adjustedDays - usedDays - pendingDays);
    return {
      ...balance,
      employeeName: balance.employeeName || employeesById.get(balance.employeeId)?.name,
      leaveTypeName: balance.leaveTypeName || leaveTypeById.get(balance.leaveTypeId)?.name,
      usedDays,
      pendingDays,
      availableDays,
      updatedAt: new Date().toISOString(),
    };
  });
  DataStorage.set(STORAGE_KEYS.LEAVE_BALANCES, next);
  return next;
};

const buildLocalLeaveAvailability = async (): Promise<LeaveAvailabilityEntry[]> => {
  const [employees, requests, calendars] = await Promise.all([
    employeeService.getAll(),
    leaveService.getRequests(),
    leaveService.getHolidayCalendars(),
  ]);
  const currentYear = new Date().getFullYear();
  return employees
    .filter(employee => employee.status !== 'Exited')
    .map(employee => {
      const approvedLeaveDays = requests
        .filter(request =>
          request.employeeId === employee.id &&
          request.status === 'Approved' &&
          new Date(`${request.startDate}T00:00:00`).getFullYear() === currentYear
        )
        .reduce((sum, request) => sum + request.totalDays, 0);
      const holidayDays = calendars
        .filter(calendar => calendar.status === 'Active' && calendar.year === currentYear && (calendar.country === 'Global' || calendar.country === employee.country))
        .flatMap(calendar => calendar.holidays)
        .filter(holiday => {
          const day = new Date(`${holiday.date}T00:00:00`).getDay();
          return day !== 0 && day !== 6;
        }).length;
      const standardWeeklyHours = employee.standardWeeklyHours || 40;
      const dailyHours = standardWeeklyHours / 5;
      return {
        employeeId: employee.id,
        employeeName: employee.name,
        standardWeeklyHours,
        approvedLeaveDays,
        holidayDays,
        availabilityHours: Math.max(0, standardWeeklyHours * 52 - (approvedLeaveDays + holidayDays) * dailyHours),
      };
    });
};

export const leaveService = {
  getTypes: async (): Promise<LeaveType[]> => {
    if (await checkBackend()) {
      const raw = await api.get<Record<string, unknown>[]>('/api/leave/types');
      return raw.map(normalizeLeaveType);
    }
    return DataStorage.get<LeaveType[]>(STORAGE_KEYS.LEAVE_TYPES, []);
  },
  saveType: async (type: LeaveType): Promise<void> => {
    if (await checkBackend()) {
      await api.post('/api/leave/types', {
        id: type.id,
        code: type.code,
        name: type.name,
        paid: type.paid,
        requires_approval: type.requiresApproval,
        active: type.active,
      });
      return;
    }
    const list = DataStorage.get<LeaveType[]>(STORAGE_KEYS.LEAVE_TYPES, []);
    const idx = list.findIndex(item => item.id === type.id);
    if (idx >= 0) list[idx] = type; else list.push(type);
    DataStorage.set(STORAGE_KEYS.LEAVE_TYPES, list);
  },
  getPolicies: async (): Promise<LeavePolicy[]> => {
    if (await checkBackend()) {
      const raw = await api.get<Record<string, unknown>[]>('/api/leave/policies');
      return raw.map(normalizeLeavePolicy);
    }
    return DataStorage.get<LeavePolicy[]>(STORAGE_KEYS.LEAVE_POLICIES, []);
  },
  savePolicy: async (policy: LeavePolicy): Promise<void> => {
    if (await checkBackend()) {
      await api.post('/api/leave/policies', {
        id: policy.id,
        name: policy.name,
        country: policy.country,
        annual_allowance_days: policy.annualAllowanceDays,
        carry_forward_days: policy.carryForwardDays,
        accrual_method: policy.accrualMethod,
        status: policy.status,
        leave_type_ids: policy.leaveTypeIds,
      });
      return;
    }
    const list = DataStorage.get<LeavePolicy[]>(STORAGE_KEYS.LEAVE_POLICIES, []);
    const idx = list.findIndex(item => item.id === policy.id);
    if (idx >= 0) list[idx] = policy; else list.push(policy);
    DataStorage.set(STORAGE_KEYS.LEAVE_POLICIES, list);
    const u = actor();
    DataStorage.logAction(u.id, u.name, u.role, idx >= 0 ? 'Update' : 'Create', 'Leave', `${idx >= 0 ? 'Updated' : 'Created'} leave policy ${policy.name}`, { entityType: 'LeavePolicy', entityId: policy.id });
  },
  getHolidayCalendars: async (): Promise<HolidayCalendar[]> => {
    if (await checkBackend()) {
      const raw = await api.get<Record<string, unknown>[]>('/api/holiday-calendars');
      return raw.map(normalizeHolidayCalendar);
    }
    return DataStorage.get<HolidayCalendar[]>(STORAGE_KEYS.HOLIDAY_CALENDARS, []);
  },
  saveHolidayCalendar: async (calendar: HolidayCalendar): Promise<void> => {
    if (await checkBackend()) {
      await api.post('/api/holiday-calendars', {
        id: calendar.id,
        name: calendar.name,
        country: calendar.country,
        year: calendar.year,
        status: calendar.status,
        holidays: calendar.holidays.map(holiday => ({
          id: holiday.id,
          name: holiday.name,
          date: holiday.date,
          type: holiday.type,
        })),
      });
      return;
    }
    const list = DataStorage.get<HolidayCalendar[]>(STORAGE_KEYS.HOLIDAY_CALENDARS, []);
    const idx = list.findIndex(item => item.id === calendar.id);
    if (idx >= 0) list[idx] = calendar; else list.push(calendar);
    DataStorage.set(STORAGE_KEYS.HOLIDAY_CALENDARS, list);
  },
  getBalances: async (): Promise<LeaveBalance[]> => {
    if (await checkBackend()) {
      const raw = await api.get<Record<string, unknown>[]>('/api/leave/balances');
      return raw.map(normalizeLeaveBalance);
    }
    return refreshLocalLeaveBalances();
  },
  saveBalance: async (balance: LeaveBalance): Promise<void> => {
    if (await checkBackend()) {
      await api.post('/api/leave/balances', {
        id: balance.id,
        employee_id: balance.employeeId,
        leave_type_id: balance.leaveTypeId,
        policy_id: balance.policyId || null,
        year: balance.year,
        opening_days: balance.openingDays,
        accrued_days: balance.accruedDays,
        adjusted_days: balance.adjustedDays,
      });
      return;
    }
    const list = DataStorage.get<LeaveBalance[]>(STORAGE_KEYS.LEAVE_BALANCES, []);
    const idx = list.findIndex(item => item.id === balance.id);
    if (idx >= 0) list[idx] = balance; else list.push(balance);
    DataStorage.set(STORAGE_KEYS.LEAVE_BALANCES, list);
    refreshLocalLeaveBalances();
  },
  getRequests: async (): Promise<LeaveRequest[]> => {
    if (await checkBackend()) {
      const raw = await api.get<Record<string, unknown>[]>('/api/leave/requests');
      return raw.map(normalizeLeaveRequest);
    }
    const employees = await employeeService.getAll();
    const types = DataStorage.get<LeaveType[]>(STORAGE_KEYS.LEAVE_TYPES, []);
    const employeesById = new Map(employees.map(employee => [employee.id, employee]));
    const typesById = new Map(types.map(type => [type.id, type]));
    return DataStorage.get<LeaveRequest[]>(STORAGE_KEYS.LEAVE_REQUESTS, []).map(request => ({
      ...request,
      employeeName: request.employeeName || employeesById.get(request.employeeId)?.name,
      leaveTypeName: request.leaveTypeName || typesById.get(request.leaveTypeId)?.name,
    }));
  },
  submitRequest: async (request: LeaveRequest): Promise<LeaveRequest> => {
    const totalDays = request.totalDays || leaveDayCount(request.startDate, request.endDate);
    if (await checkBackend()) {
      const raw = await api.post<Record<string, unknown>>('/api/leave/requests', {
        employee_id: request.employeeId,
        leave_type_id: request.leaveTypeId,
        start_date: request.startDate,
        end_date: request.endDate,
        total_days: totalDays,
        reason: request.reason || null,
      });
      return normalizeLeaveRequest(raw);
    }
    const employees = DataStorage.get<Employee[]>(STORAGE_KEYS.EMPLOYEES, []);
    const types = DataStorage.get<LeaveType[]>(STORAGE_KEYS.LEAVE_TYPES, []);
    const next: LeaveRequest = {
      ...request,
      id: request.id || crypto.randomUUID(),
      totalDays,
      status: 'Submitted',
      employeeName: employees.find(employee => employee.id === request.employeeId)?.name,
      leaveTypeName: types.find(type => type.id === request.leaveTypeId)?.name,
      submittedAt: new Date().toISOString(),
      createdAt: request.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const list = DataStorage.get<LeaveRequest[]>(STORAGE_KEYS.LEAVE_REQUESTS, []);
    DataStorage.set(STORAGE_KEYS.LEAVE_REQUESTS, [next, ...list.filter(item => item.id !== next.id)]);
    refreshLocalLeaveBalances();
    const u = actor();
    DataStorage.logAction(u.id, u.name, u.role, 'Submit Leave', 'Leave', `Submitted leave request for ${next.employeeName || next.employeeId}`, { entityType: 'LeaveRequest', entityId: next.id, newValue: next });
    return next;
  },
  updateRequestStatus: async (id: string, status: 'Approved' | 'Rejected' | 'Cancelled', comments?: string): Promise<LeaveRequest> => {
    if (await checkBackend()) {
      return normalizeLeaveRequest(await api.patch<Record<string, unknown>>(`/api/leave/requests/${id}/status`, { status, comments }));
    }
    const list = DataStorage.get<LeaveRequest[]>(STORAGE_KEYS.LEAVE_REQUESTS, []);
    const previous = list.find(item => item.id === id);
    if (!previous) throw new Error('Leave request was not found.');
    const u = actor();
    const next = {
      ...previous,
      status,
      comments,
      approverId: u.id,
      approverName: u.name,
      decidedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    DataStorage.set(STORAGE_KEYS.LEAVE_REQUESTS, list.map(item => item.id === id ? next : item));
    refreshLocalLeaveBalances();
    DataStorage.logAction(u.id, u.name, u.role, `${status} Leave`, 'Leave', `${status} leave request for ${next.employeeName || next.employeeId}`, { entityType: 'LeaveRequest', entityId: next.id, oldValue: previous, newValue: next, reason: comments });
    return next;
  },
  getAvailability: async (): Promise<LeaveAvailabilityEntry[]> => {
    if (await checkBackend()) {
      const raw = await api.get<Record<string, unknown>[]>('/api/reports/availability');
      return raw.map(row => ({
        employeeId: String(row.employee_id ?? row.employeeId),
        employeeName: String(row.employee_name ?? row.employeeName),
        standardWeeklyHours: Number(row.standard_weekly_hours ?? row.standardWeeklyHours ?? 40),
        approvedLeaveDays: Number(row.approved_leave_days ?? row.approvedLeaveDays ?? 0),
        holidayDays: Number(row.holiday_days ?? row.holidayDays ?? 0),
        availabilityHours: Number(row.availability_hours ?? row.availabilityHours ?? 0),
      }));
    }
    return buildLocalLeaveAvailability();
  },
};

export const adminService = {
  getAuditLogs: async (): Promise<AuditLog[]> => {
    if (await checkBackend()) {
      try {
        const raw = await api.get<Record<string, unknown>[]>('/api/audit-logs');
        return raw.map(normalizeAuditLog);
      } catch (error) {
        return [];
      }
    }
    return DataStorage.get<AuditLog[]>(STORAGE_KEYS.AUDIT_LOGS, []);
  },
  getImportExportLogs: async (): Promise<ImportExportLog[]> => {
    if (await checkBackend()) {
      const raw = await api.get<Record<string, unknown>[]>('/api/import-export-logs');
      return raw.map(normalizeImportExportLog);
    }
    return DataStorage.get<ImportExportLog[]>(STORAGE_KEYS.IMPORT_EXPORT_LOGS, []);
  },
  saveImportExportLog: async (log: Omit<ImportExportLog, 'id' | 'timestamp' | 'userName'> & Partial<Pick<ImportExportLog, 'id' | 'timestamp' | 'userName'>>): Promise<ImportExportLog> => {
    if (await checkBackend()) {
      const raw = await api.post<Record<string, unknown>>('/api/import-export-logs', {
        operation: log.operation,
        channel: log.channel,
        fileName: log.fileName,
        status: log.status,
        totalRows: log.totalRows,
        validRows: log.validRows,
        errorRows: log.errorRows,
        errors: log.errors,
      });
      await api.post('/api/audit-events', {
        action: log.operation,
        module: 'Import / Export',
        details: `${log.operation} ${log.fileName} through ${log.channel} with ${log.totalRows} row${log.totalRows === 1 ? '' : 's'} (${log.status})`,
        entityType: 'ImportExportLog',
        entityId: String(raw.id || log.fileName),
        newValue: {
          channel: log.channel,
          fileName: log.fileName,
          status: log.status,
          totalRows: log.totalRows,
          validRows: log.validRows,
          errorRows: log.errorRows,
        },
      }).catch(() => {});
      return normalizeImportExportLog(raw);
    }
    const u = actor();
    const nextLog: ImportExportLog = {
      ...log,
      id: log.id || crypto.randomUUID(),
      timestamp: log.timestamp || new Date().toISOString(),
      userName: log.userName || u.name,
    };
    const logs = DataStorage.get<ImportExportLog[]>(STORAGE_KEYS.IMPORT_EXPORT_LOGS, []);
    DataStorage.set(STORAGE_KEYS.IMPORT_EXPORT_LOGS, [nextLog, ...logs].slice(0, 100));
    return nextLog;
  },
  applyEmployeeImport: async (fileName: string, rows: CsvImportRow[], clientErrors: ImportApplyError[] = [], totalRows = rows.length): Promise<ImportApplyResult | null> => {
    if (!(await checkBackend())) return null;
    const raw = await api.post<Record<string, unknown>>('/api/imports/employees/apply', {
      fileName,
      rows,
      totalRows,
      clientErrors,
    });
    return {
      status: raw.status as ImportExportLog['status'],
      totalRows: Number(raw.totalRows ?? rows.length),
      validRows: Number(raw.validRows ?? 0),
      errorRows: Number(raw.errorRows ?? 0),
      errors: Array.isArray(raw.errors) ? raw.errors as ImportApplyError[] : [],
      log: raw.log && typeof raw.log === 'object' ? normalizeImportExportLog(raw.log as Record<string, unknown>) : undefined,
    };
  },
  applyClientImport: async (fileName: string, rows: CsvImportRow[], clientErrors: ImportApplyError[] = [], totalRows = rows.length): Promise<ImportApplyResult | null> => {
    if (!(await checkBackend())) return null;
    const raw = await api.post<Record<string, unknown>>('/api/imports/clients/apply', {
      fileName,
      rows,
      totalRows,
      clientErrors,
    });
    return {
      status: raw.status as ImportExportLog['status'],
      totalRows: Number(raw.totalRows ?? rows.length),
      validRows: Number(raw.validRows ?? 0),
      errorRows: Number(raw.errorRows ?? 0),
      errors: Array.isArray(raw.errors) ? raw.errors as ImportApplyError[] : [],
      log: raw.log && typeof raw.log === 'object' ? normalizeImportExportLog(raw.log as Record<string, unknown>) : undefined,
    };
  },
  applyProjectImport: async (fileName: string, rows: CsvImportRow[], clientErrors: ImportApplyError[] = [], totalRows = rows.length): Promise<ImportApplyResult | null> => {
    if (!(await checkBackend())) return null;
    const raw = await api.post<Record<string, unknown>>('/api/imports/projects/apply', {
      fileName,
      rows,
      totalRows,
      clientErrors,
    });
    return {
      status: raw.status as ImportExportLog['status'],
      totalRows: Number(raw.totalRows ?? rows.length),
      validRows: Number(raw.validRows ?? 0),
      errorRows: Number(raw.errorRows ?? 0),
      errors: Array.isArray(raw.errors) ? raw.errors as ImportApplyError[] : [],
      log: raw.log && typeof raw.log === 'object' ? normalizeImportExportLog(raw.log as Record<string, unknown>) : undefined,
    };
  },
  applyAllocationImport: async (fileName: string, rows: CsvImportRow[], clientErrors: ImportApplyError[] = [], totalRows = rows.length): Promise<ImportApplyResult | null> => {
    if (!(await checkBackend())) return null;
    const raw = await api.post<Record<string, unknown>>('/api/imports/allocations/apply', {
      fileName,
      rows,
      totalRows,
      clientErrors,
    });
    return {
      status: raw.status as ImportExportLog['status'],
      totalRows: Number(raw.totalRows ?? rows.length),
      validRows: Number(raw.validRows ?? 0),
      errorRows: Number(raw.errorRows ?? 0),
      errors: Array.isArray(raw.errors) ? raw.errors as ImportApplyError[] : [],
      log: raw.log && typeof raw.log === 'object' ? normalizeImportExportLog(raw.log as Record<string, unknown>) : undefined,
    };
  },
  applyTimesheetImport: async (fileName: string, rows: CsvImportRow[], clientErrors: ImportApplyError[] = [], totalRows = rows.length): Promise<ImportApplyResult | null> => {
    if (!(await checkBackend())) return null;
    const raw = await api.post<Record<string, unknown>>('/api/imports/timesheets/apply', {
      fileName,
      rows,
      totalRows,
      clientErrors,
    });
    return {
      status: raw.status as ImportExportLog['status'],
      totalRows: Number(raw.totalRows ?? rows.length),
      validRows: Number(raw.validRows ?? 0),
      errorRows: Number(raw.errorRows ?? 0),
      errors: Array.isArray(raw.errors) ? raw.errors as ImportApplyError[] : [],
      log: raw.log && typeof raw.log === 'object' ? normalizeImportExportLog(raw.log as Record<string, unknown>) : undefined,
    };
  },
  resetUserPassword: async (identifier: string, newPassword?: string): Promise<{ temporaryPassword?: string; mustChangePassword: boolean } | null> => {
    if (await checkBackend()) {
      const raw = await api.post<Record<string, unknown>>(`/api/users/${encodeURIComponent(identifier)}/password-reset`, {
        newPassword,
        mustChangePassword: true,
      });
      return {
        temporaryPassword: raw.temporaryPassword ? String(raw.temporaryPassword) : undefined,
        mustChangePassword: Boolean(raw.mustChangePassword),
      };
    }
    DataStorage.ensureUserAccounts();
    const accounts = DataStorage.get<UserAccount[]>(STORAGE_KEYS.USER_ACCOUNTS, []);
    const lookup = identifier.trim().toLowerCase();
    const index = accounts.findIndex(account =>
      account.id === identifier ||
      account.employeeRecordId === identifier ||
      account.userName.toLowerCase() === lookup ||
      account.employeeId.toLowerCase() === lookup ||
      account.email.toLowerCase() === lookup
    );
    if (index < 0) return null;
    const temporaryPassword = newPassword || generateTemporaryPassword();
    const nextHash = `sha256:${await sha256(temporaryPassword)}`;
    accounts[index] = { ...accounts[index], passwordHash: nextHash, mustChangePassword: true };
    DataStorage.set(STORAGE_KEYS.USER_ACCOUNTS, accounts);
    const u = actor();
    DataStorage.logAction(u.id, u.name, u.role, 'Reset Password', 'Admin', `Reset password for ${accounts[index].displayName}`, { entityType: 'User', entityId: accounts[index].id });
    return { temporaryPassword: newPassword ? undefined : temporaryPassword, mustChangePassword: true };
  },
  getSettings: async (): Promise<SystemSettings> => {
    if (await checkBackend()) {
      const raw = await api.get<Array<{ key: string; value: unknown }>>('/api/settings');
      return normalizeSettings(raw);
    }
    return DataStorage.get<SystemSettings>(STORAGE_KEYS.SETTINGS, {
      utilizationThresholdHigh: 100, utilizationThresholdLow: 80,
      benchThreshold: 20, expectedWeeklyHours: 40,
      timesheetPolicyMaxHours: 40, blockOverAllocation: false,
      demoSubmissionMode: false, currency: 'GBP',
    });
  },
  saveSettings: async (settings: SystemSettings): Promise<void> => {
    if (await checkBackend()) {
      await api.post('/api/settings', settings);
      return;
    }
    DataStorage.set(STORAGE_KEYS.SETTINGS, settings);
    DataStorage.recalculateUtilization();
  },
  getCountryDirectors: async (): Promise<CountryDirector[]> => {
    if (await checkBackend()) {
      const raw = await api.get<Record<string, unknown>[]>('/api/country-directors');
      return raw.map(normalizeCountryDirector);
    }
    return DataStorage.get<CountryDirector[]>(STORAGE_KEYS.CDS, []);
  },
  saveCountryDirector: async (director: CountryDirector): Promise<void> => {
    if (await checkBackend()) {
      await api.post('/api/country-directors', director);
      return;
    }
    const list = DataStorage.get<CountryDirector[]>(STORAGE_KEYS.CDS, []);
    const idx = list.findIndex(d => d.id === director.id);
    if (idx >= 0) list[idx] = director; else list.push(director);
    DataStorage.set(STORAGE_KEYS.CDS, list);
  },
  deleteCountryDirector: async (id: string): Promise<boolean> => {
    if (await checkBackend()) {
      await api.delete(`/api/country-directors/${id}`);
      return true;
    }
    const list = DataStorage.get<CountryDirector[]>(STORAGE_KEYS.CDS, []);
    DataStorage.set(STORAGE_KEYS.CDS, list.filter(d => d.id !== id));
    return true;
  },
  getRoleDefinitions: async (): Promise<RoleDefinition[]> => {
    if (await checkBackend()) {
      const raw = await api.get<Record<string, unknown>[]>('/api/role-definitions');
      return raw.map(normalizeRoleDefinition);
    }
    return DataStorage.get<RoleDefinition[]>(STORAGE_KEYS.ROLE_DEFINITIONS, []).filter(r => r.active !== false);
  },
  saveRoleDefinition: async (role: RoleDefinition): Promise<void> => {
    if (await checkBackend()) {
      await api.post('/api/role-definitions', { id: role.id, name: role.name, department: role.department, description: role.description, active: role.active });
      return;
    }
    const list = DataStorage.get<RoleDefinition[]>(STORAGE_KEYS.ROLE_DEFINITIONS, []);
    const idx = list.findIndex(r => r.id === role.id);
    if (idx >= 0) list[idx] = role; else list.push(role);
    DataStorage.set(STORAGE_KEYS.ROLE_DEFINITIONS, list);
  },
  deleteRoleDefinition: async (id: string): Promise<boolean> => {
    if (await checkBackend()) {
      await api.delete(`/api/role-definitions/${id}`);
      return true;
    }
    const list = DataStorage.get<RoleDefinition[]>(STORAGE_KEYS.ROLE_DEFINITIONS, []);
    DataStorage.set(STORAGE_KEYS.ROLE_DEFINITIONS, list.map(r => r.id === id ? { ...r, active: false } : r));
    return true;
  },
  getDepartments: async (): Promise<CatalogItem[]> => {
    if (await checkBackend()) {
      const raw = await api.get<Record<string, unknown>[]>('/api/catalogs/departments');
      return raw.map(normalizeCatalogItem);
    }
    return DataStorage.get<CatalogItem[]>(STORAGE_KEYS.DEPARTMENT_CATALOG, []).filter(i => i.active !== false);
  },
  saveDepartment: async (item: CatalogItem): Promise<void> => {
    if (await checkBackend()) { await api.post('/api/catalogs/departments', { id: item.id, name: item.name, active: item.active }); return; }
    const list = DataStorage.get<CatalogItem[]>(STORAGE_KEYS.DEPARTMENT_CATALOG, []);
    const idx = list.findIndex(d => d.id === item.id);
    if (idx >= 0) list[idx] = item; else list.push(item);
    DataStorage.set(STORAGE_KEYS.DEPARTMENT_CATALOG, list);
  },
  deleteDepartment: async (id: string): Promise<boolean> => {
    if (await checkBackend()) { await api.delete(`/api/catalogs/departments/${id}`); return true; }
    const list = DataStorage.get<CatalogItem[]>(STORAGE_KEYS.DEPARTMENT_CATALOG, []);
    const item = list.find(d => d.id === id);
    if (!item) return false;
    const empsUsing = DataStorage.get<Employee[]>(STORAGE_KEYS.EMPLOYEES, []).filter(e => e.department === item.name);
    if (empsUsing.length > 0) return false;
    DataStorage.set(STORAGE_KEYS.DEPARTMENT_CATALOG, list.map(d => d.id === id ? { ...d, active: false } : d));
    return true;
  },
  getCountries: async (): Promise<CatalogItem[]> => {
    if (await checkBackend()) {
      const raw = await api.get<Record<string, unknown>[]>('/api/catalogs/countries');
      return raw.map(normalizeCatalogItem);
    }
    return DataStorage.get<CatalogItem[]>(STORAGE_KEYS.COUNTRY_CATALOG, []).filter(i => i.active !== false);
  },
  saveCountry: async (item: CatalogItem): Promise<void> => {
    if (await checkBackend()) { await api.post('/api/catalogs/countries', { id: item.id, name: item.name, active: item.active }); return; }
    const list = DataStorage.get<CatalogItem[]>(STORAGE_KEYS.COUNTRY_CATALOG, []);
    const idx = list.findIndex(c => c.id === item.id);
    if (idx >= 0) list[idx] = item; else list.push(item);
    DataStorage.set(STORAGE_KEYS.COUNTRY_CATALOG, list);
  },
  deleteCountry: async (id: string): Promise<boolean> => {
    if (await checkBackend()) { await api.delete(`/api/catalogs/countries/${id}`); return true; }
    const list = DataStorage.get<CatalogItem[]>(STORAGE_KEYS.COUNTRY_CATALOG, []);
    const item = list.find(c => c.id === id);
    if (!item) return false;
    const used = DataStorage.get<Employee[]>(STORAGE_KEYS.EMPLOYEES, []).filter(e => e.country === item.name);
    if (used.length > 0) return false;
    DataStorage.set(STORAGE_KEYS.COUNTRY_CATALOG, list.map(c => c.id === id ? { ...c, active: false } : c));
    return true;
  },
  getIndustries: async (): Promise<CatalogItem[]> => {
    if (await checkBackend()) {
      const raw = await api.get<Record<string, unknown>[]>('/api/catalogs/industries');
      return raw.map(normalizeCatalogItem);
    }
    return DataStorage.get<CatalogItem[]>(STORAGE_KEYS.INDUSTRY_CATALOG, []).filter(i => i.active !== false);
  },
  saveIndustry: async (item: CatalogItem): Promise<void> => {
    if (await checkBackend()) { await api.post('/api/catalogs/industries', { id: item.id, name: item.name, active: item.active }); return; }
    const list = DataStorage.get<CatalogItem[]>(STORAGE_KEYS.INDUSTRY_CATALOG, []);
    const idx = list.findIndex(i => i.id === item.id);
    if (idx >= 0) list[idx] = item; else list.push(item);
    DataStorage.set(STORAGE_KEYS.INDUSTRY_CATALOG, list);
  },
  deleteIndustry: async (id: string): Promise<boolean> => {
    if (await checkBackend()) { await api.delete(`/api/catalogs/industries/${id}`); return true; }
    const list = DataStorage.get<CatalogItem[]>(STORAGE_KEYS.INDUSTRY_CATALOG, []);
    const item = list.find(i => i.id === id);
    if (!item) return false;
    const used = DataStorage.get<Client[]>(STORAGE_KEYS.CLIENTS, []).filter(c => c.industry === item.name);
    if (used.length > 0) return false;
    DataStorage.set(STORAGE_KEYS.INDUSTRY_CATALOG, list.map(i => i.id === id ? { ...i, active: false } : i));
    return true;
  },
  resetDemoData: () => { DataStorage.resetDemoData(); },
  logAction: async (action: string, module: string, details: string): Promise<void> => {
    if (await checkBackend()) {
      await api.post('/api/audit-events', {
        action,
        module,
        details,
      }).catch(() => {});
      return;
    }
    const s = authService.getCurrentUser();
    DataStorage.logAction(s?.id || 'sys', s?.name || 'System', s?.role || 'Admin', action, module, details);
  },
  getDataQualityReport: async (): Promise<DataQualityReport> => {
    if (await checkBackend()) {
      return normalizeDataQualityReport(await api.get<Record<string, unknown>>('/api/reports/data-quality'));
    }
    return buildLocalDataQualityReport();
  },
};

const buildLocalDataQualityReport = async (): Promise<DataQualityReport> => {
  const [employees, projects, allocations] = await Promise.all([
    employeeService.getAll(),
    projectService.getAll(),
    allocationService.getAll(),
  ]);
  const projectsById = new Map(projects.map(project => [project.id, project]));
  const issues = [
    ...employees
      .filter(employee => employee.status === 'Active' && !employee.reportingManagerId)
      .map(employee => ({
        entityType: 'Employee',
        entityId: employee.id,
        entity: employee.name,
        issueType: 'Missing reporting manager',
        owner: employee.email || employee.employeeId,
        impact: 'Approval routing and team views may be unreliable.',
        suggestedAction: 'Assign a reporting manager in Employee Master.',
      })),
    ...employees
      .filter(employee => employee.status === 'Active' && (!employee.standardWeeklyHours || !employee.capacityType || !employee.contractType))
      .map(employee => ({
        entityType: 'Employee',
        entityId: employee.id,
        entity: employee.name,
        issueType: 'Missing capacity profile',
        owner: employee.email || employee.employeeId,
        impact: 'Availability and utilization handover checks cannot be fully trusted.',
        suggestedAction: 'Set standard weekly hours, capacity type, and contract type.',
      })),
    ...employees
      .filter(employee => employee.status === 'Active' && !employee.teamsUserId)
      .map(employee => ({
        entityType: 'Employee',
        entityId: employee.id,
        entity: employee.name,
        issueType: 'Missing Teams identity link',
        owner: employee.email || employee.employeeId,
        impact: 'Future Teams approvals and reminders cannot target this user.',
        suggestedAction: 'Capture the Teams user link during identity onboarding.',
      })),
    ...employees
      .filter(employee => employee.email.endsWith('.demo') || employee.email.includes('@boundaryless.demo'))
      .map(employee => ({
        entityType: 'Employee',
        entityId: employee.id,
        entity: employee.name,
        issueType: 'Demo data remnant',
        owner: employee.email || employee.employeeId,
        impact: 'Production handover may still contain seeded demo records.',
        suggestedAction: 'Replace demo user and employee records with company-owned data.',
      })),
    ...allocations
      .filter(allocation => {
        const project = projectsById.get(allocation.projectId);
        return project && (allocation.startDate < project.startDate || allocation.endDate > project.endDate);
      })
      .map(allocation => ({
        entityType: 'Allocation',
        entityId: allocation.id,
        entity: allocation.projectName,
        issueType: 'Allocation outside project timeline',
        owner: allocation.employeeId,
        impact: 'Planned and forecast utilization can be incorrect for this assignment.',
        suggestedAction: 'Adjust allocation dates to fit within the project start and end dates.',
      })),
  ];
  const byType = issues.reduce<Record<string, number>>((acc, issue) => {
    acc[issue.issueType] = (acc[issue.issueType] || 0) + 1;
    return acc;
  }, {});
  const denominator = Math.max(employees.length * 4, 1);
  return {
    score: Math.max(0, Math.round(((denominator - issues.length) / denominator) * 100)),
    totalRecords: employees.length,
    issueCount: issues.length,
    byType,
    issues,
    generatedAt: new Date().toISOString(),
  };
};

const buildLocalUtilizationReport = async (mode: UtilizationReportMode, months = 3): Promise<UtilizationReport> => {
  const [employees, allocations, projects, timesheets, settings] = await Promise.all([
    employeeService.getAll(),
    allocationService.getAll(),
    projectService.getAll(),
    timesheetService.getAll(),
    adminService.getSettings(),
  ]);
  const sourceDate = todayIso();
  const targetDate = new Date(`${sourceDate}T00:00:00`);
  if (mode === 'forecast') targetDate.setMonth(targetDate.getMonth() + months);
  const asOfDate = targetDate.toISOString().slice(0, 10);
  const includeProposed = mode === 'forecast';
  const rows = getUtilizationEligibleEmployees(employees, allocations, projects, asOfDate, includeProposed).map(employee => ({
    ...employee,
    plannedUtilization: getAllocationLoad(employee.id, allocations, projects, asOfDate, asOfDate, includeProposed),
    actualUtilization: getLatestApprovedActualUtilization(employee.id, timesheets, settings),
    activeProjectCount: getActiveAllocationsForEmployee(employee.id, allocations, projects, asOfDate, asOfDate, includeProposed).length,
  }));
  return {
    mode,
    asOfDate,
    sourceDate,
    forecastMonths: mode === 'forecast' ? months : null,
    expectedWeeklyHours: settings.expectedWeeklyHours,
    thresholds: {
      high: settings.utilizationThresholdHigh,
      low: settings.utilizationThresholdLow,
      bench: settings.benchThreshold,
    },
    summary: {
      rows: rows.length,
      averagePlanned: rows.length ? Number((rows.reduce((sum, row) => sum + row.plannedUtilization, 0) / rows.length).toFixed(1)) : 0,
      averageActual: rows.length ? Number((rows.reduce((sum, row) => sum + row.actualUtilization, 0) / rows.length).toFixed(1)) : 0,
      overloaded: rows.filter(row => row.plannedUtilization > settings.utilizationThresholdHigh).length,
      underutilized: rows.filter(row => row.plannedUtilization < settings.utilizationThresholdLow && row.plannedUtilization > settings.benchThreshold).length,
      bench: rows.filter(row => row.plannedUtilization <= settings.benchThreshold).length,
    },
    rows,
  };
};

const getBackendUtilizationReport = async (path: string): Promise<UtilizationReport | null> => {
  if (!(await checkBackend())) return null;
  const raw = await api.get<Record<string, unknown>>(path);
  return normalizeUtilizationReport(raw);
};

export const utilizationReportService = {
  getPlanned: async (): Promise<UtilizationReport> => {
    return (await getBackendUtilizationReport('/api/reports/planned-utilization'))
      ?? buildLocalUtilizationReport('planned');
  },
  getActual: async (): Promise<UtilizationReport> => {
    return (await getBackendUtilizationReport('/api/reports/actual-utilization'))
      ?? buildLocalUtilizationReport('actual');
  },
  getForecast: async (months = 3): Promise<UtilizationReport> => {
    return (await getBackendUtilizationReport(`/api/reports/forecast-utilization?months=${encodeURIComponent(String(months))}`))
      ?? buildLocalUtilizationReport('forecast', months);
  },
};

export const dashboardService = {
  getKPIData: async () => [],
  getReport: async (): Promise<DashboardReport | null> => {
    if (!(await checkBackend())) return null;
    return normalizeDashboardReport(await api.get<Record<string, unknown>>('/api/reports/dashboard'));
  },
};
