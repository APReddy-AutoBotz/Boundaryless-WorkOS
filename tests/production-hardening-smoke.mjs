import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const server = readFileSync('server/index.mjs', 'utf8');
const schema = readFileSync('server/schema.sql', 'utf8');
const migrate = readFileSync('server/migrate.mjs', 'utf8');
const apiClient = readFileSync('src/services/apiClient.ts', 'utf8');
const login = readFileSync('src/pages/Login.tsx', 'utf8');
const app = readFileSync('src/App.tsx', 'utf8');
const header = readFileSync('src/components/Layout/Header.tsx', 'utf8');
const requirements = readFileSync('Boundaryless-WorkOS_Requirements.md', 'utf8');
const technicalStatus = readFileSync('Boundaryless-WorkOS_Technical_Status.md', 'utf8');
const handoverChecklist = readFileSync('BOUNDARYLESS_WORKOS_PRODUCTION_HANDOVER_CHECKLIST.md', 'utf8');
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
assert.match(server, /app\.post\('\/api\/audit-events'/, 'backend audit event endpoint must exist for UI-triggered exports');
assert.match(server, /action: z\.enum\(\['Export', 'Import', 'Notify'\]\)/, 'client audit events must be constrained to approved UI event actions');
assert.doesNotMatch(server, /source: z\.string\(\)\.max\(40\)\.optional\(\)/, 'client audit events must not accept arbitrary source values');
assert.match(server, /Missing reporting manager/, 'data quality report must detect missing reporting manager');
assert.match(server, /Demo data remnant/, 'data quality report must detect demo data remnants');
assert.match(app, /\/reports\/data-quality/, 'data quality report must have a routed UI page');
assert.match(header, /authService\.switchRole/, 'header must expose active-role switching for multi-role users');

assert.match(migrate, /serverDir, 'migrations'/, 'migration runner must apply versioned migration files');
assert.ok(existsSync('server/migrations/006_boundaryless_workos_prod_core.sql'), 'Boundaryless-WorkOS production-core migration must exist');

assert.match(requirements, /Single source of truth for product scope, production-core requirements, implementation status, and next technical plan\./, 'requirements document must be the BRD source of truth');
assert.match(requirements, /## 8\. Completed vs Pending Status/, 'requirements must mark completed and pending status');
assert.match(requirements, /## 9\. Updated Technical Plan/, 'requirements must include the updated technical plan');
assert.match(requirements, /Leave management workflow[\s\S]*Microsoft Teams bot[\s\S]*Microsoft Entra SSO[\s\S]*Email\/Teams notification delivery engine/, 'Production Core must explicitly defer leave, Teams, Entra, and notifications');
assert.match(requirements, /Long-Term Module[\s\S]*Leave Management[\s\S]*Pending[\s\S]*Microsoft Teams[\s\S]*Pending[\s\S]*Microsoft Entra SSO[\s\S]*Pending/, 'long-term BRD roadmap must preserve deferred strategic modules');
assert.match(requirements, /APP_MODE=production\|demo[\s\S]*DISABLE_DEMO_FALLBACK=true\|false[\s\S]*AUTO_SEED_DEMO=false/, 'requirements must document production environment safety flags');
assert.match(requirements, /Multi-role users cannot use inactive roles to bypass permissions/, 'requirements must retain active-role UAT acceptance');
assert.match(technicalStatus, /avoid a second, conflicting source of truth/, 'technical status must not duplicate the BRD source of truth');
assert.match(handoverChecklist, /APP_MODE=production[\s\S]*DISABLE_DEMO_FALLBACK=true[\s\S]*AUTO_SEED_DEMO=false/, 'handover checklist must require production-safe environment flags');

assert.equal(packageJson.dependencies['@google/genai'], undefined, 'unused Gemini dependency must be removed');

console.log(JSON.stringify({
  status: 'passed',
  activeRoleOnly: true,
  demoFallbackGuard: true,
  boundarylessWorkOSSchema: true,
  dataQualityReport: true,
  versionedMigrations: true,
  sourceOfTruthBrd: true,
}, null, 2));
