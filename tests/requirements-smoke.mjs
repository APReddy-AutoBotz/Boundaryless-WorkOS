import assert from 'node:assert/strict';

const store = new Map();

globalThis.localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
  clear: () => store.clear(),
};

const { DataStorage, STORAGE_KEYS } = await import('../src/services/storage.ts');
const { employeeService, projectService, allocationService, timesheetService, adminService, clientService } = await import('../src/services/api.ts');
const { authService } = await import('../src/services/authService.ts');
const {
  getAllocationLoad,
  getLatestApprovedActualUtilization,
  getCompanyMetrics,
} = await import('../src/services/calculations.ts');

const todayIso = new Date().toISOString().split('T')[0];
const inRange = (start, end) => new Date(start) <= new Date(todayIso) && new Date(end) >= new Date(todayIso);

DataStorage.resetDemoData();

const employees = employeeService.getAll();
const projects = projectService.getAll();
const clients = clientService.getAll();
const allocations = allocationService.getAll();
const timesheets = timesheetService.getAll();
const directors = adminService.getCountryDirectors();
const settings = adminService.getSettings();
const departments = adminService.getDepartments();
const countries = adminService.getCountries();
const industries = adminService.getIndustries();

assert.equal(DataStorage.get(STORAGE_KEYS.DEMO_DATA_VERSION, ''), 'demo-120-people-60-processes-v5', 'demo data version should be current');
assert.ok(employees.length >= 110, 'demo data should include employee, PM, CD, HR, and Admin users');
assert.equal(projects.length, 60, 'demo data should include 60 projects/processes');
assert.ok(clients.length >= 15, 'demo data should include client master records');
assert.ok(projects.every(project => project.clientId && clients.some(client => client.id === project.clientId)), 'each seeded project should reference a client master record');
assert.equal(directors.length, 8, 'demo data should include 8 Country Directors');
assert.ok(projects.some(project => project.status === 'Completed'), 'demo data should include completed projects');
assert.ok(timesheets.some(timesheet => timesheet.status === 'Draft'), 'demo data should include draft timesheets');
assert.ok(timesheets.some(timesheet => timesheet.status === 'Submitted'), 'demo data should include submitted timesheets');
assert.ok(timesheets.some(timesheet => timesheet.status === 'Approved'), 'demo data should include approved timesheets');
assert.ok(timesheets.some(timesheet => timesheet.status === 'Rejected'), 'demo data should include rejected timesheets');
assert.ok(departments.length >= 10, 'department catalog should be seeded');
assert.ok(countries.length >= 10, 'country catalog should be seeded');
assert.ok(industries.length >= 10, 'industry catalog should be seeded');

const activeEmployees = employees.filter(employee => employee.status === 'Active');
const averagePlanned = activeEmployees.reduce((sum, employee) => sum + employee.plannedUtilization, 0) / activeEmployees.length;
assert.ok(averagePlanned >= 60 && averagePlanned <= 70, `active planned utilization should remain demo-realistic, got ${averagePlanned.toFixed(1)}%`);

const sharedDirectorEmployee = employees.find(employee => employee.mappedCountryDirectorIds.length > 1);
assert.ok(sharedDirectorEmployee, 'at least one employee should map to multiple Country Directors');

const adminLogin = await authService.login('admin-1', 'demo123');
const badLogin = await authService.login('admin-1', 'wrong-password');
const pmLogin = await authService.login('pm-1', 'demo123', 'ProjectManager');
assert.equal(adminLogin?.role, 'Admin', 'admin demo login should resolve Admin role');
assert.equal(badLogin, null, 'invalid passwords should be rejected');
assert.equal(pmLogin?.role, 'ProjectManager', 'requested PM role should be honored when assigned');

const getWeekStart = (date) => {
  const next = new Date(date);
  const day = next.getDay();
  next.setDate(next.getDate() + (day === 0 ? -6 : 1 - day));
  next.setHours(0, 0, 0, 0);
  return next;
};
const toIsoDate = (date) => date.toISOString().split('T')[0];
const futureWeekStart = getWeekStart(new Date());
futureWeekStart.setDate(futureWeekStart.getDate() + 7);
const futureWeekEnding = new Date(futureWeekStart);
futureWeekEnding.setDate(futureWeekEnding.getDate() + 4);
const futureEntryDate = toIsoDate(futureWeekStart);

