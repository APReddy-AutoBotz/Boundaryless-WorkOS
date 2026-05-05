import {
  Allocation,
  AuditLog,
  Client,
  CountryDirector,
  Employee,
  Project,
  RoleDefinition,
  TimesheetEntry,
  TimesheetSummary,
  CatalogItem,
} from '../types';

export const DEMO_DATA_VERSION = 'demo-120-people-60-processes-v6';

const isoDate = (date: Date) => date.toISOString().split('T')[0];
const pad = (value: number) => value.toString().padStart(2, '0');
const pick = <T,>(items: T[], index: number) => items[index % items.length];
const round1 = (value: number) => Math.round(value * 10) / 10;

const roleNames = [
  ['Solution Architect', 'Architecture', 'Owns solution design, integration patterns, and technical fit.'],
  ['RPA Developer', 'Automation', 'Builds bots, workflows, exception handling, and automation assets.'],
  ['Business Analyst', 'Analysis', 'Captures requirements, maps processes, and validates scope.'],
  ['Project Manager', 'Delivery', 'Manages plan, risks, dependencies, and delivery governance.'],
  ['Intern', 'Enablement', 'Supports documentation, testing, and delivery operations.'],
  ['Support Team', 'Support', 'Handles production support, monitoring, and issue triage.'],
  ['Operations Executive', 'Operations', 'Coordinates operations, reporting, and service readiness.'],
  ['QA Analyst', 'Quality', 'Owns test planning, regression packs, and quality gates.'],
  ['Process Consultant', 'Consulting', 'Maps current-state and target-state business processes.'],
  ['Data Analyst', 'Analytics', 'Prepares dashboards, extracts, and operational insights.'],
  ['Automation Lead', 'Automation', 'Leads automation standards, reviews, and delivery quality.'],
  ['Delivery Manager', 'Delivery', 'Owns portfolio delivery rhythm and stakeholder governance.'],
  ['Scrum Master', 'Agile', 'Facilitates agile ceremonies and removes team blockers.'],
  ['Technical Lead', 'Engineering', 'Guides implementation, reviews code, and mentors developers.'],
  ['DevOps Engineer', 'Platform', 'Maintains environments, CI/CD, releases, and platform reliability.'],
];

export const DEFAULT_ROLE_DEFINITIONS: RoleDefinition[] = roleNames.map(([name, department, description], index) => ({
  id: `job-role-${index + 1}`,
  name,
  department,
  description,
  active: true,
  createdAt: '2026-04-01T00:00:00.000Z',
}));

const roleCombos = [
  'Business Analyst + Project Manager',
  'RPA Developer + Solution Architect',
  'Solution Architect + Technical Lead',
  'Support Team + Operations Executive',
  'Business Analyst + Process Consultant',
  'RPA Developer + QA Analyst',
];

export const DEFAULT_DEPARTMENTS = [
  'Automation CoE',
  'Business Transformation',
  'Client Operations',
  'Delivery Management',
  'Enterprise Architecture',
  'Managed Services',
  'Process Excellence',
  'Quality Engineering',
  'Support Operations',
  'Technology Consulting',
];

export const DEFAULT_COUNTRIES = [
  'United Kingdom',
  'India',
  'United States',
  'Singapore',
  'Germany',
  'France',
  'Netherlands',
  'Australia',
  'Spain',
  'United Arab Emirates',
];

const regions = ['EMEA', 'India', 'North America', 'APAC', 'DACH', 'Europe', 'Benelux', 'ANZ'];
export const DEFAULT_INDUSTRIES = [
  'Banking',
  'Insurance',
  'Retail',
  'Manufacturing',
  'Healthcare',
  'Logistics',
  'Technology',
  'Telecom',
  'Energy',
  'Public Sector',
  'Consumer Goods',
  'Travel',
  'Professional Services',
  'Education',
  'Pharma',
];

export const createDefaultCatalog = (prefix: string, values: string[]): CatalogItem[] => values.map((name, index) => ({
  id: `${prefix}-${index + 1}`,
  name,
  active: true,
  createdAt: '2026-04-01T00:00:00.000Z',
  updatedAt: '2026-04-01T00:00:00.000Z',
}));
const processFamilies = [
  'Order Management',
  'Claims Intake',
  'Invoice Automation',
  'Customer Onboarding',
  'KYC Operations',
  'Vendor Reconciliation',
  'Payroll Controls',
  'Supply Planning',
  'Contact Center Optimization',
  'Finance Close',
  'HR Case Management',
  'Compliance Reporting',
  'Data Quality Remediation',
  'Service Desk Automation',
  'Procurement Workflow',
];

