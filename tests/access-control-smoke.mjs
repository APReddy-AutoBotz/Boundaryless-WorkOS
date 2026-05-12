import assert from 'node:assert/strict';

const store = new Map();

globalThis.localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
  clear: () => store.clear(),
};
globalThis.sessionStorage = {
  getItem: (key) => (store.has(`session:${key}`) ? store.get(`session:${key}`) : null),
  setItem: (key, value) => store.set(`session:${key}`, String(value)),
  removeItem: (key) => store.delete(`session:${key}`),
  clear: () => {
    for (const key of [...store.keys()]) {
      if (key.startsWith('session:')) store.delete(key);
    }
  },
};

const { DataStorage } = await import('../src/services/storage.ts');
const { employeeService, projectService, allocationService } = await import('../src/services/api.ts');
const { authService } = await import('../src/services/authService.ts');
const {
  ROUTE_ROLES,
  canAccessEmployeeDetail,
  canAccessProjectDetail,
  canEditEmployeeData,
  canEditProjectData,
  canManageAllocations,
  canOpenImportExport,
  canOpenTimesheetApproval,
  canResetEmployeePassword,
  hasRouteRole,
} = await import('../src/services/accessControl.ts');

DataStorage.resetDemoData();

const employees = await employeeService.getAll();
const projects = await projectService.getAll();
const allocations = await allocationService.getAll();

const admin = await authService.login('admin-1', 'demo123');
assert.ok(admin, 'admin account should be available');
assert.equal(hasRouteRole(admin, ROUTE_ROLES.importExport), true, 'admin should access import/export');
assert.equal(hasRouteRole(admin, ROUTE_ROLES.auditTrail), true, 'admin should access audit trail');
assert.equal(canOpenImportExport(admin), true, 'admin should see import/export actions');
assert.equal(canEditEmployeeData(admin), true, 'admin should see employee edit actions');
assert.equal(canResetEmployeePassword(admin), true, 'admin should see password reset actions');
assert.equal(canEditProjectData(admin), true, 'admin should see project edit actions');
assert.equal(canAccessEmployeeDetail({ user: admin, employeeId: employees[0].id, employees, allocations, projects }), true, 'admin should access any employee detail');

const hr = await authService.login('hr-1', 'demo123', 'HR');
assert.ok(hr, 'HR account should be available');
assert.equal(hasRouteRole(hr, ROUTE_ROLES.adminSettings), true, 'HR should access governance settings');
assert.equal(hasRouteRole(hr, ROUTE_ROLES.auditTrail), false, 'HR should not access audit trail');
assert.equal(canOpenImportExport(hr), false, 'HR should not see import/export actions');
assert.equal(canEditEmployeeData(hr), true, 'HR should see employee edit actions');
assert.equal(canEditProjectData(hr), true, 'HR should see project edit actions');

const projectManager = await authService.login('pm-1', 'demo123', 'ProjectManager');
assert.ok(projectManager, 'PM account should be available');
const managedProject = projects.find(project =>
  project.managerId === projectManager.id ||
  project.managerId === projectManager.employeeId ||
  project.managerName === projectManager.name
);
assert.ok(managedProject, 'PM should manage at least one seeded project');
assert.equal(
  canAccessProjectDetail({
    user: projectManager,
    project: managedProject,
    projectId: managedProject.id,
    allocations,
    employees,
  }),
  true,
  'PM should access managed project detail'
);
const managedEmployeeId = allocations.find(allocation => allocation.projectId === managedProject.id)?.employeeId;
assert.ok(managedEmployeeId, 'managed project should have at least one assigned employee');
assert.equal(
  canAccessEmployeeDetail({ user: projectManager, employeeId: managedEmployeeId, employees, allocations, projects }),
  true,
  'PM should access employees assigned to managed projects'
);
assert.equal(hasRouteRole(projectManager, ROUTE_ROLES.clients), false, 'PM should not access Client Portfolio');
assert.equal(canOpenImportExport(projectManager), false, 'PM should not see import/export actions');
assert.equal(canEditEmployeeData(projectManager), false, 'PM should not see employee edit actions');
assert.equal(canResetEmployeePassword(projectManager), false, 'PM should not see password reset actions');
assert.equal(canEditProjectData(projectManager), false, 'PM should not see project edit actions');
assert.equal(canManageAllocations(projectManager), true, 'PM should see allocation controls');

