import assert from 'node:assert/strict';

const baseUrl = process.env.BACKEND_SMOKE_BASE_URL;
const password = process.env.BACKEND_SMOKE_PASSWORD || 'demo123';

if (!baseUrl) {
  console.log(JSON.stringify({
    status: 'skipped',
    reason: 'Set BACKEND_SMOKE_BASE_URL to run multi-role backend smoke tests',
  }, null, 2));
  process.exit(0);
}

const roleConfigs = [
  { label: 'Admin', username: process.env.BACKEND_SMOKE_ADMIN_USERNAME || 'admin-1', requestedRole: 'Admin', required: true },
  { label: 'HR', username: process.env.BACKEND_SMOKE_HR_USERNAME || 'hr-1', requestedRole: 'HR', required: true },
  { label: 'ProjectManager', username: process.env.BACKEND_SMOKE_PM_USERNAME || 'pm-1', requestedRole: 'ProjectManager', required: true },
  { label: 'CountryDirector', username: process.env.BACKEND_SMOKE_CD_USERNAME || 'cd-1', requestedRole: 'CountryDirector', required: true },
  { label: 'Employee', username: process.env.BACKEND_SMOKE_EMPLOYEE_USERNAME || 'emp-1', requestedRole: 'Employee', required: true },
  { label: 'TeamLead', username: process.env.BACKEND_SMOKE_TEAMLEAD_USERNAME, requestedRole: 'TeamLead', required: false },
].filter(role => role.required || role.username);

const request = async (path, { token = '', expectedStatus, ...options } = {}) => {
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (expectedStatus !== undefined) {
    assert.equal(res.status, expectedStatus, `${options.method || 'GET'} ${path} should return ${expectedStatus}; got ${res.status}: ${JSON.stringify(body)}`);
    return body;
  }
  if (!res.ok) {
    throw new Error(`${options.method || 'GET'} ${path} failed with ${res.status}: ${JSON.stringify(body)}`);
  }
  return body;
};

const login = async ({ label, username, requestedRole }) => {
  const body = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password, requestedRole }),
  });
  assert.ok(body.token, `${label} login should return token`);
  assert.equal(body.activeRole, requestedRole, `${label} login should activate requested role`);
  assert.ok(Array.isArray(body.roles), `${label} login should return role list`);
  assert.equal(typeof body.mustChangePassword, 'boolean', `${label} login should expose password lifecycle flag`);
  return body;
};

const sessions = new Map();
for (const config of roleConfigs) {
  sessions.set(config.label, await login(config));
}

await request('/api/auth/login', {
  method: 'POST',
  body: JSON.stringify({ username: roleConfigs[0].username, password: 'wrong-password', requestedRole: roleConfigs[0].requestedRole }),
  expectedStatus: 401,
});

const expectGet = async (label, path, status = 200) => {
  await request(path, { token: sessions.get(label).token, expectedStatus: status });
};

for (const label of sessions.keys()) {
  await expectGet(label, '/api/auth/me');
  await expectGet(label, '/api/employees');
  await expectGet(label, '/api/projects');
  await expectGet(label, '/api/allocations');
  await expectGet(label, '/api/timesheets');
  await expectGet(label, '/api/settings');
  await expectGet(label, '/api/reports/planned-utilization');
  await expectGet(label, '/api/reports/actual-utilization');
  await expectGet(label, '/api/reports/forecast-utilization?months=3');
}

await expectGet('Admin', '/api/audit-logs');
await expectGet('Admin', '/api/import-export-logs');

if (sessions.has('HR')) {
  await expectGet('HR', '/api/audit-logs', 403);
  await expectGet('HR', '/api/import-export-logs');
}

for (const label of ['ProjectManager', 'CountryDirector', 'Employee', 'TeamLead']) {
  if (!sessions.has(label)) continue;
  await expectGet(label, '/api/audit-logs', 403);
  await expectGet(label, '/api/import-export-logs', 403);
  await request('/api/users/admin-1/password-reset', {
    token: sessions.get(label).token,
    method: 'POST',
    body: JSON.stringify({ newPassword: 'NotAllowed123', mustChangePassword: true }),
    expectedStatus: 403,
  });
}

const adminEmployees = await request('/api/employees', { token: sessions.get('Admin').token });
const employeeEmployees = await request('/api/employees', { token: sessions.get('Employee').token });
assert.ok(adminEmployees.length >= employeeEmployees.length, 'employee scope should not exceed admin employee scope');
assert.ok(employeeEmployees.length >= 1, 'employee should see at least their own employee record');

const teamLeadStatus = sessions.has('TeamLead') ? 'covered' : 'skipped: set BACKEND_SMOKE_TEAMLEAD_USERNAME after a TeamLead user is seeded';

console.log(JSON.stringify({
  status: 'passed',
  checkedRoles: Array.from(sessions.keys()),
  teamLead: teamLeadStatus,
  adminEmployees: adminEmployees.length,
  employeeEmployees: employeeEmployees.length,
  mutations: false,
}, null, 2));
