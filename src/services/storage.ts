import { 
  Employee, 
  Project, 
  Allocation, 
  TimesheetSummary, 
  TimesheetEntry, 
  AuditLog, 
  ImportExportLog,
  Client,
  CatalogItem,
  SystemSettings, 
  UserSession,
  CountryDirector,
  UserAccount,
  UserRole,
  LeaveType,
  LeavePolicy,
  HolidayCalendar,
  LeaveBalance,
  LeaveRequest,
  ApprovalRecord,
  ApprovalDelegation
} from '../types';
import { getActiveAllocationsForEmployee, getAllocationLoad, getLatestApprovedActualUtilization, overlapsDateRange } from './calculations';
import {
  createDefaultCatalog,
  DEFAULT_COUNTRIES,
  DEFAULT_DEPARTMENTS,
  DEFAULT_INDUSTRIES,
  DEFAULT_ROLE_DEFINITIONS,
  DEMO_DATA_VERSION,
  generateDemoDataset
} from './demoData';

const STORAGE_KEYS = {
  EMPLOYEES: 'rt_employees',
  PROJECTS: 'rt_projects',
  CLIENTS: 'rt_clients',
  ALLOCATIONS: 'rt_allocations',
  TIMESHEETS: 'rt_timesheets',
  AUDIT_LOGS: 'rt_audit_logs',
  IMPORT_EXPORT_LOGS: 'rt_import_export_logs',
  SETTINGS: 'rt_settings',
  AUTH: 'rt_auth',
  CDS: 'rt_cds',
  USER_ACCOUNTS: 'rt_user_accounts',
  ROLE_DEFINITIONS: 'rt_role_definitions',
  DEPARTMENT_CATALOG: 'rt_department_catalog',
  COUNTRY_CATALOG: 'rt_country_catalog',
  INDUSTRY_CATALOG: 'rt_industry_catalog',
  LEAVE_TYPES: 'bw_leave_types',
  LEAVE_POLICIES: 'bw_leave_policies',
  HOLIDAY_CALENDARS: 'bw_holiday_calendars',
  LEAVE_BALANCES: 'bw_leave_balances',
  LEAVE_REQUESTS: 'bw_leave_requests',
  APPROVAL_RECORDS: 'bw_approval_records',
  APPROVAL_DELEGATIONS: 'bw_approval_delegations',
  DEMO_DATA_VERSION: 'rt_demo_data_version'
};

// Seed Data Helpers
const SEED_CDS = [
  { id: 'cd-1', name: 'Mark Stevens', region: 'EMEA' },
  { id: 'cd-2', name: 'Elena Rodriguez', region: 'LATAM' },
  { id: 'cd-3', name: 'Sarah Lane', region: 'APAC' },
  { id: 'cd-4', name: 'David Hoffman', region: 'NA' },
  { id: 'cd-5', name: 'Rajesh Gupta', region: 'South Asia' },
  { id: 'cd-6', name: 'Abebe Bikila', region: 'Africa' },
];

const SEED_PMS = [
  { id: 'pm-1', name: 'Thomas Wright' },
  { id: 'pm-2', name: 'Linda Chen' },
  { id: 'pm-3', name: 'Kevin Durant' },
  { id: 'pm-4', name: 'James Harden' },
  { id: 'pm-5', name: 'Kyrie Irving' },
  { id: 'pm-6', name: 'Chris Paul' },
];