const makeEmployee = (
  id: string,
  employeeId: string,
  name: string,
  designation: string,
  department: string,
  country: string,
  primaryCountryDirectorId: string,
  mappedCountryDirectorIds: string[],
  status: Employee['status'] = 'Active'
): Employee => ({
  id,
  employeeId,
  name,
  email: `${employeeId.toLowerCase()}@boundaryless.demo`,
  designation,
  department,
  country,
  primaryCountryDirectorId,
  mappedCountryDirectorIds: Array.from(new Set(mappedCountryDirectorIds)),
  status,
  plannedUtilization: 0,
  actualUtilization: 0,
  activeProjectCount: 0,
});

const weekDaysForEnding = (weekEnding: string) => {
  const [year, month, day] = weekEnding.split('-').map(Number);
  const friday = new Date(Date.UTC(year, month - 1, day));
  return Array.from({ length: 5 }, (_, index) => {
    const date = new Date(friday);
    date.setDate(friday.getDate() - (4 - index));
    return isoDate(date);
  });
};

const buildTimesheetEntries = (
  employee: Employee,
  allocations: Allocation[],
  weekEnding: string,
  weekIndex: number,
  totalHours: number,
  status: TimesheetSummary['status']
): TimesheetEntry[] => {
  const days = weekDaysForEnding(weekEnding);
  const totalTenths = Math.round(totalHours * 10);
  const entryCount = days.length * allocations.length;
  const baseTenths = Math.floor(totalTenths / entryCount);
  const remainderTenths = totalTenths % entryCount;

  return days.flatMap((date, dayIndex) =>
    allocations.map((allocation, allocationIndex) => {
      const entryOrdinal = dayIndex * allocations.length + allocationIndex;
      const hours = round1((baseTenths + (entryOrdinal < remainderTenths ? 1 : 0)) / 10);

      return {
        id: `ts-entry-${employee.employeeId.toLowerCase()}-${weekIndex + 1}-${dayIndex + 1}-${allocationIndex + 1}`,
        employeeId: employee.id,
        projectId: allocation.projectId,
        projectName: allocation.projectName,
        workType: 'Project Work',
        date,
        hours,
        remark: `${allocation.roleOnProject || employee.designation} delivery for ${allocation.projectName}`,
        status,
        billable: true,
        weekEnding,
      };
    })
  );
};

const validateTimesheets = (timesheets: TimesheetSummary[]) => {
  for (const timesheet of timesheets) {
    const entryTotal = round1(timesheet.entries.reduce((sum, entry) => sum + entry.hours, 0));
    const expectedTotal = round1(timesheet.totalHours);
    if (entryTotal !== expectedTotal) {
      throw new Error(`Invalid demo timesheet ${timesheet.employeeId}/${timesheet.weekEnding}: entry total ${entryTotal} does not match ${expectedTotal}`);
    }

    const invalidEntry = timesheet.entries.find(entry => entry.hours < 0 || entry.hours > 24);
    if (invalidEntry) {
      throw new Error(`Invalid demo timesheet entry ${invalidEntry.id}: ${invalidEntry.hours} hours is outside 0-24`);
    }
  }
};

