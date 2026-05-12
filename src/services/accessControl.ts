import { Allocation, Employee, Project, UserRole, UserSession } from '../types';

export const ROUTE_ROLES = {
  dashboard: ['Admin', 'HR', 'CountryDirector'],
  employeeWorkspace: ['Employee'],
  projectManagerWorkspace: ['ProjectManager'],
  employees: ['Admin', 'HR', 'CountryDirector', 'TeamLead'],
  projects: ['Admin', 'HR', 'CountryDirector', 'ProjectManager'],
  clients: ['Admin', 'HR', 'CountryDirector'],
  allocations: ['Admin', 'ProjectManager', 'CountryDirector', 'HR'],
  timesheets: ['Admin', 'Employee', 'ProjectManager', 'TeamLead', 'HR', 'CountryDirector'],
  timesheetApproval: ['Admin', 'CountryDirector', 'ProjectManager', 'TeamLead'],
  utilization: ['Admin', 'HR', 'CountryDirector', 'ProjectManager', 'TeamLead'],
  importExport: ['Admin'],
  auditTrail: ['Admin'],
  adminSettings: ['Admin', 'HR'],
} satisfies Record<string, UserRole[]>;

export const hasRouteRole = (user: UserSession | null | undefined, roles: readonly UserRole[]) => {
  return !!user && roles.includes(user.role);
};

interface EmployeeAccessInput {
  user: UserSession | null | undefined;
  employeeId: string | undefined;
  employees: Employee[];
  allocations: Allocation[];
  projects: Project[];
}

export const canAccessEmployeeDetail = ({
  user,
  employeeId,
  employees,
  allocations,
  projects,
}: EmployeeAccessInput) => {
  if (!user || !employeeId) return false;
  if (['Admin', 'HR', 'TeamLead'].includes(user.role)) return true;
  if (user.id === employeeId) return true;

  const employee = employees.find(item => item.id === employeeId);
  if (!employee) return false;

  if (user.role === 'CountryDirector' && user.cdId) {
    return employee.primaryCountryDirectorId === user.cdId ||
      employee.mappedCountryDirectorIds.includes(user.cdId);
  }

  if (user.role === 'ProjectManager') {
    const managedProjectIds = new Set(projects
      .filter(project =>
        project.managerId === user.id ||
        project.managerId === user.employeeId ||
        project.managerName === user.name
      )
      .map(project => project.id));
    return allocations.some(allocation =>
      allocation.employeeId === employeeId &&
      managedProjectIds.has(allocation.projectId)
    );
  }

  return false;
};

export const canEditEmployeeData = (user: UserSession | null | undefined) =>
  hasRouteRole(user, ['Admin', 'HR'] as const);

export const canResetEmployeePassword = canEditEmployeeData;

export const canOpenImportExport = (user: UserSession | null | undefined) =>
  hasRouteRole(user, ROUTE_ROLES.importExport);

export const canManageAllocations = (user: UserSession | null | undefined) =>
  hasRouteRole(user, ROUTE_ROLES.allocations);

export const canOpenTimesheetApproval = (user: UserSession | null | undefined) =>
  hasRouteRole(user, ROUTE_ROLES.timesheetApproval);

export const canEditProjectData = (user: UserSession | null | undefined) =>
  hasRouteRole(user, ['Admin', 'HR'] as const);

interface ProjectAccessInput {
  user: UserSession | null | undefined;
  project: Project | undefined;
  projectId: string | undefined;
  allocations: Allocation[];
  employees: Employee[];
}

export const canAccessProjectDetail = ({ user, project, projectId, allocations, employees }: ProjectAccessInput) => {
  if (!user || !projectId) return false;
  if (['Admin', 'HR'].includes(user.role)) return true;

  const projectAllocations = allocations.filter(allocation => allocation.projectId === projectId);

  if (
    user.role === 'ProjectManager' &&
    project &&
    (project.managerId === user.id || project.managerId === user.employeeId || project.managerName === user.name)
  ) {
    return true;
  }

  if (user.role === 'CountryDirector' && user.cdId) {
    const scopedEmployeeIds = new Set(employees
      .filter(employee =>
        employee.primaryCountryDirectorId === user.cdId ||
        employee.mappedCountryDirectorIds.includes(user.cdId!)
      )
      .map(employee => employee.id));
    if (projectAllocations.some(allocation => scopedEmployeeIds.has(allocation.employeeId))) return true;
  }

  return projectAllocations.some(allocation => allocation.employeeId === user.id);
};
