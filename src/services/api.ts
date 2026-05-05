/**
 * api.ts — Dual-mode service layer.
 * AUTO-DETECTS backend: if /api/health returns database:connected → uses REST API.
 * Otherwise → falls back to localStorage (demo mode). Zero code change needed to switch.
 */
import type { Employee, Project, Allocation, TimesheetSummary, AuditLog, ImportExportLog, SystemSettings, CountryDirector, RoleDefinition, Client, CatalogItem } from '../types';
import { DataStorage, STORAGE_KEYS } from './storage';
import { authService } from './authService';
import {
  api, checkBackend,
  normalizeEmployee, normalizeProject, normalizeAllocation,
  normalizeClient, normalizeTimesheetSummary, normalizeAuditLog,
  normalizeSettings, normalizeCatalogItem, normalizeRoleDefinition,
  normalizeCountryDirector,
} from './apiClient';
import { getAllocationLoad, getLatestApprovedActualUtilization, getActiveAllocationsForEmployee } from './calculations';

const todayIso = () => new Date().toISOString().split('T')[0];

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
        primary_country_director_id: emp.primaryCountryDirectorId,
        status: emp.status,
      });
      return;
    }
    // localStorage mode
    const list = DataStorage.get<Employee[]>(STORAGE_KEYS.EMPLOYEES, []);
    const idx = list.findIndex(e => e.id === emp.id);
    if (idx >= 0) list[idx] = emp; else list.push(emp);
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
    if (idx >= 0) list[idx] = client; else list.push(client);
    DataStorage.set(STORAGE_KEYS.CLIENTS, list);
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
    if (await checkBackend()) {
      await api.post('/api/timesheets', {
        employee_id: ts.employeeId,
        week_ending: ts.weekEnding,
        status: ts.status,
        rejection_reason: ts.rejectionReason || null,
        entries: ts.entries.map(e => ({
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
    const next = { ...ts, updatedAt: new Date().toISOString() };
    if (idx >= 0) list[idx] = next; else list.push(next);
    DataStorage.set(STORAGE_KEYS.TIMESHEETS, list);
    DataStorage.recalculateUtilization();
  },
  approve: async (timesheetId: string, _reason?: string): Promise<void> => {
    if (await checkBackend()) {
      await api.patch(`/api/timesheets/${timesheetId}/status`, { status: 'Approved' });
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
      await api.patch(`/api/timesheets/${timesheetId}/status`, { status: 'Rejected', reason });
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
export const adminService = {
  getAuditLogs: async (): Promise<AuditLog[]> => {
    if (await checkBackend()) {
      const raw = await api.get<Record<string, unknown>[]>('/api/audit-logs');
      return raw.map(normalizeAuditLog);
    }
    return DataStorage.get<AuditLog[]>(STORAGE_KEYS.AUDIT_LOGS, []);
  },
  getImportExportLogs: async (): Promise<ImportExportLog[]> => {
    return DataStorage.get<ImportExportLog[]>(STORAGE_KEYS.IMPORT_EXPORT_LOGS, []);
  },
  saveImportExportLog: async (log: Omit<ImportExportLog, 'id' | 'timestamp' | 'userName'> & Partial<Pick<ImportExportLog, 'id' | 'timestamp' | 'userName'>>): Promise<ImportExportLog> => {
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
    if (await checkBackend()) return; // backend auto-audits mutations
    const s = authService.getCurrentUser();
    DataStorage.logAction(s?.id || 'sys', s?.name || 'System', s?.role || 'Admin', action, module, details);
  },
};

export const dashboardService = { getKPIData: async () => [] };