const SEED_PROJECTS: Project[] = [
  { id: 'p-1', projectCode: 'C200', name: 'Strategy Audit', client: 'Acme Corp', managerId: 'pm-1', managerName: 'Thomas Wright', startDate: '2026-01-01', endDate: '2026-12-31', status: 'Active', billable: true, plannedUtilization: 0, actualUtilization: 0, resourceCount: 0 },
  { id: 'p-2', projectCode: 'D350', name: 'Cloud Migration', client: 'TechFlow', managerId: 'pm-2', managerName: 'Linda Chen', startDate: '2026-02-15', endDate: '2026-08-30', status: 'Active', billable: true, plannedUtilization: 0, actualUtilization: 0, resourceCount: 0 },
  { id: 'p-3', projectCode: 'A100', name: 'Internal Ops Automation', client: 'Internal', managerId: 'pm-3', managerName: 'Kevin Durant', startDate: '2026-01-10', endDate: '2026-06-30', status: 'Active', billable: false, plannedUtilization: 0, actualUtilization: 0, resourceCount: 0 },
  { id: 'p-4', projectCode: 'E500', name: 'Global ERP Rollout', client: 'GlobalLogistics', managerId: 'pm-4', managerName: 'James Harden', startDate: '2026-03-01', endDate: '2027-03-01', status: 'Proposed', billable: true, plannedUtilization: 0, actualUtilization: 0, resourceCount: 0 },
  { id: 'p-5', projectCode: 'B400', name: 'Cybersecurity Vetting', client: 'SwiftBank', managerId: 'pm-5', managerName: 'Kyrie Irving', startDate: '2026-04-01', endDate: '2026-05-30', status: 'Active', billable: true, plannedUtilization: 0, actualUtilization: 0, resourceCount: 0 },
  { id: 'p-6', projectCode: 'F600', name: 'Data Lake Setup', client: 'DataPoint', managerId: 'pm-6', managerName: 'Chris Paul', startDate: '2026-05-01', endDate: '2026-11-01', status: 'Proposed', billable: true, plannedUtilization: 0, actualUtilization: 0, resourceCount: 0 },
  { id: 'p-7', projectCode: 'G700', name: 'Mobile App Refresh', client: 'RetailPlus', managerId: 'pm-1', managerName: 'Thomas Wright', startDate: '2026-01-15', endDate: '2026-04-15', status: 'Completed', billable: true, plannedUtilization: 0, actualUtilization: 0, resourceCount: 0 },
  { id: 'p-8', projectCode: 'H800', name: 'Compliance Audit', client: 'ReguTech', managerId: 'pm-2', managerName: 'Linda Chen', startDate: '2026-04-15', endDate: '2026-07-15', status: 'Active', billable: true, plannedUtilization: 0, actualUtilization: 0, resourceCount: 0 },
  { id: 'p-9', projectCode: 'I900', name: 'Salesforce Integration', client: 'MegaSales', managerId: 'pm-3', managerName: 'Kevin Durant', startDate: '2026-02-01', endDate: '2026-06-01', status: 'On Hold', billable: true, plannedUtilization: 0, actualUtilization: 0, resourceCount: 0 },
  { id: 'p-10', projectCode: 'J1000', name: 'Brand Realignment', client: 'LuxBrand', managerId: 'pm-4', managerName: 'James Harden', startDate: '2026-03-15', endDate: '2026-09-15', status: 'Active', billable: true, plannedUtilization: 0, actualUtilization: 0, resourceCount: 0 },
];

