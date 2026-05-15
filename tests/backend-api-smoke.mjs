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
const [dataQualityReport, dashboardReport] = await Promise.all([
  request('/api/reports/data-quality'),
  request('/api/reports/dashboard'),
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
assert.equal(typeof dataQualityReport.score, 'number', 'data-quality report should include a score');
assert.equal(typeof dataQualityReport.totalRecords, 'number', 'data-quality report should include total record count');
assert.equal(typeof dataQualityReport.issueCount, 'number', 'data-quality report should include issue count');
assert.ok(Array.isArray(dataQualityReport.issues), 'data-quality report should include issue rows');
assert.ok(dataQualityReport.generatedAt, 'data-quality report should include generated timestamp');
assert.ok(dashboardReport.generatedAt, 'dashboard report should include generated timestamp');
assert.equal(typeof dashboardReport.workforce?.active_people, 'number', 'dashboard report should include active workforce count');
assert.equal(typeof dashboardReport.workforce?.utilization_eligible_fte, 'number', 'dashboard report should include utilization-eligible FTE');
assert.equal(typeof dashboardReport.workforce?.governance_users, 'number', 'dashboard report should include governance user count');
assert.equal(typeof dashboardReport.projectStaffingRisks, 'number', 'dashboard report should include project staffing risk count');
assert.equal(typeof dashboardReport.pendingTimesheets, 'number', 'dashboard report should include pending timesheet count');
assert.equal(typeof dashboardReport.dataQuality?.score, 'number', 'dashboard report should embed data-quality score');

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
  dataQualityScore: dataQualityReport.score,
  dashboardActivePeople: dashboardReport.workforce.active_people,
  mutations: allowMutations,
}, null, 2));