assert.throws(() => timesheetService.save({
  employeeId: activeEmployees[0].id,
  employeeName: activeEmployees[0].name,
  weekEnding: toIsoDate(futureWeekEnding),
  totalHours: 8,
  billableHours: 8,
  status: 'Submitted',
  submittedAt: new Date().toISOString(),
  entries: [{
    id: 'future-entry-test',
    employeeId: activeEmployees[0].id,
    projectId: projects[0].id,
    projectName: projects[0].name,
    workType: 'Project Work',
    date: futureEntryDate,
    hours: 8,
    status: 'Submitted',
    billable: true,
    weekEnding: toIsoDate(futureWeekEnding),
  }],
}), /Future week timesheets cannot be saved or submitted/, 'future-week timesheets should be blocked at the service layer');

const activeProjects = projects.filter(project => project.status === 'Active');
const pmAllocationProjectIds = new Set(allocations
  .filter(allocation => allocation.status === 'Active' && allocation.roleOnProject === 'Project Manager')
  .map(allocation => allocation.projectId));
assert.ok(activeProjects.every(project => pmAllocationProjectIds.has(project.id)), 'every active project should have a PM allocation');

const sampleEmployee = activeEmployees.find(employee => allocations.some(allocation =>
  allocation.employeeId === employee.id &&
  allocation.status === 'Active' &&
  inRange(allocation.startDate, allocation.endDate)
));
assert.ok(sampleEmployee, 'test requires at least one actively allocated employee');
const expectedPlanned = getAllocationLoad(sampleEmployee.id, allocations, projects, todayIso, todayIso);
assert.equal(sampleEmployee.plannedUtilization, expectedPlanned, 'employee planned utilization should equal active allocation load');

const oneMonthOut = new Date();
oneMonthOut.setMonth(oneMonthOut.getMonth() + 1);
const oneMonthIso = oneMonthOut.toISOString().split('T')[0];
const expectedOneMonthForecast = getAllocationLoad(sampleEmployee.id, allocations, projects, oneMonthIso, oneMonthIso, true);
assert.ok(Number.isFinite(expectedOneMonthForecast), 'one-month forecast should calculate from allocation/project date ranges');

const approvedTimesheet = timesheets.find(timesheet => timesheet.status === 'Approved');
assert.ok(approvedTimesheet, 'test requires an approved timesheet');
const employeeWithApprovedTimesheet = employees.find(employee => employee.id === approvedTimesheet.employeeId);
assert.ok(employeeWithApprovedTimesheet, 'approved timesheet should reference an employee');
const expectedActual = getLatestApprovedActualUtilization(approvedTimesheet.employeeId, timesheets, settings);
assert.equal(employeeWithApprovedTimesheet.actualUtilization, expectedActual, 'employee actual utilization should equal latest approved timesheet utilization');

const companyMetrics = getCompanyMetrics(employees, settings);
assert.equal(companyMetrics.totalEmployees, activeEmployees.length, 'company metrics should count active employees once');

const clientToRename = clients[0];
const originalClientName = clientToRename.name;
clientService.save({ ...clientToRename, name: `${originalClientName} Renamed` });
assert.ok(projectService.getAll().some(project => project.clientId === clientToRename.id && project.client === `${originalClientName} Renamed`), 'client master rename should cascade to linked project display names');

const usedDepartment = departments.find(department => employees.some(employee => employee.department === department.name));
assert.ok(usedDepartment, 'test requires a used department');
assert.equal(adminService.deleteDepartment(usedDepartment.id), false, 'department catalog delete should be guarded when employees or roles still use it');

const customIndustry = {
  id: 'industry-smoke-test',
  name: 'Smoke Test Industry',
  active: true,
  createdAt: new Date().toISOString(),
};
adminService.saveIndustry(customIndustry);
assert.ok(adminService.getIndustries().some(industry => industry.id === customIndustry.id), 'industry catalog should accept new values');
assert.equal(adminService.deleteIndustry(customIndustry.id), true, 'unused industry catalog value should be retired');

console.log(JSON.stringify({
  status: 'passed',
  employees: employees.length,
  activeEmployees: activeEmployees.length,
  clients: clients.length,
  projects: projects.length,
  allocations: allocations.length,
  timesheets: timesheets.length,
  averagePlanned: Number(averagePlanned.toFixed(1)),
}, null, 2));