const SEED_EMPLOYEES: Employee[] = [
  { id: 'e-1', employeeId: 'BL-001', name: 'Admin User', email: 'admin@boundaryless.com', designation: 'General Manager', department: 'Management', country: 'United Kingdom', primaryCountryDirectorId: 'cd-1', mappedCountryDirectorIds: ['cd-1'], status: 'Active', plannedUtilization: 0, actualUtilization: 0, activeProjectCount: 0 },
  { id: 'e-2', employeeId: 'BL-002', name: 'HR Manager', email: 'hr@boundaryless.com', designation: 'HR Lead', department: 'Human Resources', country: 'United Kingdom', primaryCountryDirectorId: 'cd-1', mappedCountryDirectorIds: ['cd-1'], status: 'Active', plannedUtilization: 0, actualUtilization: 0, activeProjectCount: 0 },
  { id: 'e-3', employeeId: 'BL-101', name: 'Michael Chen', email: 'm.chen@boundaryless.com', designation: 'Senior Consultant', department: 'Digital Transformation', country: 'Singapore', primaryCountryDirectorId: 'cd-3', mappedCountryDirectorIds: ['cd-3', 'cd-5'], status: 'Active', plannedUtilization: 0, actualUtilization: 0, activeProjectCount: 0 },
  { id: 'e-4', employeeId: 'BL-102', name: 'Sarah Anderson', email: 's.anderson@boundaryless.com', designation: 'Team Lead', department: 'Cloud Solutions', country: 'USA', primaryCountryDirectorId: 'cd-4', mappedCountryDirectorIds: ['cd-4'], status: 'Active', plannedUtilization: 0, actualUtilization: 0, activeProjectCount: 0 },
  { id: 'e-5', employeeId: 'BL-103', name: 'David Kim', email: 'd.kim@boundaryless.com', designation: 'Software Engineer', department: 'Software Engineering', country: 'South Korea', primaryCountryDirectorId: 'cd-3', mappedCountryDirectorIds: ['cd-3'], status: 'Active', plannedUtilization: 0, actualUtilization: 0, activeProjectCount: 0 },
  { id: 'e-6', employeeId: 'BL-104', name: 'Elena Rodriguez', email: 'e.rodriguez@boundaryless.com', designation: 'Consultant', department: 'Strategy', country: 'Spain', primaryCountryDirectorId: 'cd-1', mappedCountryDirectorIds: ['cd-1', 'cd-2'], status: 'Active', plannedUtilization: 0, actualUtilization: 0, activeProjectCount: 0 },
  { id: 'e-7', employeeId: 'BL-105', name: 'Amara Okafor', email: 'a.okafor@boundaryless.com', designation: 'Project Manager', department: 'Project Management', country: 'Nigeria', primaryCountryDirectorId: 'cd-6', mappedCountryDirectorIds: ['cd-6'], status: 'Active', plannedUtilization: 0, actualUtilization: 0, activeProjectCount: 0 },
  { id: 'e-8', employeeId: 'BL-106', name: 'Mark Stevens', email: 'm.stevens@boundaryless.com', designation: 'Director', department: 'Commercial', country: 'United Kingdom', primaryCountryDirectorId: 'cd-1', mappedCountryDirectorIds: ['cd-1'], status: 'Active', plannedUtilization: 0, actualUtilization: 0, activeProjectCount: 0 },
  { id: 'e-9', employeeId: 'BL-107', name: 'Hiroshi Tanaka', email: 'h.tanaka@boundaryless.com', designation: 'Architect', department: 'Cloud Solutions', country: 'Japan', primaryCountryDirectorId: 'cd-3', mappedCountryDirectorIds: ['cd-3'], status: 'Active', plannedUtilization: 0, actualUtilization: 0, activeProjectCount: 0 },
  { id: 'e-10', employeeId: 'BL-108', name: 'Sophie Martin', email: 's.martin@boundaryless.com', designation: 'UX Designer', department: 'Design & Innovation', country: 'France', primaryCountryDirectorId: 'cd-1', mappedCountryDirectorIds: ['cd-1'], status: 'On Leave', plannedUtilization: 0, actualUtilization: 0, activeProjectCount: 0 },
  { id: 'pm-1', employeeId: 'PM-001', name: 'Thomas Wright', email: 't.wright@boundaryless.com', designation: 'Project Manager', department: 'Project Management', country: 'United Kingdom', primaryCountryDirectorId: 'cd-1', mappedCountryDirectorIds: ['cd-1'], status: 'Active', plannedUtilization: 0, actualUtilization: 0, activeProjectCount: 0 },
  { id: 'pm-2', employeeId: 'PM-002', name: 'Linda Chen', email: 'l.chen@boundaryless.com', designation: 'Project Manager', department: 'Project Management', country: 'Singapore', primaryCountryDirectorId: 'cd-3', mappedCountryDirectorIds: ['cd-3'], status: 'Active', plannedUtilization: 0, actualUtilization: 0, activeProjectCount: 0 },
  { id: 'pm-3', employeeId: 'PM-003', name: 'Kevin Durant', email: 'k.durant@boundaryless.com', designation: 'Project Manager', department: 'Project Management', country: 'USA', primaryCountryDirectorId: 'cd-4', mappedCountryDirectorIds: ['cd-4'], status: 'Active', plannedUtilization: 0, actualUtilization: 0, activeProjectCount: 0 },
  // Adding more to reach ~30
];

