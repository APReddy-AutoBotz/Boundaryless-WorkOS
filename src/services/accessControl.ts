import { Allocation, Employee, Project, UserRole, UserSession } from '../types';

export const ROUTE_ROLES = {
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

export const canAccessEmployeeDetail = (user: UserSession | null | undefined, employeeId: string | undefined) => {
  if (!user || !employeeId) return false;
  const privilegedRoles: UserRole[] = ['Admin', 'HR', 'CountryDirector', 'TeamLead'];
  return privilegedRoles.includes(user.role) || user.id === employeeId;
};

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