const countryDirector = await authService.login('cd-1', 'demo123', 'CountryDirector');
assert.ok(countryDirector?.cdId, 'Country Director session should include CD scope id');
const cdEmployeeIds = new Set(employees
  .filter(employee =>
    employee.primaryCountryDirectorId === countryDirector.cdId ||
    employee.mappedCountryDirectorIds.includes(countryDirector.cdId)
  )
  .map(employee => employee.id));
const scopedAllocation = allocations.find(allocation => cdEmployeeIds.has(allocation.employeeId));
assert.ok(scopedAllocation, 'CD should have at least one scoped seeded allocation');
const scopedProject = await projectService.getById(scopedAllocation.projectId);
assert.ok(scopedProject, 'scoped allocation should reference a project');
assert.equal(
  canAccessProjectDetail({
    user: countryDirector,
    project: scopedProject,
    projectId: scopedProject.id,
    allocations,
    employees,
  }),
  true,
  'CD should access projects containing scoped employees'
);
assert.equal(
  canAccessEmployeeDetail({ user: countryDirector, employeeId: scopedAllocation.employeeId, employees, allocations, projects }),
  true,
  'CD should access scoped employee detail'
);
const unscopedEmployee = employees.find(employee => !cdEmployeeIds.has(employee.id));
assert.ok(unscopedEmployee, 'seed data should include an employee outside CD scope');
assert.equal(
  canAccessEmployeeDetail({ user: countryDirector, employeeId: unscopedEmployee.id, employees, allocations, projects }),
  false,
  'CD should not access unscoped employee detail'
);
assert.equal(canOpenTimesheetApproval(countryDirector), true, 'CD should see timesheet approval actions');

const allocatedEmployee = employees.find(employee =>
  employee.employeeId.startsWith('EMP-') &&
  allocations.some(allocation => allocation.employeeId === employee.id)
);
assert.ok(allocatedEmployee, 'seed data should include an allocated employee user');
const employee = await authService.login(allocatedEmployee.employeeId, 'demo123', 'Employee');
assert.ok(employee, 'employee account should be available');
assert.equal(canAccessEmployeeDetail({ user: employee, employeeId: allocatedEmployee.id, employees, allocations, projects }), true, 'employee should access own detail');
assert.equal(canEditEmployeeData(employee), false, 'employee should not see employee edit actions');
assert.equal(canManageAllocations(employee), false, 'employee should not see allocation controls');
assert.equal(canOpenTimesheetApproval(employee), false, 'employee should not see timesheet approval actions');
const unrelatedProject = projects.find(project =>
  !allocations.some(allocation => allocation.projectId === project.id && allocation.employeeId === employee.id)
);
assert.ok(unrelatedProject, 'seed data should include a project unrelated to the employee');
assert.equal(
  canAccessProjectDetail({
    user: employee,
    project: unrelatedProject,
    projectId: unrelatedProject.id,
    allocations,
    employees,
  }),
  false,
  'employee should not access unrelated project detail'
);
assert.equal(
  canAccessProjectDetail({
    user: projectManager,
    project: unrelatedProject,
    projectId: unrelatedProject.id,
    allocations,
    employees,
  }),
  false,
  'PM should not access unmanaged project detail'
);

console.log(JSON.stringify({
  status: 'passed',
  checkedRoles: ['Admin', 'HR', 'ProjectManager', 'CountryDirector', 'Employee'],
  managedProject: managedProject.projectCode,
  scopedProject: scopedProject.projectCode,
}, null, 2));