// Fill more employees programmatically for scale
const depts = ['Digital Transformation', 'Cloud Solutions', 'Software Engineering', 'Strategy', 'Design & Innovation'];
const countries = ['United Kingdom', 'USA', 'Singapore', 'Spain', 'France', 'Nigeria', 'India', 'Germany', 'Australia'];
const firstNames = ['John', 'Jane', 'Robert', 'Mary', 'William', 'Patricia', 'Richard', 'Jennifer', 'Joseph', 'Elizabeth', 'Thomas', 'Linda', 'Charles', 'Barbara', 'Christopher', 'Susan', 'Daniel', 'Margaret', 'Matthew', 'Dorothy', 'Anthony', 'Lisa', 'Mark', 'Nancy', 'Donald', 'Karen', 'Steven', 'Betty', 'Paul', 'Helen', 'Andrew', 'Sandra', 'Joshua', 'Donna', 'Kenneth', 'Carol'];
const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott'];

while (false && SEED_EMPLOYEES.length < 35) {
  const fName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const lName = lastNames[Math.floor(Math.random() * lastNames.length)];
  const name = `${fName} ${lName}`;
  const id = `e-${SEED_EMPLOYEES.length + 1}`;
  const empId = `BL-${100 + SEED_EMPLOYEES.length}`;
  const dept = depts[Math.floor(Math.random() * depts.length)];
  const country = countries[Math.floor(Math.random() * countries.length)];
  const cd = SEED_CDS[Math.floor(Math.random() * SEED_CDS.length)];
  
  SEED_EMPLOYEES.push({
    id,
    employeeId: empId,
    name,
    email: `${fName.toLowerCase()}.${lName.toLowerCase()}@boundaryless.com`,
    designation: 'Consultant',
    department: dept,
    country,
    primaryCountryDirectorId: cd.id,
    mappedCountryDirectorIds: [cd.id],
    status: 'Active',
    plannedUtilization: 0,
    actualUtilization: 0,
    activeProjectCount: 0
  });
}

const defaultSettings: SystemSettings = {
  utilizationThresholdHigh: 100,
  utilizationThresholdLow: 80,
  timesheetPolicyMaxHours: 40,
  expectedWeeklyHours: 40,
  benchThreshold: 20,
  blockOverAllocation: false,
  demoSubmissionMode: false,
  currency: 'GBP'
};

const defaultLeaveTypes: LeaveType[] = [
  { id: 'leave-type-annual', code: 'ANNUAL', name: 'Annual Leave', paid: true, requiresApproval: true, active: true },
  { id: 'leave-type-sick', code: 'SICK', name: 'Sick Leave', paid: true, requiresApproval: true, active: true },
  { id: 'leave-type-unpaid', code: 'UNPAID', name: 'Unpaid Leave', paid: false, requiresApproval: true, active: true },
];

const defaultLeavePolicies: LeavePolicy[] = [
  {
    id: 'leave-policy-global',
    name: 'Global Standard Leave Policy',
    country: 'Global',
    annualAllowanceDays: 24,
    carryForwardDays: 5,
    accrualMethod: 'Annual',
    status: 'Active',
    leaveTypeIds: defaultLeaveTypes.map(type => type.id),
  },
];

const buildDefaultHolidayCalendars = (): HolidayCalendar[] => {
  const year = new Date().getFullYear();
  return [
    {
      id: `holiday-global-${year}`,
      name: `Global Company Calendar ${year}`,
      country: 'Global',
      year,
      status: 'Active',
      holidays: [
        { id: `holiday-global-${year}-new-year`, calendarId: `holiday-global-${year}`, name: 'New Year Holiday', date: `${year}-01-01`, type: 'Company' },
        { id: `holiday-global-${year}-year-end`, calendarId: `holiday-global-${year}`, name: 'Year End Holiday', date: `${year}-12-25`, type: 'Company' },
      ],
    },
  ];
};

