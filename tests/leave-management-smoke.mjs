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

const { DataStorage, STORAGE_KEYS } = await import('../src/services/storage.ts');
const { employeeService, leaveService } = await import('../src/services/api.ts');

DataStorage.resetDemoData();

const employees = await employeeService.getAll();
const employee = employees.find((item) =>
  item.status === 'Active' &&
  !item.employeeId.startsWith('ADMIN-') &&
  !item.employeeId.startsWith('HR-') &&
  !item.employeeId.startsWith('CD-')
) || employees[0];
const leaveTypes = await leaveService.getTypes();
const annualLeave = leaveTypes.find((type) => type.code === 'ANNUAL') || leaveTypes[0];

assert.ok(leaveTypes.length >= 3, 'leave foundation should seed leave types');
assert.ok((await leaveService.getPolicies()).length >= 1, 'leave foundation should seed policies');
assert.ok((await leaveService.getHolidayCalendars()).length >= 1, 'leave foundation should seed holiday calendars');

const initialBalances = await leaveService.getBalances();
const initialBalance = initialBalances.find((balance) => balance.employeeId === employee.id && balance.leaveTypeId === annualLeave.id);
assert.ok(initialBalance, 'employee should have an annual leave balance');

const request = await leaveService.submitRequest({
  id: '',
  employeeId: employee.id,
  leaveTypeId: annualLeave.id,
  startDate: '2026-06-01',
  endDate: '2026-06-05',
  totalDays: 0,
  status: 'Submitted',
  reason: 'Planned annual leave',
});

assert.equal(request.status, 'Submitted', 'new leave requests should be submitted');
assert.equal(request.totalDays, 5, 'leave requests should count business days');

const pendingBalance = (await leaveService.getBalances()).find((balance) => balance.id === initialBalance.id);
assert.equal(pendingBalance.pendingDays, 5, 'submitted leave should reduce pending balance');

await leaveService.updateRequestStatus(request.id, 'Approved');
const approvedRequest = (await leaveService.getRequests()).find((item) => item.id === request.id);
assert.equal(approvedRequest.status, 'Approved', 'approval should update leave request status');

const approvedBalance = (await leaveService.getBalances()).find((balance) => balance.id === initialBalance.id);
assert.equal(approvedBalance.usedDays, 5, 'approved leave should move to used balance');
assert.equal(approvedBalance.pendingDays, 0, 'approved leave should clear pending balance');
assert.ok(approvedBalance.availableDays < initialBalance.availableDays, 'approved leave should reduce availability');

const availability = await leaveService.getAvailability();
const employeeAvailability = availability.find((row) => row.employeeId === employee.id);
assert.ok(employeeAvailability.approvedLeaveDays >= 5, 'availability report should include approved leave');
assert.ok(employeeAvailability.availabilityHours > 0, 'availability report should calculate annual hours');

const auditLogs = DataStorage.get(STORAGE_KEYS.AUDIT_LOGS, []);
assert.ok(auditLogs.some((log) => log.entityType === 'LeaveRequest' && log.action === 'Submit Leave'), 'leave submission should be audited');
assert.ok(auditLogs.some((log) => log.entityType === 'LeaveRequest' && log.action === 'Approved Leave'), 'leave approval should be audited');

console.log(JSON.stringify({
  status: 'passed',
  employee: employee.employeeId,
  leaveType: annualLeave.code,
  approvedDays: employeeAvailability.approvedLeaveDays,
  availableDays: approvedBalance.availableDays,
}, null, 2));
