import 'dotenv/config';
import crypto from 'node:crypto';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express from 'express';
import pg from 'pg';
import { z } from 'zod';

const { Pool } = pg;

const serverDir = dirname(fileURLToPath(import.meta.url));
const distDir = join(serverDir, '..', 'dist');
const isProduction = process.env.NODE_ENV === 'production';
const sessionSecret = process.env.API_SESSION_SECRET || 'dev-only-change-me';

if (isProduction) {
  const missing = [];
  if (!process.env.DATABASE_URL) missing.push('DATABASE_URL');
  if (!process.env.API_SESSION_SECRET || process.env.API_SESSION_SECRET === 'dev-only-change-me') missing.push('API_SESSION_SECRET');
  if (missing.length > 0) {
    console.error(`Production startup blocked. Missing or unsafe environment variable(s): ${missing.join(', ')}`);
    process.exit(1);
  }
}

const app = express();
const port = Number(process.env.PORT || process.env.API_PORT || 4000);
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined,
});

app.set('trust proxy', 1);
app.use(cors({ origin: process.env.APP_URL || 'http://localhost:3000', credentials: true }));
app.use(express.json({ limit: '1mb' }));

const signToken = (payload) => {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', sessionSecret).update(body).digest('base64url');
  return `${body}.${signature}`;
};

const verifyToken = (token) => {
  if (!token || !token.includes('.')) return null;
  const [body, signature] = token.split('.');
  const expected = crypto.createHmac('sha256', sessionSecret).update(body).digest('base64url');
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (signatureBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
};

const loginAttempts = new Map();
const loginRateLimit = (req, res, next) => {
  const windowMs = 15 * 60 * 1000;
  const maxAttempts = Number(process.env.LOGIN_RATE_LIMIT || 8);
  const username = String(req.body?.username || '').toLowerCase().trim();
  const key = `${req.ip || req.socket.remoteAddress || 'unknown'}:${username}`;
  const now = Date.now();
  const attempt = loginAttempts.get(key) || { count: 0, resetAt: now + windowMs };
  if (attempt.resetAt <= now) {
    attempt.count = 0;
    attempt.resetAt = now + windowMs;
  }
  attempt.count += 1;
  loginAttempts.set(key, attempt);
  if (attempt.count > maxAttempts) {
    res.setHeader('Retry-After', String(Math.ceil((attempt.resetAt - now) / 1000)));
    res.status(429).json({ error: 'Too many login attempts. Please try again later.' });
    return;
  }
  next();
};

const readCookie = (req, name) => {
  const cookieHeader = req.headers.cookie || '';
  return cookieHeader
    .split(';')
    .map(part => part.trim())
    .find(part => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
};

const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : '';
  const cookieToken = readCookie(req, 'rut_session');
  const payload = verifyToken(bearerToken || cookieToken);
  if (!payload) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  req.user = payload;
  next();
};

const requireRoles = (...roles) => (req, res, next) => {
  const userRoles = new Set(req.user?.roles || []);
  const activeRole = req.user?.activeRole;
  const allowed = roles.includes(activeRole) || roles.some(role => userRoles.has(role));
  if (!allowed) {
    res.status(403).json({ error: 'Insufficient role privileges' });
    return;
  }
  next();
};

const verifyPassword = async (password, passwordHash) => {
  if (!passwordHash) return false;
  const [scheme, salt, key] = passwordHash.split('$');
  if (scheme !== 'scrypt' || !salt || !key) return false;
  const derived = await new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (error, result) => error ? reject(error) : resolve(result.toString('hex')));
  });
  return crypto.timingSafeEqual(Buffer.from(derived, 'hex'), Buffer.from(key, 'hex'));
};

const requireDatabase = (req, res, next) => {
  if (!process.env.DATABASE_URL) {
    res.status(503).json({ error: 'DATABASE_URL is not configured' });
    return;
  }
  next();
};

const run = async (res, query, params = []) => {
  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database operation failed' });
  }
};

const todayIso = () => new Date().toISOString().slice(0, 10);
const isAfterToday = (dateValue) => dateValue > todayIso();
const toIsoDate = (dateValue) => dateValue instanceof Date ? dateValue.toISOString().slice(0, 10) : String(dateValue).slice(0, 10);

const parsePercent = (value) => Number(value || 0);

const getSetting = async (key, fallback) => {
  const result = await pool.query('select value from system_settings where key = $1', [key]);
  const raw = result.rows[0]?.value;
  return raw === undefined ? fallback : raw;
};

const audit = async (client, req, { module, action, entityType, entityId, oldValue, newValue, details, reason }) => {
  await client.query(`
    insert into audit_logs (user_id, user_name, user_role, module, action, entity_type, entity_id, old_value, new_value, details, reason)
    values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
  `, [
    req.user?.sub || 'system',
    req.user?.username || 'system',
    req.user?.activeRole || 'system',
    module,
    action,
    entityType,
    entityId,
    oldValue ? JSON.stringify(oldValue) : null,
    newValue ? JSON.stringify(newValue) : null,
    details,
    reason || null,
  ]);
};