const buildDefaultLeaveBalances = (employees: Employee[]): LeaveBalance[] => {
  const year = new Date().getFullYear();
  return employees
    .filter(employee => employee.status !== 'Exited')
    .map(employee => ({
      id: `leave-balance-${employee.id}-${year}`,
      employeeId: employee.id,
      employeeName: employee.name,
      leaveTypeId: 'leave-type-annual',
      leaveTypeName: 'Annual Leave',
      policyId: 'leave-policy-global',
      year,
      openingDays: 0,
      accruedDays: 24,
      usedDays: 0,
      adjustedDays: 0,
      pendingDays: 0,
      availableDays: 24,
    }));
};

const todayIso = () => new Date().toISOString().split('T')[0];
const DEMO_PASSWORD_HASH = 'sha256:d3ad9315b7be5dd53b31a273b3b3aba5defe700808305aa16a3062b76658a791';

const rolesForEmployee = (employee: Employee): UserRole[] => {
  if (employee.employeeId === 'ADMIN-1') return ['Admin'];
  if (employee.employeeId === 'HR-1') return ['HR'];
  if (employee.employeeId.startsWith('CD-')) return ['CountryDirector'];
  if (employee.employeeId.startsWith('PM-')) return ['ProjectManager', 'Employee'];
  return ['Employee'];
};

const usernameForEmployee = (employee: Employee) => employee.employeeId.toLowerCase();

const buildAccountForEmployee = (employee: Employee): UserAccount => {
  const roles = rolesForEmployee(employee);
  return {
    id: `u-${employee.id}`,
    userName: usernameForEmployee(employee),
    employeeRecordId: employee.id,
    employeeId: employee.employeeId,
    email: employee.email,
    displayName: employee.name,
    passwordHash: DEMO_PASSWORD_HASH,
    roles,
    primaryRole: roles[0],
    status: employee.status === 'Exited' ? 'Disabled' : 'Active',
  };
};

export const isActiveOnDate = (startDate: string, endDate: string, date = todayIso()) => {
  return overlapsDateRange(startDate, endDate, date, date);
};

// Storage abstraction
export class DataStorage {
  static get<T>(key: string, defaultValue: T): T {
    const data = localStorage.getItem(key);
    if (!data) return defaultValue;
    try {
      return JSON.parse(data);
    } catch {
      return defaultValue;
    }
  }

  static set<T>(key: string, value: T): void {
    localStorage.setItem(key, JSON.stringify(value));
  }

  static initialize() {
    if (this.get<string>(STORAGE_KEYS.DEMO_DATA_VERSION, '') !== DEMO_DATA_VERSION) {
      this.resetDemoData();
      return;
    }

    if (!localStorage.getItem(STORAGE_KEYS.CDS)) {
      this.set(STORAGE_KEYS.CDS, generateDemoDataset().countryDirectors);
    }
    if (!localStorage.getItem(STORAGE_KEYS.CLIENTS)) {
      this.set(STORAGE_KEYS.CLIENTS, generateDemoDataset().clients);
    }
    if (!localStorage.getItem(STORAGE_KEYS.PROJECTS)) {
      this.set(STORAGE_KEYS.PROJECTS, generateDemoDataset().projects);
    } else {
      this.ensureClientMaster();
    }
    if (!localStorage.getItem(STORAGE_KEYS.EMPLOYEES)) {
      this.set(STORAGE_KEYS.EMPLOYEES, generateDemoDataset().employees);
    } else {
      this.ensureSeedEmployees();
    }
    if (!localStorage.getItem(STORAGE_KEYS.ROLE_DEFINITIONS)) {
      this.set(STORAGE_KEYS.ROLE_DEFINITIONS, DEFAULT_ROLE_DEFINITIONS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.DEPARTMENT_CATALOG)) {
      this.set<CatalogItem[]>(STORAGE_KEYS.DEPARTMENT_CATALOG, createDefaultCatalog('department', DEFAULT_DEPARTMENTS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.COUNTRY_CATALOG)) {
      this.set<CatalogItem[]>(STORAGE_KEYS.COUNTRY_CATALOG, createDefaultCatalog('country', DEFAULT_COUNTRIES));
    }
    if (!localStorage.getItem(STORAGE_KEYS.INDUSTRY_CATALOG)) {
      this.set<CatalogItem[]>(STORAGE_KEYS.INDUSTRY_CATALOG, createDefaultCatalog('industry', DEFAULT_INDUSTRIES));
    }
    if (!localStorage.getItem(STORAGE_KEYS.SETTINGS)) {
      this.set(STORAGE_KEYS.SETTINGS, defaultSettings);
    } else {
      this.set(STORAGE_KEYS.SETTINGS, { ...defaultSettings, ...this.get<SystemSettings>(STORAGE_KEYS.SETTINGS, defaultSettings) });
    }
    if (!localStorage.getItem(STORAGE_KEYS.ALLOCATIONS)) {
      this.set(STORAGE_KEYS.ALLOCATIONS, generateDemoDataset().allocations);
      this.recalculateUtilization();
    }
    if (!localStorage.getItem(STORAGE_KEYS.TIMESHEETS)) {
      this.set(STORAGE_KEYS.TIMESHEETS, generateDemoDataset().timesheets);
    }
    if (!localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS)) {
      this.set(STORAGE_KEYS.AUDIT_LOGS, generateDemoDataset().auditLogs);
    }
    if (!localStorage.getItem(STORAGE_KEYS.IMPORT_EXPORT_LOGS)) {
      this.set<ImportExportLog[]>(STORAGE_KEYS.IMPORT_EXPORT_LOGS, []);
    }
    this.ensureLeaveFoundation();
    this.ensureUserAccounts();
    this.recalculateUtilization();
  }

