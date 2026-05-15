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
const { employeeService, leaveService, approvalService, notificationService } = await import('../src/services/api.ts');

DataStorage.resetDemoData();
await authService.login('admin-1', 'demo123');

const employee = (await employeeService.getAll()).find((item) =>
  item.status === 'Active' &&
  !item.employeeId.startsWith('ADMIN-') &&
  !item.employeeId.startsWith('HR-') &&
  !item.employeeId.startsWith('CD-')
);
const leaveType = (await leaveService.getTypes())[0];

const request = await leaveService.submitRequest({
  id: '',
  employeeId: employee.id,
  leaveTypeId: leaveType.id,
  startDate: '2026-07-01',
  endDate: '2026-07-02',
  totalDays: 0,
  status: 'Submitted',
  reason: 'Notification smoke',
});

let notifications = await notificationService.getAll();
assert.ok(notifications.some((event) => event.eventType === 'ApprovalRequested' && event.entityId === request.id), 'approval request should create notification event');

const approval = (await approvalService.getAll()).find((record) => record.entityType === 'LeaveRequest' && record.entityId === request.id);
await approvalService.decide(approval.id, 'Approved');

notifications = await notificationService.getAll();
assert.ok(notifications.some((event) => event.eventType === 'ApprovalDecided' && event.entityId === request.id), 'approval decision should create notification event');

const unread = notifications.find((event) => !event.readAt);
await notificationService.markRead(unread.id);
assert.ok((await notificationService.getAll()).find((event) => event.id === unread.id).readAt, 'notification read API should mark event as read');

const templates = await notificationService.getTemplates();
assert.ok(templates.length >= 2, 'notification templates should be seeded');
await notificationService.saveTemplate({ ...templates[0], active: !templates[0].active });
assert.equal((await notificationService.getTemplates()).find((template) => template.id === templates[0].id).active, !templates[0].active, 'notification templates should be editable');

const attempts = await notificationService.getDeliveryAttempts();
assert.ok(attempts.length >= 2, 'notification sends should write delivery attempts');
assert.ok(attempts.every((attempt) => attempt.provider === 'mock'), 'local notification delivery should use mock provider');

console.log(JSON.stringify({
  status: 'passed',
  notifications: notifications.length,
  templates: templates.length,
  deliveryAttempts: attempts.length,
}, null, 2));
