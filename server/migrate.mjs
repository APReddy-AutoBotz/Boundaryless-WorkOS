import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Pool } = pg;

const serverDir = dirname(fileURLToPath(import.meta.url));
const migrationId = '005_auth_lifecycle';

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

  const applied = await client.query('select 1 from schema_migrations where id = $1', [migrationId]);
  if (applied.rowCount === 0) {
    const schemaSql = await readFile(join(serverDir, 'schema.sql'), 'utf8');
    await client.query(schemaSql);
    await client.query('insert into schema_migrations (id) values ($1)', [migrationId]);
    console.log(`Applied migration ${migrationId}`);
  } else {
    console.log(`Migration ${migrationId} already applied`);
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