  static resetDemoData() {
    const dataset = generateDemoDataset();
    this.set(STORAGE_KEYS.CDS, dataset.countryDirectors);
    this.set(STORAGE_KEYS.CLIENTS, dataset.clients);
    this.set(STORAGE_KEYS.PROJECTS, dataset.projects);
    this.set(STORAGE_KEYS.EMPLOYEES, dataset.employees);
    this.set(STORAGE_KEYS.ALLOCATIONS, dataset.allocations);
    this.set(STORAGE_KEYS.TIMESHEETS, dataset.timesheets);
    this.set(STORAGE_KEYS.AUDIT_LOGS, dataset.auditLogs);
    this.set<ImportExportLog[]>(STORAGE_KEYS.IMPORT_EXPORT_LOGS, []);
    this.set(STORAGE_KEYS.ROLE_DEFINITIONS, dataset.roleDefinitions);
    this.set<CatalogItem[]>(STORAGE_KEYS.DEPARTMENT_CATALOG, createDefaultCatalog('department', DEFAULT_DEPARTMENTS));
    this.set<CatalogItem[]>(STORAGE_KEYS.COUNTRY_CATALOG, createDefaultCatalog('country', DEFAULT_COUNTRIES));
    this.set<CatalogItem[]>(STORAGE_KEYS.INDUSTRY_CATALOG, createDefaultCatalog('industry', DEFAULT_INDUSTRIES));
    this.set(STORAGE_KEYS.SETTINGS, defaultSettings);
    this.set(STORAGE_KEYS.LEAVE_TYPES, defaultLeaveTypes);
    this.set(STORAGE_KEYS.LEAVE_POLICIES, defaultLeavePolicies);
    this.set(STORAGE_KEYS.HOLIDAY_CALENDARS, buildDefaultHolidayCalendars());
    this.set(STORAGE_KEYS.LEAVE_BALANCES, buildDefaultLeaveBalances(dataset.employees));
    this.set<LeaveRequest[]>(STORAGE_KEYS.LEAVE_REQUESTS, []);
    this.set<ApprovalRecord[]>(STORAGE_KEYS.APPROVAL_RECORDS, []);
    this.set<ApprovalDelegation[]>(STORAGE_KEYS.APPROVAL_DELEGATIONS, []);
    localStorage.removeItem(STORAGE_KEYS.AUTH);
    localStorage.removeItem(STORAGE_KEYS.USER_ACCOUNTS);
    this.set(STORAGE_KEYS.DEMO_DATA_VERSION, DEMO_DATA_VERSION);
    this.ensureUserAccounts();
    this.recalculateUtilization();
  }