app.get('/api/health', async (_req, res) => {
  if (!process.env.DATABASE_URL) {
    res.json({ status: 'ok', database: 'not_configured' });
    return;
  }
  try {
    await pool.query('select 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch {
    res.status(503).json({ status: 'degraded', database: 'unreachable' });
  }
});

app.post('/api/auth/login', loginRateLimit, requireDatabase, async (req, res) => {
  const schema = z.object({
    username: z.string().min(1),
    password: z.string().min(1),
    requestedRole: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  try {
    const result = await pool.query(`
      select u.id, u.username, u.employee_id, u.email, u.password_hash, u.status, e.id as employee_record_id, e.name, cd.id as country_director_id,
        coalesce(json_agg(r.name) filter (where r.name is not null), '[]') as roles
      from users u
      left join employees e on e.employee_id = u.employee_id
      left join country_directors cd on cd.name = e.name
      left join user_roles ur on ur.user_id = u.id
      left join roles r on r.id = ur.role_id
      where lower(u.username) = lower($1) or lower(u.email) = lower($1) or lower(u.employee_id) = lower($1)
      group by u.id, e.id, e.name, cd.id
      limit 1
    `, [parsed.data.username]);
    const user = result.rows[0];
    if (!user || user.status !== 'Active' || !(await verifyPassword(parsed.data.password, user.password_hash))) {
      res.status(401).json({ error: 'Invalid username or password' });
      return;
    }
    const activeRole = parsed.data.requestedRole && user.roles.includes(parsed.data.requestedRole)
      ? parsed.data.requestedRole
      : user.roles[0];
    const token = signToken({
      sub: user.id,
      username: user.username,
      employeeId: user.employee_id,
      employeeRecordId: user.employee_record_id,
      countryDirectorId: user.country_director_id,
      roles: user.roles,
      activeRole,
      exp: Date.now() + 8 * 60 * 60 * 1000,
    });
    res.cookie?.('rut_session', token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
    res.json({
      id: user.id,
      username: user.username,
      employeeId: user.employee_id,
      employeeRecordId: user.employee_record_id,
      countryDirectorId: user.country_director_id,
      email: user.email,
      name: user.name,
      roles: user.roles,
      activeRole,
      token,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/auth/logout', (_req, res) => {
  res.clearCookie?.('rut_session', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
  res.json({ status: 'ok' });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json(req.user);
});

app.get('/api/employees', requireDatabase, requireAuth, requireRoles('Admin', 'HR', 'CountryDirector', 'TeamLead'), (_req, res) => run(res, `
  select e.*, coalesce(json_agg(ecdm.country_director_id) filter (where ecdm.country_director_id is not null), '[]') as mapped_country_director_ids
  from employees e
  left join employee_country_director_map ecdm on ecdm.employee_id = e.id
  group by e.id
  order by e.name
`));

app.post('/api/employees', requireDatabase, requireAuth, requireRoles('Admin', 'HR'), async (req, res) => {
  const schema = z.object({
    employee_id: z.string().min(1),
    name: z.string().min(1),
    email: z.string().email(),
    designation: z.string().min(1),
    department: z.string().min(1),
    country: z.string().min(1),
    primary_country_director_id: z.string().min(1),
    status: z.enum(['Active', 'On Leave', 'Exited']).default('Active'),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  await run(res, `
    insert into employees (employee_id, name, email, designation, department, country, primary_country_director_id, status)
    values ($1,$2,$3,$4,$5,$6,$7,$8)
    on conflict (employee_id) do update set
      name = excluded.name,
      email = excluded.email,
      designation = excluded.designation,
      department = excluded.department,
      country = excluded.country,
      primary_country_director_id = excluded.primary_country_director_id,
      status = excluded.status,
      updated_at = now()
    returning *
  `, Object.values(parsed.data));
});

app.delete('/api/employees/:id', requireDatabase, requireAuth, requireRoles('Admin', 'HR'), async (req, res) => {
  const schema = z.object({
    reason: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body || {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('begin');
    const previous = (await client.query('select * from employees where id = $1 for update', [req.params.id])).rows[0];
    if (!previous) {
      await client.query('rollback');
      res.status(404).json({ error: 'Employee not found' });
      return;
    }
    const result = await client.query(`
      update employees
      set status = 'Exited', updated_at = now()
      where id = $1
      returning *
    `, [req.params.id]);
    await client.query(`
      update users
      set status = 'Disabled', updated_at = now()
      where employee_id = $1
    `, [previous.employee_id]);
    await client.query(`
      update project_allocations
      set status = 'Completed',
        end_date = case when end_date > current_date then current_date else end_date end,
        updated_at = now()
      where employee_id = $1 and status = 'Active'
    `, [req.params.id]);
    await audit(client, req, {
      module: 'Employee',
      action: 'Deactivate Employee',
      entityType: 'Employee',
      entityId: req.params.id,
      oldValue: previous,
      newValue: result.rows[0],
      details: `Deactivated employee ${previous.employee_id} and disabled login`,
      reason: parsed.data.reason,
    });
    await client.query('commit');
    res.json(result.rows[0]);
  } catch (error) {
    await client.query('rollback');
    console.error(error);
    res.status(500).json({ error: 'Employee deactivation failed' });
  } finally {
    client.release();
  }
});

app.get('/api/projects', requireDatabase, requireAuth, requireRoles('Admin', 'HR', 'CountryDirector', 'ProjectManager'), (_req, res) => run(res, 'select * from projects order by name'));
app.post('/api/projects', requireDatabase, requireAuth, requireRoles('Admin', 'HR'), async (req, res) => {
  const schema = z.object({
    id: z.string().min(1).optional(),
    project_code: z.string().min(1),
    name: z.string().min(1),
    client_id: z.string().min(1),
    manager_id: z.string().min(1),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    status: z.enum(['Proposed', 'Active', 'On Hold', 'Completed']).default('Proposed'),
    billable: z.boolean().default(true),
    project_type: z.string().optional().nullable(),
    country: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  if (parsed.data.end_date < parsed.data.start_date) {
    res.status(422).json({ error: 'Project end date cannot be before start date' });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('begin');
    const clientResult = await client.query('select id, name, status from clients where id = $1', [parsed.data.client_id]);
    const clientRecord = clientResult.rows[0];
    if (!clientRecord || clientRecord.status !== 'Active') {
      await client.query('rollback');
      res.status(422).json({ error: 'Project must reference an active client' });
      return;
    }
    const managerResult = await client.query('select id, name, status from employees where id = $1', [parsed.data.manager_id]);
    const manager = managerResult.rows[0];
    if (!manager || manager.status === 'Exited') {
      await client.query('rollback');
      res.status(422).json({ error: 'Project manager must reference an active employee' });
      return;
    }
    const previous = parsed.data.id
      ? (await client.query('select * from projects where id = $1', [parsed.data.id])).rows[0]
      : null;
    const result = await client.query(`
      insert into projects (id, project_code, name, client_id, client, manager_id, manager_name, start_date, end_date, status, billable, project_type, country, notes)
      values (coalesce($1, 'p-' || gen_random_uuid()::text), $2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      on conflict (id) do update set
        project_code = excluded.project_code,
        name = excluded.name,
        client_id = excluded.client_id,
        client = excluded.client,
        manager_id = excluded.manager_id,
        manager_name = excluded.manager_name,
        start_date = excluded.start_date,
        end_date = excluded.end_date,
        status = excluded.status,
        billable = excluded.billable,
        project_type = excluded.project_type,
        country = excluded.country,
        notes = excluded.notes,
        updated_at = now()
      returning *
    `, [
      parsed.data.id || null,
      parsed.data.project_code,
      parsed.data.name,
      clientRecord.id,
      clientRecord.name,
      manager.id,
      manager.name,
      parsed.data.start_date,
      parsed.data.end_date,
      parsed.data.status,
      parsed.data.billable,
      parsed.data.project_type || null,
      parsed.data.country || null,
      parsed.data.notes || null,
    ]);
    await audit(client, req, {
      module: 'Projects',
      action: previous ? 'Update Project' : 'Create Project',
      entityType: 'Project',
      entityId: result.rows[0].id,
      oldValue: previous,
      newValue: result.rows[0],
      details: `${previous ? 'Updated' : 'Created'} project ${result.rows[0].project_code}`,
    });
    await client.query('commit');
    res.json(result.rows[0]);
  } catch (error) {
    await client.query('rollback');
    console.error(error);
    res.status(500).json({ error: 'Project save failed' });
  } finally {
    client.release();
  }
});

app.patch('/api/projects/:id/status', requireDatabase, requireAuth, requireRoles('Admin', 'HR', 'ProjectManager'), async (req, res) => {
  const schema = z.object({
    status: z.enum(['Proposed', 'Active', 'On Hold', 'Completed']),
    reason: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const client = await pool.connect();
  try {
    await client.query('begin');
    const previous = (await client.query('select * from projects where id = $1 for update', [req.params.id])).rows[0];
    if (!previous) {
      await client.query('rollback');
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    if (
      req.user.activeRole === 'ProjectManager' &&
      previous.manager_id !== req.user.employeeRecordId &&
      previous.manager_id !== req.user.employeeId
    ) {
      await client.query('rollback');
      res.status(403).json({ error: 'Project managers can close only their own projects' });
      return;
    }
    const result = await client.query(`
      update projects
      set status = $2,
        end_date = case when $2 = 'Completed' and end_date > current_date then current_date else end_date end,
        updated_at = now()
      where id = $1
      returning *
    `, [req.params.id, parsed.data.status]);
    if (parsed.data.status === 'Completed') {
      await client.query(`
        update project_allocations
        set status = 'Completed',
          end_date = case when end_date > current_date then current_date else end_date end,
          updated_at = now()
        where project_id = $1 and status = 'Active'
      `, [req.params.id]);
    }
    await audit(client, req, {
      module: 'Projects',
      action: 'Update Project Status',
      entityType: 'Project',
      entityId: req.params.id,
      oldValue: previous,
      newValue: result.rows[0],
      details: `Changed project ${previous.project_code} status to ${parsed.data.status}`,
      reason: parsed.data.reason,
    });
    await client.query('commit');
    res.json(result.rows[0]);
  } catch (error) {
    await client.query('rollback');
    console.error(error);
    res.status(500).json({ error: 'Project status update failed' });
  } finally {
    client.release();
  }
});
app.get('/api/clients', requireDatabase, requireAuth, requireRoles('Admin', 'HR', 'CountryDirector', 'ProjectManager'), (_req, res) => run(res, `
  select c.*, coalesce(json_agg(ccdm.country_director_id) filter (where ccdm.country_director_id is not null), '[]') as country_director_ids
  from clients c
  left join client_country_director_map ccdm on ccdm.client_id = c.id
  group by c.id
  order by c.name
`));
app.post('/api/clients', requireDatabase, requireAuth, requireRoles('Admin', 'HR'), async (req, res) => {
  const schema = z.object({
    id: z.string().min(1).optional(),
    name: z.string().min(1),
    industry: z.string().min(1).default('Unclassified'),
    account_owner_id: z.string().optional().nullable(),
    country_director_ids: z.array(z.string()).default([]),
    status: z.enum(['Active', 'Inactive']).default('Active'),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const client = await pool.connect();
  try {
    await client.query('begin');
    const result = await client.query(`
      insert into clients (id, name, industry, account_owner_id, status)
      values (coalesce($1, 'client-' || gen_random_uuid()::text), $2, $3, $4, $5)
      on conflict (id) do update set
        name = excluded.name,
        industry = excluded.industry,
        account_owner_id = excluded.account_owner_id,
        status = excluded.status,
        updated_at = now()
      returning *
    `, [parsed.data.id || null, parsed.data.name, parsed.data.industry, parsed.data.account_owner_id || null, parsed.data.status]);
    const saved = result.rows[0];
    await client.query('delete from client_country_director_map where client_id = $1', [saved.id]);
    for (const countryDirectorId of parsed.data.country_director_ids) {
      await client.query(`
        insert into client_country_director_map (client_id, country_director_id)
        values ($1, $2)
        on conflict do nothing
      `, [saved.id, countryDirectorId]);
    }
    await client.query('update projects set client_id = $1, client = $2, updated_at = now() where client_id = $1 or client = $2', [saved.id, saved.name]);
    await client.query('commit');
    res.json(saved);
  } catch (error) {
    await client.query('rollback');
    console.error(error);
    res.status(500).json({ error: 'Client save failed' });
  } finally {
    client.release();
  }
});
app.delete('/api/clients/:id', requireDatabase, requireAuth, requireRoles('Admin', 'HR'), async (req, res) => {
  await run(res, `
    update clients
    set status = 'Inactive', updated_at = now()
    where id = $1
      and not exists (
        select 1 from projects
        where projects.client_id = clients.id
          and projects.status <> 'Completed'
      )
    returning *
  `, [req.params.id]);
});
app.get('/api/allocations', requireDatabase, requireAuth, requireRoles('Admin', 'HR', 'CountryDirector', 'ProjectManager'), (_req, res) => run(res, 'select * from project_allocations order by start_date desc'));
app.post('/api/allocations', requireDatabase, requireAuth, requireRoles('Admin', 'HR', 'CountryDirector', 'ProjectManager'), async (req, res) => {
  const schema = z.object({
    id: z.string().min(1).optional(),
    employee_id: z.string().min(1),
    project_id: z.string().min(1),
    role_on_project: z.string().min(1).optional().nullable(),
    percentage: z.number().min(0).max(200),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    billable: z.boolean().default(true),
    status: z.enum(['Active', 'Paused', 'Completed']).default('Active'),
    comments: z.string().optional().nullable(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  if (parsed.data.end_date < parsed.data.start_date) {
    res.status(422).json({ error: 'Allocation end date cannot be before start date' });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('begin');
    const employee = (await client.query('select * from employees where id = $1', [parsed.data.employee_id])).rows[0];
    if (!employee || employee.status === 'Exited') {
      await client.query('rollback');
      res.status(422).json({ error: 'Allocation must reference an active employee' });
      return;
    }
    const project = (await client.query('select * from projects where id = $1', [parsed.data.project_id])).rows[0];
    if (!project || !['Active', 'Proposed'].includes(project.status)) {
      await client.query('rollback');
      res.status(422).json({ error: 'Allocation must reference an active or proposed project' });
      return;
    }
    if (parsed.data.start_date < toIsoDate(project.start_date) || parsed.data.end_date > toIsoDate(project.end_date)) {
      await client.query('rollback');
      res.status(422).json({ error: 'Allocation dates must stay within the project timeline' });
      return;
    }
    if (req.user.activeRole === 'ProjectManager' && project.manager_id !== req.user.employeeRecordId && project.manager_id !== req.user.employeeId) {
      await client.query('rollback');
      res.status(403).json({ error: 'Project managers can allocate only on their own projects' });
      return;
    }
    if (req.user.activeRole === 'CountryDirector') {
      const scoped = (await client.query(`
        select 1
        from employee_country_director_map
        where employee_id = $1 and country_director_id = $2
        union
        select 1
        from employees
        where id = $1 and primary_country_director_id = $2
        limit 1
      `, [parsed.data.employee_id, req.user.countryDirectorId || req.user.cdId])).rows[0];
      if (!scoped) {
        await client.query('rollback');
        res.status(403).json({ error: 'Country Directors can allocate only scoped employees' });
        return;
      }
    }

    const blockOverAllocation = await getSetting('blockOverAllocation', false);
    if (blockOverAllocation && parsed.data.status === 'Active') {
      const loadResult = await client.query(`
        select coalesce(sum(percentage), 0) as total
        from project_allocations
        where employee_id = $1
          and status = 'Active'
          and id <> coalesce($2, '')
          and daterange(start_date, end_date, '[]') && daterange($3::date, $4::date, '[]')
      `, [parsed.data.employee_id, parsed.data.id || null, parsed.data.start_date, parsed.data.end_date]);
      const total = parsePercent(loadResult.rows[0]?.total) + parsed.data.percentage;
      if (total > 100) {
        await client.query('rollback');
        res.status(422).json({ error: `Allocation would exceed 100% for overlapping dates (${total}%)` });
        return;
      }
    }

    const previous = parsed.data.id
      ? (await client.query('select * from project_allocations where id = $1', [parsed.data.id])).rows[0]
      : null;
    const result = await client.query(`
      insert into project_allocations (id, employee_id, project_id, role_on_project, percentage, start_date, end_date, billable, status, comments)
      values (coalesce($1, 'a-' || gen_random_uuid()::text), $2,$3,$4,$5,$6,$7,$8,$9,$10)
      on conflict (id) do update set
        employee_id = excluded.employee_id,
        project_id = excluded.project_id,
        role_on_project = excluded.role_on_project,
        percentage = excluded.percentage,
        start_date = excluded.start_date,
        end_date = excluded.end_date,
        billable = excluded.billable,
        status = excluded.status,
        comments = excluded.comments,
        updated_at = now()
      returning *
    `, [
      parsed.data.id || null,
      parsed.data.employee_id,
      parsed.data.project_id,
      parsed.data.role_on_project || null,
      parsed.data.percentage,
      parsed.data.start_date,
      parsed.data.end_date,
      parsed.data.billable,
      parsed.data.status,
      parsed.data.comments || null,
    ]);
    await audit(client, req, {
      module: 'Allocations',
      action: previous ? 'Update Allocation' : 'Create Allocation',
      entityType: 'Allocation',
      entityId: result.rows[0].id,
      oldValue: previous,
      newValue: result.rows[0],
      details: `${previous ? 'Updated' : 'Created'} allocation for ${employee.employee_id} on ${project.project_code}`,
    });
    await client.query('commit');
    res.json(result.rows[0]);
  } catch (error) {
    await client.query('rollback');
    console.error(error);
    res.status(500).json({ error: 'Allocation save failed' });
  } finally {
    client.release();
  }
});

app.delete('/api/allocations/:id', requireDatabase, requireAuth, requireRoles('Admin', 'HR', 'CountryDirector', 'ProjectManager'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const previous = (await client.query('select * from project_allocations where id = $1 for update', [req.params.id])).rows[0];
    if (!previous) {
      await client.query('rollback');
      res.status(404).json({ error: 'Allocation not found' });
      return;
    }
    const result = await client.query(`
      update project_allocations
      set status = 'Completed',
        end_date = case when end_date > current_date then current_date else end_date end,
        updated_at = now()
      where id = $1
      returning *
    `, [req.params.id]);
    await audit(client, req, {
      module: 'Allocations',
      action: 'End Allocation',
      entityType: 'Allocation',
      entityId: req.params.id,
      oldValue: previous,
      newValue: result.rows[0],
      details: 'Soft-ended allocation',
    });
    await client.query('commit');
    res.json(result.rows[0]);
  } catch (error) {
    await client.query('rollback');
    console.error(error);
    res.status(500).json({ error: 'Allocation end failed' });
  } finally {
    client.release();
  }
});
app.get('/api/timesheets', requireDatabase, requireAuth, requireRoles('Admin', 'HR', 'CountryDirector', 'ProjectManager', 'TeamLead', 'Employee'), (_req, res) => run(res, 'select * from timesheets order by week_ending desc'));
app.post('/api/timesheets', requireDatabase, requireAuth, requireRoles('Admin', 'HR', 'CountryDirector', 'ProjectManager', 'TeamLead', 'Employee'), async (req, res) => {
  const entrySchema = z.object({
    id: z.string().optional(),
    project_id: z.string().optional().nullable(),
    work_type: z.enum(['Project Work', 'Client Misc Task']),
    client_name: z.string().optional().nullable(),
    category: z.string().optional().nullable(),
    work_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    hours: z.number().min(0).max(24),
    remark: z.string().optional().nullable(),
    billable: z.boolean().default(true),
  });
  const schema = z.object({
    employee_id: z.string().min(1),
    week_ending: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    status: z.enum(['Draft', 'Submitted', 'Approved', 'Rejected']).default('Draft'),
    rejection_reason: z.string().optional().nullable(),
    entries: z.array(entrySchema).min(1),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  if (isAfterToday(parsed.data.week_ending) || parsed.data.entries.some(entry => isAfterToday(entry.work_date))) {
    res.status(422).json({ error: 'Future week timesheets and future-dated entries cannot be saved or submitted' });
    return;
  }
  if (parsed.data.status === 'Approved' && !['Admin', 'CountryDirector', 'ProjectManager', 'TeamLead'].includes(req.user.activeRole)) {
    res.status(403).json({ error: 'Employees cannot directly approve timesheets' });
    return;
  }
  const invalidProjectEntry = parsed.data.entries.find(entry => entry.work_type === 'Project Work' && !entry.project_id);
  if (invalidProjectEntry) {
    res.status(422).json({ error: 'Project Work entries require a project' });
    return;
  }
  const invalidClientEntry = parsed.data.entries.find(entry => entry.work_type === 'Client Misc Task' && !entry.client_name);
  if (invalidClientEntry) {
    res.status(422).json({ error: 'Client Misc Task entries require a client name' });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('begin');
    const employee = (await client.query('select * from employees where id = $1', [parsed.data.employee_id])).rows[0];
    if (!employee || employee.status === 'Exited') {
      await client.query('rollback');
      res.status(422).json({ error: 'Timesheet must reference an active employee' });
      return;
    }
    if (
      req.user.activeRole === 'Employee' &&
      employee.id !== req.user.employeeRecordId &&
      employee.employee_id !== req.user.employeeId
    ) {
      await client.query('rollback');
      res.status(403).json({ error: 'Employees can submit only their own timesheets' });
      return;
    }

    const projectIds = [...new Set(parsed.data.entries.map(entry => entry.project_id).filter(Boolean))];
    if (projectIds.length > 0) {
      const projectResult = await client.query('select id, status from projects where id = any($1::text[])', [projectIds]);
      const activeProjectIds = new Set(projectResult.rows.filter(project => project.status !== 'Completed').map(project => project.id));
      const missingOrClosed = projectIds.find(projectId => !activeProjectIds.has(projectId));
      if (missingOrClosed) {
        await client.query('rollback');
        res.status(422).json({ error: 'Timesheet project entries must reference active, proposed, or on-hold projects' });
        return;
      }
    }

    const totalHours = parsed.data.entries.reduce((sum, entry) => sum + entry.hours, 0);
    const billableHours = parsed.data.entries.filter(entry => entry.billable).reduce((sum, entry) => sum + entry.hours, 0);
    const previous = (await client.query('select * from timesheets where employee_id = $1 and week_ending = $2', [parsed.data.employee_id, parsed.data.week_ending])).rows[0];
    const timesheetResult = await client.query(`
      insert into timesheets (employee_id, week_ending, status, total_hours, billable_hours, rejection_reason, submitted_at)
      values ($1,$2,$3,$4,$5,$6, case when $3 = 'Submitted' then now() else null end)
      on conflict (employee_id, week_ending) do update set
        status = excluded.status,
        total_hours = excluded.total_hours,
        billable_hours = excluded.billable_hours,
        rejection_reason = excluded.rejection_reason,
        submitted_at = case when excluded.status = 'Submitted' then coalesce(timesheets.submitted_at, now()) else timesheets.submitted_at end,
        updated_at = now()
      returning *
    `, [
      parsed.data.employee_id,
      parsed.data.week_ending,
      parsed.data.status,
      totalHours,
      billableHours,
      parsed.data.rejection_reason || null,
    ]);
    const timesheet = timesheetResult.rows[0];
    await client.query('delete from timesheet_entries where timesheet_id = $1', [timesheet.id]);
    for (const entry of parsed.data.entries) {
      await client.query(`
        insert into timesheet_entries (timesheet_id, project_id, work_type, client_name, category, work_date, hours, remark, billable)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      `, [
        timesheet.id,
        entry.project_id || null,
        entry.work_type,
        entry.client_name || null,
        entry.category || null,
        entry.work_date,
        entry.hours,
        entry.remark || null,
        entry.billable,
      ]);
    }
    await audit(client, req, {
      module: 'Timesheets',
      action: previous ? 'Update Timesheet' : 'Create Timesheet',
      entityType: 'Timesheet',
      entityId: String(timesheet.id),
      oldValue: previous,
      newValue: timesheet,
      details: `${previous ? 'Updated' : 'Created'} ${parsed.data.status} timesheet for ${employee.employee_id}, week ending ${parsed.data.week_ending}`,
      reason: parsed.data.rejection_reason || null,
    });
    await client.query('commit');
    res.json({ ...timesheet, entries: parsed.data.entries });
  } catch (error) {
    await client.query('rollback');
    console.error(error);
    res.status(500).json({ error: 'Timesheet save failed' });
  } finally {
    client.release();
  }
});

app.patch('/api/timesheets/:id/status', requireDatabase, requireAuth, requireRoles('Admin', 'CountryDirector', 'ProjectManager', 'TeamLead'), async (req, res) => {
  const schema = z.object({
    status: z.enum(['Approved', 'Rejected']),
    reason: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  if (parsed.data.status === 'Rejected' && !parsed.data.reason?.trim()) {
    res.status(422).json({ error: 'Rejected timesheets require a rejection reason' });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('begin');
    const previous = (await client.query('select * from timesheets where id = $1 for update', [req.params.id])).rows[0];
    if (!previous) {
      await client.query('rollback');
      res.status(404).json({ error: 'Timesheet not found' });
      return;
    }
    if (previous.status !== 'Submitted') {
      await client.query('rollback');
      res.status(422).json({ error: 'Only submitted timesheets can be approved or rejected' });
      return;
    }

    if (req.user.activeRole === 'CountryDirector') {
      const scoped = (await client.query(`
        select 1
        from employees e
        left join employee_country_director_map ecdm on ecdm.employee_id = e.id
        where e.id = $1
          and (e.primary_country_director_id = $2 or ecdm.country_director_id = $2)
        limit 1
      `, [previous.employee_id, req.user.countryDirectorId])).rows[0];
      if (!scoped) {
        await client.query('rollback');
        res.status(403).json({ error: 'Country Directors can approve only scoped employee timesheets' });
        return;
      }
    }

    if (req.user.activeRole === 'ProjectManager') {
      const managed = (await client.query(`
        select 1
        from timesheet_entries te
        join projects p on p.id = te.project_id
        where te.timesheet_id = $1
          and (p.manager_id = $2 or p.manager_id = $3)
        limit 1
      `, [req.params.id, req.user.employeeRecordId, req.user.employeeId])).rows[0];
      if (!managed) {
        await client.query('rollback');
        res.status(403).json({ error: 'Project Managers can approve only timesheets containing their projects' });
        return;
      }
    }

    const approved = parsed.data.status === 'Approved';
    const result = await client.query(`
      update timesheets
      set status = $2,
        rejection_reason = case when $2 = 'Rejected' then $3 else null end,
        approved_at = case when $2 = 'Approved' then now() else approved_at end,
        approved_by = case when $2 = 'Approved' then $4 else approved_by end,
        rejected_at = case when $2 = 'Rejected' then now() else rejected_at end,
        rejected_by = case when $2 = 'Rejected' then $4 else rejected_by end,
        updated_at = now()
      where id = $1
      returning *
    `, [req.params.id, parsed.data.status, parsed.data.reason || null, req.user.username]);
    await audit(client, req, {
      module: 'Timesheets',
      action: approved ? 'Approve Timesheet' : 'Reject Timesheet',
      entityType: 'Timesheet',
      entityId: req.params.id,
      oldValue: previous,
      newValue: result.rows[0],
      details: `${approved ? 'Approved' : 'Rejected'} timesheet ${req.params.id}`,
      reason: parsed.data.reason,
    });
    await client.query('commit');
    res.json(result.rows[0]);
  } catch (error) {
    await client.query('rollback');
    console.error(error);
    res.status(500).json({ error: 'Timesheet status update failed' });
  } finally {
    client.release();
  }
});
app.get('/api/settings', requireDatabase, requireAuth, requireRoles('Admin', 'HR'), (_req, res) => run(res, 'select key, value from system_settings order by key'));

const catalogTypeSchema = z.enum(['departments', 'countries', 'industries']);
const catalogModules = {
  departments: 'Department Catalog',
  countries: 'Country Catalog',
  industries: 'Industry Catalog',
};

const getCatalogUsage = async (client, catalogType, name) => {
  if (catalogType === 'departments') {
    const employees = Number((await client.query('select count(*)::int as count from employees where department = $1', [name])).rows[0]?.count || 0);
    const roles = Number((await client.query('select count(*)::int as count from role_definitions where department = $1 and active = true', [name])).rows[0]?.count || 0);
    return { count: employees + roles, reason: `${employees} employee(s), ${roles} role(s) still reference this department` };
  }
  if (catalogType === 'countries') {
    const employees = Number((await client.query('select count(*)::int as count from employees where country = $1', [name])).rows[0]?.count || 0);
    return { count: employees, reason: `${employees} employee(s) still reference this country` };
  }
  const clients = Number((await client.query('select count(*)::int as count from clients where industry = $1 and status = $2', [name, 'Active'])).rows[0]?.count || 0);
  return { count: clients, reason: `${clients} active client(s) still reference this industry` };
};

app.get('/api/catalogs/:catalogType', requireDatabase, requireAuth, async (req, res) => {
  const parsed = catalogTypeSchema.safeParse(req.params.catalogType);
  if (!parsed.success) {
    res.status(404).json({ error: 'Unknown catalog type' });
    return;
  }
  await run(res, `
    select id, catalog_type, name, active, created_at, updated_at
    from catalog_items
    where catalog_type = $1 and active = true
    order by name
  `, [parsed.data]);
});

app.post('/api/catalogs/:catalogType', requireDatabase, requireAuth, requireRoles('Admin', 'HR'), async (req, res) => {
  const catalogType = catalogTypeSchema.safeParse(req.params.catalogType);
  const body = z.object({
    id: z.string().min(1).optional(),
    name: z.string().min(1),
    active: z.boolean().default(true),
  }).safeParse(req.body);
  if (!catalogType.success || !body.success) {
    res.status(400).json({ error: body.error?.flatten?.() || 'Invalid catalog type' });
    return;
  }

  const client = await pool.connect();
  const id = body.data.id || `${catalogType.data.slice(0, -1)}-${crypto.randomUUID()}`;
  try {
    await client.query('begin');
    const previous = (await client.query('select * from catalog_items where id = $1 for update', [id])).rows[0];
    const result = await client.query(`
      insert into catalog_items (id, catalog_type, name, active)
      values ($1,$2,$3,$4)
      on conflict (id) do update set
        catalog_type = excluded.catalog_type,
        name = excluded.name,
        active = excluded.active,
        updated_at = now()
      returning *
    `, [id, catalogType.data, body.data.name.trim(), body.data.active]);
    await audit(client, req, {
      module: catalogModules[catalogType.data],
      action: previous ? 'Update Catalog Item' : 'Create Catalog Item',
      entityType: 'CatalogItem',
      entityId: id,
      oldValue: previous,
      newValue: result.rows[0],
      details: `${previous ? 'Updated' : 'Created'} ${catalogModules[catalogType.data]} item ${result.rows[0].name}`,
    });
    await client.query('commit');
    res.json(result.rows[0]);
  } catch (error) {
    await client.query('rollback');
    if (error.code === '23505') {
      res.status(409).json({ error: 'Catalog item name already exists for this catalog' });
      return;
    }
    console.error(error);
    res.status(500).json({ error: 'Catalog save failed' });
  } finally {
    client.release();
  }
});

app.delete('/api/catalogs/:catalogType/:id', requireDatabase, requireAuth, requireRoles('Admin', 'HR'), async (req, res) => {
  const catalogType = catalogTypeSchema.safeParse(req.params.catalogType);
  if (!catalogType.success) {
    res.status(404).json({ error: 'Unknown catalog type' });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('begin');
    const item = (await client.query('select * from catalog_items where id = $1 and catalog_type = $2 for update', [req.params.id, catalogType.data])).rows[0];
    if (!item) {
      await client.query('rollback');
      res.status(404).json({ error: 'Catalog item not found' });
      return;
    }
    const usage = await getCatalogUsage(client, catalogType.data, item.name);
    if (usage.count > 0) {
      await audit(client, req, {
        module: catalogModules[catalogType.data],
        action: 'Deactivate Blocked',
        entityType: 'CatalogItem',
        entityId: item.id,
        oldValue: item,
        details: `Blocked deactivation of ${item.name}; it is still referenced`,
        reason: usage.reason,
      });
      await client.query('commit');
      res.status(409).json({ error: 'Catalog item is still in use', reason: usage.reason });
      return;
    }
    const result = await client.query('update catalog_items set active = false, updated_at = now() where id = $1 returning *', [req.params.id]);
    await audit(client, req, {
      module: catalogModules[catalogType.data],
      action: 'Deactivate Catalog Item',
      entityType: 'CatalogItem',
      entityId: item.id,
      oldValue: item,
      newValue: result.rows[0],
      details: `Deactivated ${catalogModules[catalogType.data]} item ${item.name}`,
    });
    await client.query('commit');
    res.json(result.rows[0]);
  } catch (error) {
    await client.query('rollback');
    console.error(error);
    res.status(500).json({ error: 'Catalog item deactivation failed' });
  } finally {
    client.release();
  }
});

app.get('/api/country-directors', requireDatabase, requireAuth, requireRoles('Admin', 'HR', 'CountryDirector'), (_req, res) => run(res, 'select * from country_directors order by region, name'));
app.post('/api/country-directors', requireDatabase, requireAuth, requireRoles('Admin', 'HR'), async (req, res) => {
  const schema = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    region: z.string().min(1),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  await run(res, `
    insert into country_directors (id, name, region)
    values ($1,$2,$3)
    on conflict (id) do update set
      name = excluded.name,
      region = excluded.region
    returning *
  `, [parsed.data.id, parsed.data.name, parsed.data.region]);
});
app.delete('/api/country-directors/:id', requireDatabase, requireAuth, requireRoles('Admin', 'HR'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const director = (await client.query('select * from country_directors where id = $1 for update', [req.params.id])).rows[0];
    if (!director) {
      await client.query('rollback');
      res.status(404).json({ error: 'Country Director not found' });
      return;
    }
    const employeeCount = Number((await client.query(`
      select count(*)::int as count
      from employees e
      left join employee_country_director_map ecdm on ecdm.employee_id = e.id
      where e.primary_country_director_id = $1 or ecdm.country_director_id = $1
    `, [req.params.id])).rows[0]?.count || 0);
    const clientCount = Number((await client.query('select count(*)::int as count from client_country_director_map where country_director_id = $1', [req.params.id])).rows[0]?.count || 0);
    if (employeeCount > 0 || clientCount > 0) {
      await audit(client, req, {
        module: 'Country Director',
        action: 'Delete Blocked',
        entityType: 'CountryDirector',
        entityId: req.params.id,
        oldValue: director,
        details: `Blocked deletion of ${director.name}; scope mappings still exist`,
        reason: `${employeeCount} employee mapping(s), ${clientCount} client mapping(s)`,
      });
      await client.query('commit');
      res.status(409).json({ error: 'Country Director is still mapped to employees or clients', employeeCount, clientCount });
      return;
    }
    const result = await client.query('delete from country_directors where id = $1 returning *', [req.params.id]);
    await audit(client, req, {
      module: 'Country Director',
      action: 'Delete Country Director',
      entityType: 'CountryDirector',
      entityId: req.params.id,
      oldValue: director,
      details: `Deleted Country Director ${director.name}`,
    });
    await client.query('commit');
    res.json(result.rows[0]);
  } catch (error) {
    await client.query('rollback');
    console.error(error);
    res.status(500).json({ error: 'Country Director deletion failed' });
  } finally {
    client.release();
  }
});
app.get('/api/role-definitions', requireDatabase, requireAuth, requireRoles('Admin', 'HR'), (_req, res) => run(res, 'select * from role_definitions where active = true order by name'));
app.post('/api/role-definitions', requireDatabase, requireAuth, requireRoles('Admin', 'HR'), async (req, res) => {
  const schema = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    department: z.string().min(1),
    description: z.string().optional(),
    active: z.boolean().default(true),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  await run(res, `
    insert into role_definitions (id, name, department, description, active)
    values ($1,$2,$3,$4,$5)
    on conflict (id) do update set
      name = excluded.name,
      department = excluded.department,
      description = excluded.description,
      active = excluded.active,
      updated_at = now()
    returning *
  `, [parsed.data.id, parsed.data.name, parsed.data.department, parsed.data.description || null, parsed.data.active]);
});
app.delete('/api/role-definitions/:id', requireDatabase, requireAuth, requireRoles('Admin', 'HR'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const role = (await client.query('select * from role_definitions where id = $1 for update', [req.params.id])).rows[0];
    if (!role) {
      await client.query('rollback');
      res.status(404).json({ error: 'Role definition not found' });
      return;
    }
    const employeeCount = Number((await client.query('select count(*)::int as count from employees where designation = $1', [role.name])).rows[0]?.count || 0);
    const allocationCount = Number((await client.query('select count(*)::int as count from project_allocations where role_on_project = $1', [role.name])).rows[0]?.count || 0);
    if (employeeCount > 0 || allocationCount > 0) {
      await audit(client, req, {
        module: 'Role Definition',
        action: 'Delete Blocked',
        entityType: 'RoleDefinition',
        entityId: req.params.id,
        oldValue: role,
        details: `Blocked deactivation of role ${role.name}; it is still in use`,
        reason: `${employeeCount} employee(s), ${allocationCount} allocation(s)`,
      });
      await client.query('commit');
      res.status(409).json({ error: 'Role definition is still used by employees or allocations', employeeCount, allocationCount });
      return;
    }
    const result = await client.query('update role_definitions set active = false, updated_at = now() where id = $1 returning *', [req.params.id]);
    await audit(client, req, {
      module: 'Role Definition',
      action: 'Deactivate Role Definition',
      entityType: 'RoleDefinition',
      entityId: req.params.id,
      oldValue: role,
      newValue: result.rows[0],
      details: `Deactivated role definition ${role.name}`,
    });
    await client.query('commit');
    res.json(result.rows[0]);
  } catch (error) {
    await client.query('rollback');
    console.error(error);
    res.status(500).json({ error: 'Role definition deactivation failed' });
  } finally {
    client.release();
  }
});
app.get('/api/audit-logs', requireDatabase, requireAuth, requireRoles('Admin'), (_req, res) => run(res, 'select * from audit_logs order by created_at desc limit 500'));

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

if (isProduction || process.env.SERVE_STATIC === 'true') {
  if (existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(join(distDir, 'index.html'));
    });
  } else if (isProduction) {
    console.error(`Production startup blocked. Built frontend not found at ${distDir}. Run npm run build first.`);
    process.exit(1);
  }
}

app.listen(port, () => {
  console.log(`Resource Utilization Tracker API listening on http://localhost:${port}`);
});
