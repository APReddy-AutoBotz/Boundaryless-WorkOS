import assert from 'node:assert/strict';

const baseUrl = process.env.BACKEND_SMOKE_BASE_URL;
const allowMutations = process.env.BACKEND_SMOKE_MUTATIONS === 'true';

if (!baseUrl) {
  console.log(JSON.stringify({
    status: 'skipped',
    reason: 'Set BACKEND_SMOKE_BASE_URL to run backend API smoke tests',
  }, null, 2));
  process.exit(0);
}

const headers = { 'Content-Type': 'application/json' };
let token = '';

const request = async (path, options = {}) => {
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      ...headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${options.method || 'GET'} ${path} failed with ${res.status}: ${JSON.stringify(body)}`);
  }
  return body;
};

const health = await request('/api/health');
assert.equal(health.database, 'connected', 'backend smoke requires connected database');

const login = await request('/api/auth/login', {
  method: 'POST',
  body: JSON.stringify({
    username: process.env.BACKEND_SMOKE_USERNAME || 'admin-1',
    password: process.env.BACKEND_SMOKE_PASSWORD || 'demo123',
    requestedRole: 'Admin',
  }),
});
assert.ok(login.token, 'login must return a token');
token = login.token;

const [employees, projects, clients, allocations, timesheets, settings] = await Promise.all([
  request('/api/employees'),
  request('/api/projects'),
  request('/api/clients'),
  request('/api/allocations'),
  request('/api/timesheets'),
  request('/api/settings'),
]);

const [plannedReport, actualReport, forecastReport] = await Promise.all([
  request('/api/reports/planned-utilization'),
  request('/api/reports/actual-utilization'),
  request('/api/reports/forecast-utilization?months=3'),
]);

assert.ok(employees.length > 0, 'employees endpoint should return seeded records');
assert.ok(projects.length > 0, 'projects endpoint should return seeded records');
assert.ok(clients.length > 0, 'clients endpoint should return seeded records');
assert.ok(allocations.length > 0, 'allocations endpoint should return seeded records');
assert.ok(timesheets.length > 0, 'timesheets endpoint should return seeded records');
assert.ok(Array.isArray(timesheets[0].entries), 'timesheets should include entries array');
assert.ok(settings.some(row => row.key === 'expectedWeeklyHours'), 'settings endpoint should include expectedWeeklyHours');
assert.equal(plannedReport.mode, 'planned', 'planned report should identify its mode');
assert.equal(actualReport.mode, 'actual', 'actual report should identify its mode');
assert.equal(forecastReport.mode, 'forecast', 'forecast report should identify its mode');
assert.ok(Array.isArray(plannedReport.rows), 'planned report should include rows');
assert.ok(Array.isArray(actualReport.rows), 'actual report should include rows');
assert.ok(Array.isArray(forecastReport.rows), 'forecast report should include rows');
assert.ok(plannedReport.summary.rows > 0, 'planned report should summarize utilization rows');

if (allowMutations) {
  const settingsMap = Object.fromEntries(settings.map(row => [row.key, row.value]));
  await request('/api/settings', {
    method: 'POST',
    body: JSON.stringify({
      expectedWeeklyHours: Number(settingsMap.expectedWeeklyHours ?? 40),
      utilizationThresholdHigh: Number(settingsMap.utilizationThresholdHigh ?? 100),
      utilizationThresholdLow: Number(settingsMap.utilizationThresholdLow ?? 80),
      benchThreshold: Number(settingsMap.benchThreshold ?? 20),
      timesheetPolicyMaxHours: Number(settingsMap.timesheetPolicyMaxHours ?? 40),
      blockOverAllocation: Boolean(settingsMap.blockOverAllocation),
      demoSubmissionMode: Boolean(settingsMap.demoSubmissionMode),
      currency: String(settingsMap.currency ?? 'GBP'),
    }),
  });
}

console.log(JSON.stringify({
  status: 'passed',
  employees: employees.length,
  projects: projects.length,
  clients: clients.length,
  allocations: allocations.length,
  timesheets: timesheets.length,
  reportRows: plannedReport.summary.rows,
  mutations: allowMutations,
}, null, 2));
