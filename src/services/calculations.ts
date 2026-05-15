import { Allocation, Employee, LeaveAvailabilityEntry, Project, ResourcePlanningReport, SystemSettings, TimesheetSummary } from '../types';
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

export const buildResourcePlanningReport = ({
  employees,
  allocations,
  projects,
  availability,
  settings,
  asOfDate = toDateOnly(new Date()),
  includeProposedProjects = true,
}: {
  employees: Employee[];
  allocations: Allocation[];
  projects: Project[];
  availability: LeaveAvailabilityEntry[];
  settings: SystemSettings;
  asOfDate?: string;
  includeProposedProjects?: boolean;
}): ResourcePlanningReport => {
  const projectsById = new Map(projects.map(project => [project.id, project]));
  const availabilityByEmployeeId = new Map(availability.map(entry => [entry.employeeId, entry]));
  const activeEmployees = getUtilizationEligibleEmployees(employees, allocations, projects, asOfDate, includeProposedProjects);

  const rows = activeEmployees.map(employee => {
    const relevantAllocations = allocations
      .filter(allocation => {
        const project = projectsById.get(allocation.projectId);
        return allocation.employeeId === employee.id &&
          allocation.status === 'Active' &&
          !!project &&
          isProjectAvailableForPlanning(project, asOfDate, asOfDate, includeProposedProjects) &&
          overlapsDateRange(allocation.startDate, allocation.endDate, asOfDate, asOfDate);
      })
      .map(allocation => {
        const project = projectsById.get(allocation.projectId);
        return {
          allocationId: allocation.id,
          projectId: allocation.projectId,
          projectCode: project?.projectCode,
          projectName: project?.name || allocation.projectName,
          client: project?.client || '',
          managerName: project?.managerName || allocation.projectManager,
          percentage: allocation.percentage,
          billable: allocation.billable && Boolean(project?.billable ?? true),
          startDate: allocation.startDate,
          endDate: allocation.endDate,
        };
      })
      .sort((a, b) => b.percentage - a.percentage || a.projectName.localeCompare(b.projectName));

    const plannedUtilization = roundMetric(relevantAllocations.reduce((sum, allocation) => sum + allocation.percentage, 0));
    const billableAllocationPercent = roundMetric(relevantAllocations.filter(allocation => allocation.billable).reduce((sum, allocation) => sum + allocation.percentage, 0));
    const availabilityEntry = availabilityByEmployeeId.get(employee.id);
    const standardWeeklyHours = availabilityEntry?.standardWeeklyHours || employee.standardWeeklyHours || settings.expectedWeeklyHours || 40;
    const annualCapacityHours = Math.max(standardWeeklyHours * 52, 1);
    const availabilityHours = roundMetric(availabilityEntry?.availabilityHours ?? annualCapacityHours);
    const availabilityAdjustedCapacityPercent = roundMetric((availabilityHours / annualCapacityHours) * 100);
    const rollOffDate = relevantAllocations.length
      ? relevantAllocations.map(allocation => allocation.endDate).sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0]
      : undefined;

    return {
      employeeId: employee.id,
      employeeCode: employee.employeeId,
      employeeName: employee.name,
      department: employee.department,
      country: employee.country,
      capacityType: employee.capacityType,
      contractType: employee.contractType,
      standardWeeklyHours,
      plannedUtilization,
      actualUtilization: employee.actualUtilization || 0,
      availabilityHours,
      availabilityAdjustedCapacityPercent,
      approvedLeaveDays: availabilityEntry?.approvedLeaveDays || 0,
      holidayDays: availabilityEntry?.holidayDays || 0,
      activeProjectCount: relevantAllocations.length,
      billableAllocationPercent,
      bench: plannedUtilization <= settings.benchThreshold,
      overloaded: plannedUtilization > settings.utilizationThresholdHigh,
      underloaded: plannedUtilization < settings.utilizationThresholdLow && plannedUtilization > settings.benchThreshold,
      rollOffDate,
      allocations: relevantAllocations,
    };
  }).sort((a, b) => b.plannedUtilization - a.plannedUtilization || a.employeeName.localeCompare(b.employeeName));

  const rollOffLimit = new Date(`${asOfDate}T00:00:00`);
  rollOffLimit.setDate(rollOffLimit.getDate() + 45);
  const rollOffSoonCount = rows.filter(row => row.rollOffDate && new Date(`${row.rollOffDate}T00:00:00`) <= rollOffLimit).length;

  return {
    generatedAt: new Date().toISOString(),
    asOfDate,
    summary: {
      people: rows.length,
      averagePlanned: rows.length ? roundMetric(rows.reduce((sum, row) => sum + row.plannedUtilization, 0) / rows.length) : 0,
      averageAvailabilityAdjustedCapacity: rows.length ? roundMetric(rows.reduce((sum, row) => sum + row.availabilityAdjustedCapacityPercent, 0) / rows.length) : 0,
      benchCount: rows.filter(row => row.bench).length,
      overloadedCount: rows.filter(row => row.overloaded).length,
      underloadedCount: rows.filter(row => row.underloaded).length,
      rollOffSoonCount,
    },
    rows,
  };
};
