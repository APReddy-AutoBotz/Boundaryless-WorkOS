import { Allocation, Employee, Project, SystemSettings, TimesheetSummary } from '../types';

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
  return allocations
    .filter(allocation => {
      const project = projects.find(item => item.id === allocation.projectId);
      return allocation.employeeId === employeeId &&
        allocation.status === 'Active' &&
        !!project &&
        isProjectAvailableForPlanning(project, rangeStart, rangeEnd, includeProposedProjects) &&
        overlapsDateRange(allocation.startDate, allocation.endDate, rangeStart, rangeEnd);
    })
    .reduce((sum, allocation) => sum + allocation.percentage, 0);
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

export const getApprovedHours = (timesheets: TimesheetSummary[], employeeId: string, weekEnding?: string) => {
  return timesheets
    .filter(timesheet =>
      timesheet.employeeId === employeeId &&
      timesheet.status === 'Approved' &&
      (!weekEnding || timesheet.weekEnding === weekEnding)
    )
    .reduce((sum, timesheet) => sum + timesheet.billableHours, 0);
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

  return latest ? Math.round((latest.billableHours / settings.expectedWeeklyHours) * 1000) / 10 : 0;
};

export const getUtilizationBand = (load: number, settings: SystemSettings) => {
  if (load > settings.utilizationThresholdHigh) return 'Overloaded';
  if (load <= settings.benchThreshold) return 'Bench';
  if (load < settings.utilizationThresholdLow) return 'Underutilized';
  return 'Balanced';
};

export const getCompanyMetrics = (employees: Employee[], settings: SystemSettings) => {
  const activeEmployees = employees.filter(employee => employee.status === 'Active');
  const totalPlanned = activeEmployees.reduce((sum, employee) => sum + employee.plannedUtilization, 0);
  return {
    totalEmployees: activeEmployees.length,
    averagePlanned: activeEmployees.length ? totalPlanned / activeEmployees.length : 0,
    overloaded: activeEmployees.filter(employee => getUtilizationBand(employee.plannedUtilization, settings) === 'Overloaded').length,
    underutilized: activeEmployees.filter(employee => {
      const band = getUtilizationBand(employee.plannedUtilization, settings);
      return band === 'Underutilized' || band === 'Bench';
    }).length,
  };
};
