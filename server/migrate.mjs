import 'dotenv/config';
import { readdir } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Pool } = pg;

const serverDir = dirname(fileURLToPath(import.meta.url));
const baselineMigrationId = '005_auth_lifecycle';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required to run database migrations.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined,
});

const client = await pool.connect();

try {
  await client.query('begin');
  await client.query(`
    create table if not exists schema_migrations (
      id text primary key,
      applied_at timestamptz not null default now()
    )
  `);

  const applied = await client.query('select 1 from schema_migrations where id = $1', [baselineMigrationId]);
  if (applied.rowCount === 0) {
    const schemaSql = await readFile(join(serverDir, 'schema.sql'), 'utf8');
    await client.query(schemaSql);
    await client.query('insert into schema_migrations (id) values ($1)', [baselineMigrationId]);
    console.log(`Applied migration ${baselineMigrationId}`);
  } else {
    console.log(`Migration ${baselineMigrationId} already applied`);
  }

  const migrationsDir = join(serverDir, 'migrations');
  const migrationFiles = (await readdir(migrationsDir).catch(() => []))
    .filter(file => file.endsWith('.sql'))
    .sort();

  for (const file of migrationFiles) {
    const migrationId = file.replace(/\.sql$/, '');
    const fileApplied = await client.query('select 1 from schema_migrations where id = $1', [migrationId]);
    if (fileApplied.rowCount > 0) {
      console.log(`Migration ${migrationId} already applied`);
      continue;
    }
    const sql = await readFile(join(migrationsDir, file), 'utf8');
    await client.query(sql);
    await client.query('insert into schema_migrations (id) values ($1)', [migrationId]);
    console.log(`Applied migration ${migrationId}`);
  }

  await client.query('commit');
} catch (error) {
  await client.query('rollback');
  console.error('Migration failed:', error);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
