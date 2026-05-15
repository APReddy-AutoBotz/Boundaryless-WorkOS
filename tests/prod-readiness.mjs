import { spawnSync } from 'node:child_process';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const steps = [
  ['lint'],
  ['build'],
  ['test:backend'],
  ['test:access'],
  ['test:leave'],
  ['test:approvals'],
  ['test:requirements'],
  ['test:import-templates'],
  ['test:prod-hardening'],
  ['test:backend-api'],
  ['test:backend-roles'],
];

const results = [];
for (const [script] of steps) {
  const startedAt = Date.now();
  const result = spawnSync(npm, ['run', script], {
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32',
  });
  results.push({ script, status: result.status === 0 ? 'passed' : 'failed', durationMs: Date.now() - startedAt });
  if (result.status !== 0) {
    console.error(JSON.stringify({ status: 'failed', failedScript: script, results }, null, 2));
    process.exit(result.status || 1);
  }
}

console.log(JSON.stringify({
  status: 'passed',
  backendUrl: process.env.BACKEND_SMOKE_BASE_URL || 'not set; hosted backend smokes skipped',
  results,
}, null, 2));