  static ensureSeedEmployees() {
    const employees = this.get<Employee[]>(STORAGE_KEYS.EMPLOYEES, []);
    const existingEmails = new Set(employees.map(e => e.email.toLowerCase()));
    const missing = generateDemoDataset().employees.filter(e => !existingEmails.has(e.email.toLowerCase()));
    if (missing.length > 0) {
      this.set(STORAGE_KEYS.EMPLOYEES, [...employees, ...missing]);
    }
  }

  static ensureLeaveFoundation() {
    const employees = this.get<Employee[]>(STORAGE_KEYS.EMPLOYEES, []);
    if (!localStorage.getItem(STORAGE_KEYS.LEAVE_TYPES)) {
      this.set(STORAGE_KEYS.LEAVE_TYPES, defaultLeaveTypes);
    }
    if (!localStorage.getItem(STORAGE_KEYS.LEAVE_POLICIES)) {
      this.set(STORAGE_KEYS.LEAVE_POLICIES, defaultLeavePolicies);
    }
    if (!localStorage.getItem(STORAGE_KEYS.HOLIDAY_CALENDARS)) {
      this.set(STORAGE_KEYS.HOLIDAY_CALENDARS, buildDefaultHolidayCalendars());
    }
    if (!localStorage.getItem(STORAGE_KEYS.LEAVE_BALANCES)) {
      this.set(STORAGE_KEYS.LEAVE_BALANCES, buildDefaultLeaveBalances(employees));
    }
    if (!localStorage.getItem(STORAGE_KEYS.LEAVE_REQUESTS)) {
      this.set<LeaveRequest[]>(STORAGE_KEYS.LEAVE_REQUESTS, []);
    }
    if (!localStorage.getItem(STORAGE_KEYS.APPROVAL_RECORDS)) {
      this.set<ApprovalRecord[]>(STORAGE_KEYS.APPROVAL_RECORDS, []);
    }
    if (!localStorage.getItem(STORAGE_KEYS.APPROVAL_DELEGATIONS)) {
      this.set<ApprovalDelegation[]>(STORAGE_KEYS.APPROVAL_DELEGATIONS, []);
    }
  }

  static ensureClientMaster() {
    const existingClients = this.get<Client[]>(STORAGE_KEYS.CLIENTS, []);
    const projects = this.get<Project[]>(STORAGE_KEYS.PROJECTS, []);
    const directors = this.get<CountryDirector[]>(STORAGE_KEYS.CDS, []);
    const now = new Date().toISOString();
    const clientsByName = new Map(existingClients.map(client => [client.name.toLowerCase(), client]));
    const clientsById = new Map(existingClients.map(client => [client.id, client]));
    const nextClients = [...existingClients];
    let changed = false;

    projects.forEach(project => {
      const normalizedName = project.client.trim();
      if (!normalizedName) return;
      if (project.clientId && clientsById.has(project.clientId)) return;

      const existing = clientsByName.get(normalizedName.toLowerCase());
      if (existing) {
        if (project.clientId !== existing.id) {
          project.clientId = existing.id;
          changed = true;
        }
        return;
      }

      const client: Client = {
        id: `client-${normalizedName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || Date.now()}`,
        name: normalizedName,
        industry: 'Unclassified',
        countryDirectorIds: directors[0] ? [directors[0].id] : [],
        status: 'Active',
        createdAt: now,
        updatedAt: now,
      };
      clientsByName.set(client.name.toLowerCase(), client);
      clientsById.set(client.id, client);
      nextClients.push(client);
      project.clientId = client.id;
      changed = true;
    });

    if (changed || existingClients.length === 0) {
      this.set(STORAGE_KEYS.CLIENTS, nextClients);
      this.set(STORAGE_KEYS.PROJECTS, projects);
    }
  }

