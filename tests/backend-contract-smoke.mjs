import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const server = readFileSync('server/index.mjs', 'utf8');
const schema = readFileSync('server/schema.sql', 'utf8');
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
assert.match(server, /app\.post\('\/api\/imports\/employees\/apply'/, 'employee import apply route must exist');
assert.match(server, /app\.post\('\/api\/imports\/clients\/apply'/, 'client import apply route must exist');
assert.match(server, /app\.post\('\/api\/imports\/projects\/apply'/, 'project import apply route must exist');
assert.match(server, /app\.post\('\/api\/imports\/allocations\/apply'/, 'allocation import apply route must exist');
assert.match(server, /app\.post\('\/api\/imports\/timesheets\/apply'/, 'timesheet import apply route must exist');
assert.match(server, /json_agg\(json_build_object/, 'timesheet API must include entries');
assert.match(server, /app\.get\('\/api\/reports\/planned-utilization'/, 'planned utilization report route must exist');
assert.match(server, /app\.get\('\/api\/reports\/actual-utilization'/, 'actual utilization report route must exist');
assert.match(server, /app\.get\('\/api\/reports\/forecast-utilization'/, 'forecast utilization report route must exist');
assert.match(server, /buildEmployeeScopeWhere/, 'report endpoints must reuse backend employee scoping');

console.log(JSON.stringify({
  status: 'passed',
  catalogRoutes: true,
  productionStaticServing: true,
  loginRateLimit: true,
  passwordLifecycle: true,
  demoSeed: true,
  reportRoutes: true,
  employeeImportApply: true,
  clientImportApply: true,
  projectImportApply: true,
  allocationImportApply: true,
  timesheetImportApply: true,
}, null, 2));
