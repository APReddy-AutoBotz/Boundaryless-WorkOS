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
const { authService } = await import('../src/services/authService.ts');
const { employeeService, allocationService, projectService, leaveService, planningService } = await import('../src/services/api.ts');

DataStorage.resetDemoData();
await authService.login('admin-1', 'demo123');

const [employees, allocations, projects, availability, planning] = await Promise.all([
  employeeService.getAll(),
  allocationService.getAll(),
  projectService.getAll(),
  leaveService.getAvailability(),
  planningService.getResourcePlanning(),
]);

assert.ok(planning.rows.length > 0, 'resource planning report should include utilization-eligible employees');
assert.equal(planning.summary.people, planning.rows.length, 'planning summary people should match row count');

const employeeById = new Map(employees.map((employee) => [employee.id, employee]));
const projectById = new Map(projects.map((project) => [project.id, project]));
const availabilityById = new Map(availability.map((entry) => [entry.employeeId, entry]));
const sample = planning.rows.find((row) => row.allocations.length > 0) || planning.rows[0];
const sourceEmployee = employeeById.get(sample.employeeId);
assert.ok(sourceEmployee, 'planning row should reference an employee master row');

const expectedLoad = allocations
  .filter((allocation) => {
    const project = projectById.get(allocation.projectId);
    return allocation.employeeId === sample.employeeId &&
      allocation.status === 'Active' &&
      project &&
      ['Active', 'Proposed'].includes(project.status);
  })
  .reduce((sum, allocation) => sum + allocation.percentage, 0);
assert.equal(sample.plannedUtilization, expectedLoad, 'planning load should derive from active employee allocations');

const sourceAvailability = availabilityById.get(sample.employeeId);
assert.equal(sample.availabilityHours, sourceAvailability?.availabilityHours ?? (sourceEmployee.standardWeeklyHours || 40) * 52, 'planning availability should derive from leave availability report');
assert.ok(sample.availabilityAdjustedCapacityPercent <= 100 && sample.availabilityAdjustedCapacityPercent >= 0, 'availability adjusted capacity should be bounded');

const commandCenter = await planningService.getWorkforceCommandCenter();
assert.equal(commandCenter.benchCount, planning.summary.benchCount, 'command center bench count should come from planning summary');
assert.equal(commandCenter.overloadedCount, planning.summary.overloadedCount, 'command center overload count should come from planning summary');
assert.ok(commandCenter.leaveAdjustedAvailabilityHours >= planning.rows.length, 'command center should aggregate leave-adjusted availability hours');

console.log(JSON.stringify({
  status: 'passed',
  rows: planning.rows.length,
  bench: planning.summary.benchCount,
  overloaded: planning.summary.overloadedCount,
  risks: commandCenter.topRisks.length,
}, null, 2));