export const generateDemoDataset = () => {
  const countryDirectors: CountryDirector[] = Array.from({ length: 8 }, (_, index) => ({
    id: `cd-${index + 1}`,
    name: `CD-${index + 1}`,
    region: regions[index],
  }));

  const clients: Client[] = Array.from({ length: 15 }, (_, index) => {
    const primaryDirector = countryDirectors[index % countryDirectors.length];
    const secondaryDirector = countryDirectors[(index + 3) % countryDirectors.length];
    return {
      id: `client-${index + 1}`,
      name: `Client-${index + 1}`,
      industry: DEFAULT_INDUSTRIES[index % DEFAULT_INDUSTRIES.length],
      accountOwnerId: undefined,
      countryDirectorIds: index % 4 === 0 ? [primaryDirector.id, secondaryDirector.id] : [primaryDirector.id],
      status: 'Active',
      createdAt: '2026-04-01T00:00:00.000Z',
      updatedAt: '2026-04-01T00:00:00.000Z',
    };
  });

  const employees: Employee[] = [
    makeEmployee('admin-1', 'ADMIN-1', 'Admin-1', 'System Administrator', 'Administration', 'United Kingdom', 'cd-1', ['cd-1']),
    makeEmployee('hr-1', 'HR-1', 'HR-1', 'HR Manager', 'Human Resources', 'India', 'cd-2', ['cd-1', 'cd-2']),
  ];

  countryDirectors.forEach((director, index) => {
    employees.push(makeEmployee(
      `cd-person-${index + 1}`,
      `CD-${index + 1}`,
      `CD-${index + 1}`,
      'Country Director',
      'Regional Leadership',
      pick(DEFAULT_COUNTRIES, index),
      director.id,
      [director.id]
    ));
  });

  Array.from({ length: 10 }, (_, index) => {
    const cd = countryDirectors[index % countryDirectors.length];
    const secondary = countryDirectors[(index + 3) % countryDirectors.length];
    employees.push(makeEmployee(
      `pm-${index + 1}`,
      `PM-${index + 1}`,
      `PM-${index + 1}`,
      'Project Manager',
      'Delivery Management',
      pick(DEFAULT_COUNTRIES, index + 2),
      cd.id,
      index % 3 === 0 ? [cd.id, secondary.id] : [cd.id]
    ));
  });

  Array.from({ length: 100 }, (_, index) => {
    const employeeNumber = index + 1;
    const primaryCd = countryDirectors[index % countryDirectors.length];
    const secondaryCd = countryDirectors[(index + 2) % countryDirectors.length];
    const tertiaryCd = countryDirectors[(index + 5) % countryDirectors.length];
    const mapped = index % 10 === 0
      ? [primaryCd.id, secondaryCd.id, tertiaryCd.id]
      : index % 4 === 0
        ? [primaryCd.id, secondaryCd.id]
        : [primaryCd.id];
    const designation = index % 12 === 0
      ? pick(roleCombos, index)
      : pick(DEFAULT_ROLE_DEFINITIONS, index).name;

    employees.push(makeEmployee(
      `emp-${employeeNumber}`,
      `EMP-${employeeNumber}`,
      `Emp-${employeeNumber}`,
      designation,
      pick(DEFAULT_DEPARTMENTS, index),
      pick(DEFAULT_COUNTRIES, index),
      primaryCd.id,
      mapped,
      index % 37 === 0 ? 'On Leave' : index % 53 === 0 ? 'Exited' : 'Active'
    ));
  });

  const projectManagers = employees.filter(employee => employee.employeeId.startsWith('PM-'));
  const projects: Project[] = Array.from({ length: 60 }, (_, index) => {
    const projectNumber = index + 1;
    const manager = pick(projectManagers, index);
    const start = new Date(2026, index % 12, 1);
    const end = new Date(start);
    end.setMonth(start.getMonth() + 5 + (index % 5));
    const status: Project['status'] = index % 12 === 0
      ? 'Completed'
      : index % 13 === 0
        ? 'On Hold'
        : index % 7 === 0
          ? 'Proposed'
          : 'Active';

    if (status === 'Completed') {
      start.setFullYear(2025);
      end.setFullYear(2026, 2, 31);
    }
    if (status === 'Active') {
      start.setFullYear(2026, 0, 1);
      end.setFullYear(2026, 11, 31);
    }
    if (status === 'Proposed') {
      start.setFullYear(2026, 5 + (index % 4), 1);
      end.setFullYear(2027, index % 6, 28);
    }

    const client = pick(clients, index);

    return {
      id: `process-${projectNumber}`,
      projectCode: `PRC-${pad(projectNumber)}`,
      name: `${pick(processFamilies, index)} Process-${projectNumber}`,
      clientId: client.id,
      client: client.name,
      managerId: manager.id,
      managerName: manager.name,
      startDate: isoDate(start),
      endDate: isoDate(end),
      status,
      billable: index % 11 !== 0,
      plannedUtilization: 0,
      actualUtilization: 0,
      resourceCount: 0,
    };
  });

  const currentProjects = projects.filter(project => project.status === 'Active');
  const liveProjects = projects.filter(project => project.status === 'Active' || project.status === 'Proposed');
  const completedProjects = projects.filter(project => project.status === 'Completed');
  const deliveryEmployees = employees.filter(employee => employee.employeeId.startsWith('EMP-') && employee.status !== 'Exited');
  const allocations: Allocation[] = [];

  deliveryEmployees.forEach((employee, index) => {
    const plan = index % 17 === 0
      ? [70, 40]
      : index % 11 === 0
        ? [20]
      : index % 7 === 0
        ? [40, 30]
      : index % 5 === 0
          ? [35, 25, 20]
      : index % 3 === 0
              ? [45, 30]
              : [80];

    plan.forEach((percentage, planIndex) => {
      const projectPool = index % 9 === 0 && planIndex === plan.length - 1 ? liveProjects : currentProjects;
      const project = pick(projectPool, index * 3 + planIndex * 5);
      const start = project.status === 'Proposed' ? project.startDate : '2026-01-01';
      const end = project.status === 'Proposed' ? project.endDate : '2026-12-31';
      allocations.push({
        id: `alloc-${employee.employeeId.toLowerCase()}-${planIndex + 1}`,
        employeeId: employee.id,
        projectId: project.id,
        projectName: project.name,
        projectManager: project.managerName,
        roleOnProject: planIndex === 1 ? pick(roleCombos, index + planIndex) : employee.designation,
        percentage,
        startDate: start,
        endDate: end,
        billable: project.billable,
        status: project.status === 'On Hold' ? 'Paused' : 'Active',
      });
    });

    if (index < 35) {
      const project = pick(completedProjects, index);
      allocations.push({
        id: `alloc-${employee.employeeId.toLowerCase()}-history`,
        employeeId: employee.id,
        projectId: project.id,
        projectName: project.name,
        projectManager: project.managerName,
        roleOnProject: pick(DEFAULT_ROLE_DEFINITIONS, index + 4).name,
        percentage: 40 + ((index % 4) * 10),
        startDate: '2025-10-01',
        endDate: '2026-03-31',
        billable: project.billable,
        status: 'Completed',
      });
    }
  });

  projects.forEach((project, index) => {
    const manager = projectManagers.find(employee => employee.id === project.managerId);
    if (!manager) return;

    allocations.push({
      id: `alloc-${manager.employeeId.toLowerCase()}-${project.projectCode.toLowerCase()}`,
      employeeId: manager.id,
      projectId: project.id,
      projectName: project.name,
      projectManager: project.managerName,
      roleOnProject: 'Project Manager',
      percentage: project.status === 'Completed' ? 5 : 10,
      startDate: project.startDate,
      endDate: project.endDate,
      billable: project.billable,
      status: project.status === 'Completed' ? 'Completed' : project.status === 'On Hold' ? 'Paused' : 'Active',
    });
  });

  const weekEndings = ['2026-04-03', '2026-04-10', '2026-04-17', '2026-04-24'];
  const timesheets: TimesheetSummary[] = [];
  const timesheetEmployees = [...deliveryEmployees.slice(0, 70), ...projectManagers];
  timesheetEmployees.forEach((employee, employeeIndex) => {
    const activeAllocations = allocations.filter(allocation => allocation.employeeId === employee.id && allocation.status === 'Active').slice(0, 3);
    if (activeAllocations.length === 0) return;

    weekEndings.forEach((weekEnding, weekIndex) => {
      const statusSeed = (employeeIndex + weekIndex) % 9;
      const status: TimesheetSummary['status'] = statusSeed === 0
        ? 'Rejected'
        : statusSeed === 1
          ? 'Submitted'
          : statusSeed === 2
            ? 'Draft'
            : 'Approved';
      const totalHours = status === 'Draft' ? 24 + ((employeeIndex + weekIndex) % 3) * 4 : 40;
      const entries = buildTimesheetEntries(employee, activeAllocations, weekEnding, weekIndex, totalHours, status);
      const billableHours = entries
        .filter(entry => activeAllocations.find(allocation => allocation.projectId === entry.projectId)?.billable)
        .reduce((sum, entry) => sum + entry.hours, 0);

      timesheets.push({
        employeeId: employee.id,
        employeeName: employee.name,
        weekEnding,
        totalHours,
        billableHours,
        status,
        submittedAt: status === 'Submitted' || status === 'Approved' || status === 'Rejected' ? `${weekEnding}T17:30:00.000Z` : undefined,
        approvedAt: status === 'Approved' ? `${weekEnding}T19:00:00.000Z` : undefined,
        approvedBy: status === 'Approved' ? pick(countryDirectors, employeeIndex).name : undefined,
        rejectedAt: status === 'Rejected' ? `${weekEnding}T19:00:00.000Z` : undefined,
        rejectedBy: status === 'Rejected' ? pick(countryDirectors, employeeIndex).name : undefined,
        rejectionReason: status === 'Rejected' ? 'Demo rejection: add clearer task remarks for client billing review.' : undefined,
        rejectionNote: status === 'Rejected' ? 'Demo rejection: add clearer task remarks for client billing review.' : undefined,
        entries,
      });
    });
  });

  validateTimesheets(timesheets);

  const auditLogs: AuditLog[] = [
    {
      id: 'audit-demo-1',
      userId: 'u-admin-1',
      userName: 'Admin-1',
      userRole: 'Admin',
      action: 'Seed',
      module: 'Demo Data',
      details: 'Loaded deterministic demo data: 120 people, 60 processes, 8 country directors, 10 project managers.',
      timestamp: '2026-04-24T09:00:00.000Z',
    },
  ];

  return {
    countryDirectors,
    clients,
    employees,
    projects,
    allocations,
    timesheets,
    roleDefinitions: DEFAULT_ROLE_DEFINITIONS,
    auditLogs,
  };
};