  static ensureUserAccounts() {
    const employees = this.get<Employee[]>(STORAGE_KEYS.EMPLOYEES, []);
    const existing = this.get<UserAccount[]>(STORAGE_KEYS.USER_ACCOUNTS, []);
    const existingByEmployeeRecord = new Map(existing.map(account => [account.employeeRecordId, account]));
    const next = employees.map(employee => {
      const generated = buildAccountForEmployee(employee);
      const current = existingByEmployeeRecord.get(employee.id);
      return {
        ...generated,
        ...current,
        email: employee.email,
        displayName: employee.name,
        employeeId: employee.employeeId,
        roles: generated.roles,
        primaryRole: current?.primaryRole && generated.roles.includes(current.primaryRole) ? current.primaryRole : generated.primaryRole,
        status: employee.status === 'Exited' ? 'Disabled' as const : current?.status || generated.status,
      };
    });
    this.set(STORAGE_KEYS.USER_ACCOUNTS, next);
    this.ensureClientMaster();
  }

  static recalculateUtilization() {
    const allocations = this.get<Allocation[]>(STORAGE_KEYS.ALLOCATIONS, []);
    const employees = this.get<Employee[]>(STORAGE_KEYS.EMPLOYEES, []);
    const projects = this.get<Project[]>(STORAGE_KEYS.PROJECTS, []);
    const timesheets = this.get<TimesheetSummary[]>(STORAGE_KEYS.TIMESHEETS, []);
    const settings = this.get<SystemSettings>(STORAGE_KEYS.SETTINGS, defaultSettings);
    const currentDate = todayIso();

    const updatedEmployees = employees.map(emp => {
      const empAlloc = getActiveAllocationsForEmployee(emp.id, allocations, projects, currentDate, currentDate);
      const plannedUtil = getAllocationLoad(emp.id, allocations, projects, currentDate, currentDate);
      const actualUtil = getLatestApprovedActualUtilization(emp.id, timesheets, settings);

      return {
        ...emp,
        plannedUtilization: plannedUtil,
        actualUtilization: actualUtil,
        activeProjectCount: empAlloc.length
      };
    });

    const updatedProjects = projects.map(proj => {
      const projectIsActive = proj.status === 'Active' && isActiveOnDate(proj.startDate, proj.endDate, currentDate);
      const projAlloc = allocations.filter(a => 
        a.projectId === proj.id && 
        a.status === 'Active' &&
        projectIsActive &&
        isActiveOnDate(a.startDate, a.endDate, currentDate)
      );
      const plannedUtil = projAlloc.reduce((sum, a) => sum + a.percentage, 0);
      const projectApprovedEntries = timesheets
        .filter(t => t.status === 'Approved')
        .flatMap(t => t.entries)
        .filter(entry => entry.projectId === proj.id);
      const projectHours = projectApprovedEntries.reduce((sum, entry) => sum + entry.hours, 0);
      const actualUtilization = projAlloc.length > 0
        ? Math.round((projectHours / (settings.expectedWeeklyHours * Math.max(projAlloc.length, 1))) * 100)
        : proj.actualUtilization;
      return {
        ...proj,
        plannedUtilization: plannedUtil,
        actualUtilization,
        resourceCount: projAlloc.length
      };
    });

    this.set(STORAGE_KEYS.EMPLOYEES, updatedEmployees);
    this.set(STORAGE_KEYS.PROJECTS, updatedProjects);
  }

  static logAction(
    userId: string,
    userName: string,
    userRole: string,
    action: string,
    module: string,
    details: string,
    metadata: Partial<Pick<AuditLog, 'entityType' | 'entityId' | 'oldValue' | 'newValue' | 'reason' | 'source' | 'activeRole'>> = {}
  ) {
    const logs = this.get<AuditLog[]>(STORAGE_KEYS.AUDIT_LOGS, []);
    const newLog: AuditLog = {
      id: crypto.randomUUID(),
      userId,
      userName,
      userRole,
      activeRole: metadata.activeRole || userRole,
      source: metadata.source || 'Web',
      action,
      module,
      details,
      ...metadata,
      timestamp: new Date().toISOString()
    };
    this.set(STORAGE_KEYS.AUDIT_LOGS, [newLog, ...logs].slice(0, 500));
  }
}

export { STORAGE_KEYS };
