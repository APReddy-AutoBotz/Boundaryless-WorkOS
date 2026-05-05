process.env.NODE_ENV = 'production';

if (process.env.AUTO_MIGRATE === 'true') {
  console.log('AUTO_MIGRATE=true; running database migrations before startup.');
  await import('./migrate.mjs');
  if (process.exitCode && process.exitCode !== 0) {
    process.exit(process.exitCode);
  }
}

if (process.env.AUTO_SEED_DEMO === 'true') {
  console.log('AUTO_SEED_DEMO=true; seeding demo data before startup.');
  await import('./seed-demo.mjs');
  if (process.exitCode && process.exitCode !== 0) {
    process.exit(process.exitCode);
  }
}

await import('./index.mjs');
