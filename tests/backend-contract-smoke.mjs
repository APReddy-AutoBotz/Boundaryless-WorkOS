import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const server = readFileSync('server/index.mjs', 'utf8');
const schema = readFileSync('server/schema.sql', 'utf8');
const leaveMigration = readFileSync('server/migrations/007_workforce_os_leave.sql', 'utf8');
const approvalMigration = readFileSync('server/migrations/008_workforce_os_approvals.sql', 'utf8');
const notificationMigration = readFileSync('server/migrations/009_workforce_os_notifications.sql', 'utf8');
const integrationMigration = readFileSync('server/migrations/010_workforce_os_integrations.sql', 'utf8');
const seedDemo = readFileSync('server/seed-demo.mjs', 'utf8');
const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));

assert.match(schema, /create table if not exists catalog_items/, 'catalog_items table must exist');
assert.match(schema, /catalog_type text not null check/, 'catalog type guard must exist');
assert.match(schema, /idx_catalog_items_type_active/, 'catalog lookup index must exist');

assert.match(server, /app\.get\('\/api\/catalogs\/:catalogType'/, 'catalog GET route must exist');
assert.match(server, /app\.post\('\/api\/catalogs\/:catalogType'/, 'catalog POST route must exist');
assert.match(server, /app\.delete\('\/api\/catalogs\/:catalogType\/:id'/, 'catalog DELETE route must exist');
assert.match(server, /getCatalogUsage/, 'catalog delete usage guard must exist');

assert.match(server, /loginRateLimit/, 'login rate limiter must exist');
assert.match(server, /getPasswordMinLength/, 'password policy helper must exist');
assert.match(server, /getSessionTtlMs/, 'session TTL helper must exist');
assert.match(server, /API_SESSION_TTL_HOURS/, 'session TTL must be configurable through environment');
assert.match(server, /maxAge: getSessionTtlMs\(\)/, 'session cookie must use configured maxAge');
assert.doesNotMatch(server, /Date\.now\(\) \+ 8 \* 60 \* 60 \* 1000/, 'session expiry must not be hardcoded at token issuance');
assert.match(server, /sessionExpiresAt/, 'login and role switching must expose session expiry metadata');
assert.match(server, /app\.post\('\/api\/auth\/change-password'/, 'self-service password change route must exist');
assert.match(server, /app\.post\('\/api\/users\/:id\/password-reset'/, 'admin password reset route must exist');
assert.match(server, /must_change_password/, 'user password lifecycle flag must be persisted');
assert.match(server, /Production startup blocked/, 'production env validation must exist');
assert.match(server, /app\.use\(express\.static\(distDir/, 'server must serve built frontend in production');
assert.match(server, /app\.use\('\/assets', express\.static\(join\(distDir, 'assets'\)/, 'server must serve hashed assets with immutable caching');
assert.equal(packageJson.scripts.start, 'node --import tsx server/start-production.mjs', 'production start script must be configured');
assert.equal(packageJson.scripts['api:seed:demo'], 'node --import tsx server/seed-demo.mjs', 'demo seed script must be configured');
assert.match(seedDemo, /generateDemoDataset/, 'demo seed must reuse canonical demo data generator');
assert.match(seedDemo, /insert into users/, 'demo seed must provision user accounts');
assert.match(seedDemo, /insert into user_roles/, 'demo seed must provision user roles');
assert.match(seedDemo, /insert into timesheets/, 'demo seed must include timesheets');
assert.match(schema, /create table if not exists import_export_logs/, 'import/export history table must exist');
assert.match(server, /app\.post\('\/api\/settings'/, 'settings save route must exist');
assert.match(server, /app\.get\('\/api\/import-export-logs'/, 'import/export history GET route must exist');
assert.match(server, /app\.post\('\/api\/import-export-logs'/, 'import/export history POST route must exist');
assert.match(server, /app\.post\('\/api\/audit-events'/, 'manual audit event POST route must exist for UI exports');
assert.match(server, /app\.post\('\/api\/imports\/employees\/apply'/, 'employee import apply route must exist');
assert.match(server, /app\.post\('\/api\/imports\/clients\/apply'/, 'client import apply route must exist');
assert.match(server, /app\.post\('\/api\/imports\/projects\/apply'/, 'project import apply route must exist');
assert.match(server, /app\.post\('\/api\/imports\/allocations\/apply'/, 'allocation import apply route must exist');
assert.match(server, /app\.post\('\/api\/imports\/timesheets\/apply'/, 'timesheet import apply route must exist');
assert.match(server, /collectDuplicateImportRows/, 'import apply routes must share duplicate-row detection');
assert.match(server, /Duplicate \$\{label \|\| field\} also appears on row/, 'duplicate import rows must return row-level errors');
assert.match(server, /field: 'employeeId'[\s\S]*field: 'email'/, 'employee import must reject duplicate employee IDs and emails within a file');
assert.match(server, /field: 'projectCode'/, 'project import must reject duplicate project codes within a file');
assert.match(server, /field: 'id', value: row\.id, label: 'client ID'[\s\S]*field: 'name', value: row\.name, label: 'client name'/, 'client import must reject duplicate client IDs and names within a file');
assert.match(server, /duplicateImportRows\.duplicateRowNumbers\.has\(rowNumber\)/, 'duplicate import rows must be skipped instead of upserted');
assert.match(server, /json_agg\(json_build_object/, 'timesheet API must include entries');
assert.match(server, /app\.get\('\/api\/reports\/planned-utilization'/, 'planned utilization report route must exist');
assert.match(server, /app\.get\('\/api\/reports\/actual-utilization'/, 'actual utilization report route must exist');
assert.match(server, /app\.get\('\/api\/reports\/forecast-utilization'/, 'forecast utilization report route must exist');
assert.match(server, /app\.get\('\/api\/leave\/requests'/, 'leave request list route must exist');
assert.match(server, /app\.post\('\/api\/leave\/requests'/, 'leave request submit route must exist');
assert.match(server, /app\.patch\('\/api\/leave\/requests\/:id\/status'/, 'leave approval route must exist');
assert.match(server, /app\.get\('\/api\/holiday-calendars'/, 'holiday calendar route must exist');
assert.match(server, /app\.get\('\/api\/reports\/availability'/, 'availability report route must exist');
assert.match(leaveMigration, /create table if not exists leave_requests/, 'leave migration must create leave requests');
assert.match(leaveMigration, /create table if not exists leave_balances/, 'leave migration must create leave balances');
assert.match(server, /app\.get\('\/api\/approvals'/, 'approval inbox route must exist');
assert.match(server, /app\.patch\('\/api\/approvals\/:id\/status'/, 'generic approval decision route must exist');
assert.match(server, /app\.get\('\/api\/approval-delegations'/, 'approval delegation route must exist');
assert.match(server, /app\.get\('\/api\/reports\/approval-sla'/, 'approval SLA report route must exist');
assert.match(approvalMigration, /create table if not exists approval_records/, 'approval migration must create approval records');
assert.match(approvalMigration, /create table if not exists approval_delegations/, 'approval migration must create approval delegations');
assert.match(server, /app\.get\('\/api\/notifications'/, 'notification inbox route must exist');
assert.match(server, /app\.patch\('\/api\/notifications\/:id\/read'/, 'notification read route must exist');
assert.match(server, /app\.get\('\/api\/notification-templates'/, 'notification template route must exist');
assert.match(server, /app\.get\('\/api\/notification-preferences'/, 'notification preference route must exist');
assert.match(server, /app\.get\('\/api\/notification-delivery-attempts'/, 'notification delivery monitoring route must exist');
assert.match(notificationMigration, /create table if not exists notification_events/, 'notification migration must create events');
assert.match(notificationMigration, /create table if not exists notification_delivery_attempts/, 'notification migration must create delivery attempts');
assert.match(server, /app\.get\('\/api\/integrations\/identity-links'/, 'identity provider link route must exist');
assert.match(server, /app\.post\('\/api\/integrations\/identity-links'/, 'identity provider link save route must exist');
assert.match(server, /app\.get\('\/api\/integrations\/entra-role-mappings'/, 'Entra role mapping route must exist');
assert.match(server, /app\.get\('\/api\/integrations\/teams-user-links'/, 'Teams user link route must exist');
assert.match(server, /app\.post\('\/api\/integrations\/teams-action-tokens'/, 'Teams action token creation route must exist');
assert.match(server, /app\.post\('\/api\/integrations\/teams-action-tokens\/:token\/execute'/, 'Teams action token execution route must exist');
assert.match(server, /app\.get\('\/api\/integrations\/health'/, 'integration health route must exist');
assert.match(integrationMigration, /create table if not exists identity_provider_links/, 'integration migration must create identity provider links');
assert.match(integrationMigration, /create table if not exists teams_action_tokens/, 'integration migration must create Teams action tokens');
assert.match(integrationMigration, /action text not null check \(action in \('approve', 'reject', 'open_portal'\)\)/, 'Teams action tokens must be deterministic action-only');
assert.match(server, /buildEmployeeScopeWhere/, 'report endpoints must reuse backend employee scoping');

console.log(JSON.stringify({
  status: 'passed',
  catalogRoutes: true,
  productionStaticServing: true,
  loginRateLimit: true,
  passwordLifecycle: true,
  demoSeed: true,
  reportRoutes: true,
  leaveRoutes: true,
  approvalRoutes: true,
  notificationRoutes: true,
  integrationRoutes: true,
  employeeImportApply: true,
  clientImportApply: true,
  projectImportApply: true,
  allocationImportApply: true,
  timesheetImportApply: true,
}, null, 2));
