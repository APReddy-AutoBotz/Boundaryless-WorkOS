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
assert.match(server, /Production startup blocked/, 'production env validation must exist');
assert.match(server, /express\.static\(distDir\)/, 'server must serve built frontend in production');
assert.equal(packageJson.scripts.start, 'node server/start-production.mjs', 'production start script must be configured');
assert.equal(packageJson.scripts['api:seed:demo'], 'node --import tsx server/seed-demo.mjs', 'demo seed script must be configured');
assert.match(seedDemo, /generateDemoDataset/, 'demo seed must reuse canonical demo data generator');
assert.match(seedDemo, /insert into users/, 'demo seed must provision user accounts');
assert.match(seedDemo, /insert into user_roles/, 'demo seed must provision user roles');
assert.match(seedDemo, /insert into timesheets/, 'demo seed must include timesheets');

console.log(JSON.stringify({
  status: 'passed',
  catalogRoutes: true,
  productionStaticServing: true,
  loginRateLimit: true,
  demoSeed: true,
}, null, 2));
