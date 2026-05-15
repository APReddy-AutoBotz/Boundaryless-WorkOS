import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const server = readFileSync('server/index.mjs', 'utf8');
const schema = readFileSync('server/schema.sql', 'utf8');
const migrate = readFileSync('server/migrate.mjs', 'utf8');
const apiClient = readFileSync('src/services/apiClient.ts', 'utf8');
const login = readFileSync('src/pages/Login.tsx', 'utf8');
const app = readFileSync('src/App.tsx', 'utf8');
const header = readFileSync('src/components/Layout/Header.tsx', 'utf8');
const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));

assert.match(server, /const requireRoles = \(\.\.\.roles\) => \(req, res, next\) => \{[\s\S]*!roles\.includes\(activeRole\)/, 'backend role guard must enforce activeRole only');
assert.doesNotMatch(server, /roles\.some\(role => userRoles\.has\(role\)\)/, 'backend role guard must not allow inactive assigned roles to bypass activeRole');

assert.match(apiClient, /isDemoFallbackAllowed/, 'frontend must expose demo fallback guard');
assert.match(apiClient, /Backend API is required because demo fallback is disabled/, 'disabled demo fallback must fail closed when backend is unavailable');
assert.match(login, /showDemoShortcuts/, 'login page must hide UAT shortcuts when demo fallback is disabled');

for (const column of [
  'reporting_manager_id',
  'joining_date',
  'exit_date',
  'standard_weekly_hours',
  'capacity_type',
  'contract_type',
  'leave_policy_id',
  'entra_object_id',
  'teams_user_id',
  'active_role',
  'source',
  'ip_address',
  'session_id',
]) {
  assert.match(schema, new RegExp(column), `schema must include ${column}`);
}

assert.match(server, /app\.get\('\/api\/reports\/data-quality'/, 'data quality report endpoint must exist');
assert.match(server, /app\.get\('\/api\/reports\/dashboard'/, 'dashboard report endpoint must exist');
assert.match(server, /app\.post\('\/api\/auth\/switch-role'/, 'backend active-role switch endpoint must exist');
assert.match(server, /Missing reporting manager/, 'data quality report must detect missing reporting manager');
assert.match(server, /Demo data remnant/, 'data quality report must detect demo data remnants');
assert.match(app, /\/reports\/data-quality/, 'data quality report must have a routed UI page');
assert.match(header, /authService\.switchRole/, 'header must expose active-role switching for multi-role users');

assert.match(migrate, /serverDir, 'migrations'/, 'migration runner must apply versioned migration files');
assert.ok(existsSync('server/migrations/006_boundaryless_workos_prod_core.sql'), 'Boundaryless-WorkOS production-core migration must exist');

assert.equal(packageJson.dependencies['@google/genai'], undefined, 'unused Gemini dependency must be removed');

console.log(JSON.stringify({
  status: 'passed',
  activeRoleOnly: true,
  demoFallbackGuard: true,
  boundarylessWorkOSSchema: true,
  dataQualityReport: true,
  versionedMigrations: true,
}, null, 2));
