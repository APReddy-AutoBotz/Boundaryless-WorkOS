import { Allocation, Employee, Project, SystemSettings, TimesheetSummary } from '../types';
import { roundMetric } from '../lib/format';

export const toDateOnly = (date: Date) => date.toISOString().split('T')[0];

export const overlapsDateRange = (startDate: string, endDate: string, rangeStart: string, rangeEnd: string) => {
  return new Date(startDate) <= new Date(rangeEnd) && new Date(endDate) >= new Date(rangeStart);
};

export const isProjectAvailableForPlanning = (project: Project, rangeStart: string, rangeEnd: string, includeProposed = false) => {
  const statusAllowed = project.status === 'Active' || (includeProposed && project.status === 'Proposed');
  return statusAllowed && overlapsDateRange(project.startDate, project.endDate, rangeStart, rangeEnd);
};

export const getAllocationLoad = (
  employeeId: string,
  allocations: Allocation[],
  projects: Project[],
  rangeStart: string,
  rangeEnd: string,
  includeProposedProjects = false
) => {
  const load = allocations
    .filter(allocation => {
      const project = projects.find(item => item.id === allocation.projectId);
      return allocation.employeeId === employeeId &&
        allocation.status === 'Active' &&
        !!project &&
        isProjectAvailableForPlanning(project, rangeStart, rangeEnd, includeProposedProjects) &&
        overlapsDateRange(allocation.startDate, allocation.endDate, rangeStart, rangeEnd);
    })
    .reduce((sum, allocation) => sum + allocation.percentage, 0);
  return roundMetric(load);
};

export const getActiveAllocationsForEmployee = (
  employeeId: string,
  allocations: Allocation[],
  projects: Project[],
  rangeStart: string,
  rangeEnd: string,
  includeProposedProjects = false
) => {
  return allocations.filter(allocation => {
    const project = projects.find(item => item.id === allocation.projectId);
    return allocation.employeeId === employeeId &&
      allocation.status === 'Active' &&
      !!project &&
      isProjectAvailableForPlanning(project, rangeStart, rangeEnd, includeProposedProjects) &&
      overlapsDateRange(allocation.startDate, allocation.endDate, rangeStart, rangeEnd);
  });
};

export const isGovernanceEmployee = (employee: Pick<Employee, 'employeeId' | 'designation' | 'department' | 'utilizationEligible'>) => {
  const code = employee.employeeId.toUpperCase();
  const designation = employee.designation.toLowerCase();
  const department = employee.department.toLowerCase();
  return employee.utilizationEligible === false ||
    code.startsWith('ADMIN-') ||
    code.startsWith('HR-') ||
    code.startsWith('CD-') ||
    designation === 'country director' ||
    designation === 'system administrator' ||
    designation === 'hr manager' ||
    department === 'regional leadership' ||
    department === 'administration' ||
    department === 'human resources';
};

export const getDefaultUtilizationEligible = (employee: Pick<Employee, 'employeeId' | 'designation' | 'department'>) => {
  return !isGovernanceEmployee({ ...employee, utilizationEligible: undefined });
};

export const isProjectManagerCapacity = (employee: Pick<Employee, 'employeeId' | 'designation'>) => {
  return employee.employeeId.toUpperCase().startsWith('PM-') || employee.designation === 'Project Manager';
};

export const isUtilizationEligibleEmployee = (
  employee: Employee,
  allocations: Allocation[] = [],
  projects: Project[] = [],
  date = toDateOnly(new Date()),
  includeProposedProjects = false
) => {
  if (employee.status !== 'Active' || isGovernanceEmployee(employee)) return false;
  if (!isProjectManagerCapacity(employee)) return true;
  if (employee.activeProjectCount > 0 || employee.plannedUtilization > 0) return true;
  return getActiveAllocationsForEmployee(employee.id, allocations, projects, date, date, includeProposedProjects).length > 0;
};

export const getUtilizationEligibleEmployees = (
  employees: Employee[],
  allocations: Allocation[] = [],
  projects: Project[] = [],
  date = toDateOnly(new Date()),
  includeProposedProjects = false
) => employees.filter(employee => isUtilizationEligibleEmployee(employee, allocations, projects, date, includeProposedProjects));

export const getApprovedHours = (timesheets: TimesheetSummary[], employeeId: string, weekEnding?: string) => {
  return timesheets
    .filter(timesheet =>
      timesheet.employeeId === employeeId &&
      timesheet.status === 'Approved' &&
      (!weekEnding || timesheet.weekEnding === weekEnding)
    )
    .reduce((sum, timesheet) => roundMetric(sum + timesheet.billableHours), 0);
};

export const getLatestApprovedActualUtilization = (
  employeeId: string,
  timesheets: TimesheetSummary[],
  settings: SystemSettings
) => {
  const latest = timesheets
    .filter(timesheet => timesheet.employeeId === employeeId && timesheet.status === 'Approved')
    .sort((a, b) => new Date(a.weekEnding).getTime() - new Date(b.weekEnding).getTime())
    .at(-1);

  return latest ? roundMetric((latest.billableHours / settings.expectedWeeklyHours) * 100) : 0;
};

export const getUtilizationBand = (load: number, settings: SystemSettings) => {
  if (load > settings.utilizationThresholdHigh) return 'Overloaded';
  if (load <= settings.benchThreshold) return 'Bench';
  if (load < settings.utilizationThresholdLow) return 'Underutilized';
  return 'Balanced';
};

export const getCompanyMetrics = (employees: Employee[], settings: SystemSettings) => {
  const activeEmployees = employees.filter(employee => employee.status === 'Active');
  const eligibleEmployees = getUtilizationEligibleEmployees(activeEmployees);
  const totalPlanned = eligibleEmployees.reduce((sum, employee) => sum + employee.plannedUtilization, 0);
  return {
    totalEmployees: activeEmployees.length,
    utilizationEligibleEmployees: eligibleEmployees.length,
    governanceUsers: activeEmployees.length - eligibleEmployees.length,
    averagePlanned: eligibleEmployees.length ? totalPlanned / eligibleEmployees.length : 0,
    overloaded: eligibleEmployees.filter(employee => getUtilizationBand(employee.plannedUtilization, settings) === 'Overloaded').length,
    underutilized: eligibleEmployees.filter(employee => {
      const band = getUtilizationBand(employee.plannedUtilization, settings);
      return band === 'Underutilized' || band === 'Bench';
    }).length,
  };
};
