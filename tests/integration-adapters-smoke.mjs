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
const { employeeService, leaveService, approvalService, integrationService } = await import('../src/services/api.ts');

DataStorage.resetDemoData();
await authService.login('admin-1', 'demo123');

const employee = (await employeeService.getAll()).find((item) =>
  item.status === 'Active' &&
  !item.employeeId.startsWith('ADMIN-') &&
  !item.employeeId.startsWith('HR-') &&
  !item.employeeId.startsWith('CD-')
);
assert.ok(employee, 'active employee fixture should exist');

const identityLink = await integrationService.saveIdentityLink({
  id: `identity-link-${employee.id}`,
  employeeId: employee.id,
  employeeName: employee.name,
  provider: 'entra',
  providerSubject: `entra-${employee.employeeId}`,
  providerUpn: employee.email,
  status: 'Linked',
});
assert.equal(identityLink.providerSubject, `entra-${employee.employeeId}`, 'identity link should persist provider subject');
assert.equal((await employeeService.getById(employee.id)).entraObjectId, identityLink.providerSubject, 'identity link should update employee identity placeholder');

const roleMapping = await integrationService.saveEntraRoleMapping({
  id: 'entra-role-map-smoke-admin',
  groupId: 'mock-smoke-admin',
  groupName: 'Mock Smoke Admins',
  roleName: 'Admin',
  active: true,
});
assert.equal(roleMapping.roleName, 'Admin', 'Entra role mapping should persist target role');

const teamsLink = await integrationService.saveTeamsUserLink({
  id: `teams-link-${employee.id}`,
  employeeId: employee.id,
  employeeName: employee.name,
  teamsUserId: `teams-${employee.employeeId}`,
  teamsUpn: employee.email,
  teamsTenantId: 'mock-tenant',
  status: 'Linked',
});
assert.equal((await employeeService.getById(employee.id)).teamsUserId, teamsLink.teamsUserId, 'Teams link should update employee Teams placeholder');

const leaveType = (await leaveService.getTypes())[0];
const request = await leaveService.submitRequest({
  id: '',
  employeeId: employee.id,
  leaveTypeId: leaveType.id,
  startDate: '2026-08-03',
  endDate: '2026-08-04',
  totalDays: 0,
  status: 'Submitted',
  reason: 'Teams action smoke',
});
const approval = (await approvalService.getAll()).find((record) => record.entityType === 'LeaveRequest' && record.entityId === request.id);
assert.ok(approval, 'leave request should create approval record');

const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
const actionToken = await integrationService.createTeamsActionToken({
  entityType: 'ApprovalRecord',
  entityId: approval.id,
  action: 'approve',
  expiresAt,
});
assert.equal(actionToken.action, 'approve', 'Teams action token should allow deterministic approval action');

const executedToken = await integrationService.executeTeamsActionToken(actionToken.token, 'Approved through mock Teams action.');
assert.ok(executedToken.usedAt, 'executed Teams action token should be marked used');
assert.equal((await approvalService.getAll()).find((record) => record.id === approval.id).status, 'Approved', 'Teams approval action should update approval status');

const portalToken = await integrationService.createTeamsActionToken({
  entityType: 'PortalLink',
  entityId: 'workforce-portal',
  action: 'open_portal',
  targetUrl: '/approvals',
  expiresAt,
});
assert.equal((await integrationService.executeTeamsActionToken(portalToken.token)).action, 'open_portal', 'Teams open portal action should execute deterministically');

const health = await integrationService.getHealth();
assert.ok(health.linkedIdentityCount >= 1, 'integration health should count identity links');
assert.ok(health.linkedTeamsCount >= 1, 'integration health should count Teams links');
assert.ok(health.activeRoleMappings >= 6, 'integration health should count default and saved role mappings');

const events = await integrationService.getIntegrationEvents();
assert.ok(events.some((event) => event.eventType === 'IdentityLinkUpserted'), 'identity link should write integration event log');
assert.ok(events.some((event) => event.eventType === 'TeamsActionTokenExecuted'), 'Teams token execution should write integration event log');

console.log(JSON.stringify({
  status: 'passed',
  identityLinks: (await integrationService.getIdentityLinks()).length,
  teamsLinks: (await integrationService.getTeamsUserLinks()).length,
  events: events.length,
}, null, 2));
