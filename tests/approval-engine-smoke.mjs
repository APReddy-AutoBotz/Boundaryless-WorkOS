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
const { employeeService, projectService, timesheetService, leaveService, approvalService } = await import('../src/services/api.ts');

DataStorage.resetDemoData();
await authService.login('admin-1', 'demo123');

const employees = await employeeService.getAll();
const employee = employees.find((item) => item.status === 'Active' && item.employeeId.startsWith('BL-')) || employees[0];
const projects = await projectService.getAll();
const project = projects.find((item) => item.status === 'Active') || projects[0];

await timesheetService.save({
  employeeId: employee.id,
  employeeName: employee.name,
  weekEnding: '2026-05-08',
  totalHours: 8,
  billableHours: 8,
  status: 'Submitted',
  entries: [{
    id: 'approval-smoke-entry-1',
    employeeId: employee.id,
    projectId: project.id,
    projectName: project.name,
    workType: 'Project Work',
    date: '2026-05-04',
    hours: 8,
    remark: 'Approval engine smoke',
    status: 'Submitted',
    billable: true,
    weekEnding: '2026-05-08',
  }],
});

let approvals = await approvalService.getAll();
const timesheetApproval = approvals.find((record) => record.entityType === 'Timesheet' && record.status === 'Pending');
assert.ok(timesheetApproval, 'submitted timesheets should create pending approval records');

await approvalService.decide(timesheetApproval.id, 'Approved');
approvals = await approvalService.getAll();
assert.equal(approvals.find((record) => record.id === timesheetApproval.id).status, 'Approved', 'generic approval decision should update timesheet approval record');
assert.ok((await timesheetService.getAll()).some((timesheet) => timesheet.status === 'Approved' && timesheet.weekEnding === '2026-05-08'), 'generic approval decision should update linked timesheet');

const leaveTypes = await leaveService.getTypes();
const leaveRequest = await leaveService.submitRequest({
  id: '',
  employeeId: employee.id,
  leaveTypeId: leaveTypes[0].id,
  startDate: '2026-06-08',
  endDate: '2026-06-09',
  totalDays: 0,
  status: 'Submitted',
  reason: 'Approval engine leave smoke',
});

approvals = await approvalService.getAll();
const leaveApproval = approvals.find((record) => record.entityType === 'LeaveRequest' && record.entityId === leaveRequest.id);
assert.ok(leaveApproval, 'submitted leave should create pending approval records');

await approvalService.decide(leaveApproval.id, 'Rejected', 'Rejected by approval smoke');
approvals = await approvalService.getAll();
assert.equal(approvals.find((record) => record.id === leaveApproval.id).status, 'Rejected', 'generic approval decision should update leave approval record');
assert.equal((await leaveService.getRequests()).find((request) => request.id === leaveRequest.id).status, 'Rejected', 'generic approval decision should update linked leave request');

const sla = await approvalService.getSlaReport();
assert.ok(Array.isArray(sla.rows), 'approval SLA report should return rows');
assert.ok(sla.rows.length >= 2, 'approval SLA report should include approval history');

console.log(JSON.stringify({
  status: 'passed',
  approvals: approvals.length,
  timesheetApproval: 'Approved',
  leaveApproval: 'Rejected',
  slaRows: sla.rows.length,
}, null, 2));
