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
const round1 = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 10) / 10;

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
  const activeRole = req.user?.activeRole;
  if (!roles.includes(activeRole)) {
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

const scryptHash = async (value) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const key = await new Promise((resolve, reject) => {
    crypto.scrypt(value, salt, 64, (error, result) => error ? reject(error) : resolve(result.toString('hex')));
  });
  return `scrypt$${salt}$${key}`;
};

const getPasswordMinLength = () => {
  const configured = Number(process.env.PASSWORD_MIN_LENGTH || 6);
  return Number.isFinite(configured) && configured >= 6 ? configured : 6;
};

const validateNewPassword = (password, identityValues = []) => {
  const minLength = getPasswordMinLength();
  if (typeof password !== 'string' || password.length < minLength) {
    return `Password must be at least ${minLength} characters.`;
  }
  const normalized = password.toLowerCase();
  const identityHit = identityValues
    .filter(Boolean)
    .map(value => String(value).toLowerCase())
    .some(value => value.length >= 3 && normalized.includes(value));
  if (identityHit) return 'Password must not contain the username, employee ID, or email.';
  return null;
};

const generateTemporaryPassword = () => {
  return `RUT-${crypto.randomBytes(9).toString('base64url')}`;
};

const isGlobalRole = (req) => ['Admin', 'HR'].includes(req.user?.activeRole);

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
const parseBoolean = (value, fallback = false) => {
  if (typeof value === 'boolean') return value;
  if (value === undefined || value === null || value === '') return fallback;
  return ['true', '1', 'yes', 'y'].includes(String(value).trim().toLowerCase());
};
const splitPipeList = (value) => {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  return String(value || '').split('|').map(item => item.trim()).filter(Boolean);
};

const buildEmployeeScopeWhere = (req, params, employeeAlias = 'e') => {
  if (req.user.activeRole === 'Employee' || req.user.activeRole === 'TeamLead') {
    params.push(req.user.employeeRecordId, req.user.employeeId);
    return `(${employeeAlias}.id = $${params.length - 1} or ${employeeAlias}.employee_id = $${params.length})`;
  }
  if (req.user.activeRole === 'CountryDirector') {
    params.push(req.user.countryDirectorId);
    return `(
      ${employeeAlias}.primary_country_director_id = $${params.length}
      or exists (
        select 1 from employee_country_director_map scope
        where scope.employee_id = ${employeeAlias}.id and scope.country_director_id = $${params.length}
      )
    )`;
  }
  if (req.user.activeRole === 'ProjectManager') {
    params.push(req.user.employeeRecordId, req.user.employeeId);
    return `(
      ${employeeAlias}.id = $${params.length - 1}
      or ${employeeAlias}.employee_id = $${params.length}
      or exists (
        select 1
        from project_allocations scope_pa
        join projects scope_p on scope_p.id = scope_pa.project_id
        where scope_pa.employee_id = ${employeeAlias}.id
          and (scope_p.manager_id = $${params.length - 1} or scope_p.manager_id = $${params.length})
      )
    )`;
  }
  return 'true';
};

const buildProjectScopeWhere = (req, params, projectAlias = 'p') => {
  if (isGlobalRole(req)) return 'true';
  if (req.user.activeRole === 'Employee' || req.user.activeRole === 'TeamLead') {
    params.push(req.user.employeeRecordId, req.user.employeeId);
    return `exists (
      select 1 from project_allocations scope_pa
      where scope_pa.project_id = ${projectAlias}.id
        and (scope_pa.employee_id = $${params.length - 1} or scope_pa.employee_id = $${params.length})
    )`;
  }
  if (req.user.activeRole === 'ProjectManager') {
    params.push(req.user.employeeRecordId, req.user.employeeId);
    return `(${projectAlias}.manager_id = $${params.length - 1} or ${projectAlias}.manager_id = $${params.length})`;
  }
  if (req.user.activeRole === 'CountryDirector') {
    params.push(req.user.countryDirectorId);
    return `exists (
      select 1
      from project_allocations scope_pa
      join employees scope_e on scope_e.id = scope_pa.employee_id
      left join employee_country_director_map scope_ecdm on scope_ecdm.employee_id = scope_e.id
      where scope_pa.project_id = ${projectAlias}.id
        and (scope_e.primary_country_director_id = $${params.length} or scope_ecdm.country_director_id = $${params.length})
    )`;
  }
  return 'false';
};

const getSetting = async (key, fallback) => {
  const result = await pool.query('select value from system_settings where key = $1', [key]);
  const raw = result.rows[0]?.value;
  return raw === undefined ? fallback : raw;
};

const getRequestIp = (req) => String(req.headers['x-forwarded-for'] || req.ip || req.socket?.remoteAddress || '').split(',')[0].trim();

const audit = async (client, req, { module, action, entityType, entityId, oldValue, newValue, details, reason, source = 'Web' }) => {
  await client.query(`
    insert into audit_logs (
      user_id, user_name, user_role, active_role, source, module, action, entity_type, entity_id,
      old_value, new_value, details, reason, ip_address, session_id
    )
    values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
  `, [
    req.user?.sub || 'system',
    req.user?.username || 'system',
    req.user?.activeRole || 'system',
    req.user?.activeRole || 'system',
    source,
    module,
    action,
    entityType,
    entityId,
    oldValue ? JSON.stringify(oldValue) : null,
    newValue ? JSON.stringify(newValue) : null,
    details,
    reason || null,
    getRequestIp(req) || null,
    req.user?.sub || null,
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
      select u.id, u.username, u.employee_id, u.email, u.password_hash, u.must_change_password, u.status, e.id as employee_record_id, e.name, cd.id as country_director_id,
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
      mustChangePassword: Boolean(user.must_change_password),
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

app.post('/api/auth/switch-role', requireDatabase, requireAuth, async (req, res) => {
  const schema = z.object({ role: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  if (!req.user.roles.includes(parsed.data.role)) {
    res.status(403).json({ error: 'Role is not assigned to this user' });
    return;
  }
  try {
    const result = await pool.query(`
      select u.id, u.username, u.employee_id, u.email, u.must_change_password, u.status,
        e.id as employee_record_id, e.name, cd.id as country_director_id
      from users u
      left join employees e on e.employee_id = u.employee_id
      left join country_directors cd on cd.name = e.name
      where u.id = $1
      limit 1
    `, [req.user.sub]);
    const user = result.rows[0];
    if (!user || user.status !== 'Active') {
      res.status(401).json({ error: 'User is not active' });
      return;
    }
    const activeRole = parsed.data.role;
    const token = signToken({
      sub: user.id,
      username: user.username,
      employeeId: user.employee_id,
      employeeRecordId: user.employee_record_id,
      countryDirectorId: user.country_director_id,
      roles: req.user.roles,
      activeRole,
      exp: Date.now() + 8 * 60 * 60 * 1000,
    });
    res.cookie?.('rut_session', token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
    await audit(req, 'Switch Role', 'Auth', `Switched active role to ${activeRole}`, { entityType: 'User', entityId: user.id, newValue: { activeRole } });
    res.json({
      id: user.id,
      username: user.username,
      employeeId: user.employee_id,
      employeeRecordId: user.employee_record_id,
      countryDirectorId: user.country_director_id,
      email: user.email,
      name: user.name,
      roles: req.user.roles,
      activeRole,
      mustChangePassword: Boolean(user.must_change_password),
      token,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Role switch failed' });
  }
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json(req.user);
});

app.post('/api/auth/change-password', requireDatabase, requireAuth, async (req, res) => {
  const schema = z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(1),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('begin');
    const user = (await client.query(
      'select id, username, employee_id, email, password_hash, status, must_change_password from users where id = $1 for update',
      [req.user.sub]
    )).rows[0];
    if (!user || user.status !== 'Active') {
      await client.query('rollback');
      res.status(404).json({ error: 'Active user was not found' });
      return;
    }
    if (!(await verifyPassword(parsed.data.currentPassword, user.password_hash))) {
      await client.query('rollback');
      res.status(401).json({ error: 'Current password is incorrect' });
      return;
    }
    const passwordError = validateNewPassword(parsed.data.newPassword, [user.username, user.employee_id, user.email]);
    if (passwordError) {
      await client.query('rollback');
      res.status(400).json({ error: passwordError });
      return;
    }
    const passwordHash = await scryptHash(parsed.data.newPassword);
    await client.query(
      'update users set password_hash = $1, must_change_password = false, updated_at = now() where id = $2',
      [passwordHash, user.id]
    );
    await audit(client, req, {
      module: 'Auth',
      action: 'Change Password',
      entityType: 'User',
      entityId: user.id,
      details: `Changed password for ${user.username}`,
    });
    await client.query('commit');
    res.json({ status: 'ok', mustChangePassword: false });
  } catch (error) {
    await client.query('rollback');
    console.error(error);
    res.status(500).json({ error: 'Password change failed' });
  } finally {
    client.release();
  }
});

app.post('/api/users/:id/password-reset', requireDatabase, requireAuth, requireRoles('Admin', 'HR'), async (req, res) => {
  const schema = z.object({
    newPassword: z.string().optional(),
    mustChangePassword: z.boolean().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('begin');
    const user = (await client.query(`
      select id, username, employee_id, email, status, must_change_password
      from users
      where id::text = $1 or lower(username) = lower($1) or lower(employee_id) = lower($1) or lower(email) = lower($1)
      for update
      limit 1
    `, [req.params.id])).rows[0];
    if (!user) {
      await client.query('rollback');
      res.status(404).json({ error: 'User was not found' });
      return;
    }
    const temporaryPassword = parsed.data.newPassword || generateTemporaryPassword();
    const passwordError = validateNewPassword(temporaryPassword, [user.username, user.employee_id, user.email]);
    if (passwordError) {
      await client.query('rollback');
      res.status(400).json({ error: passwordError });
      return;
    }
    const passwordHash = await scryptHash(temporaryPassword);
    const mustChangePassword = parsed.data.mustChangePassword ?? true;
    await client.query(
      'update users set password_hash = $1, must_change_password = $2, updated_at = now() where id = $3',
      [passwordHash, mustChangePassword, user.id]
    );
    await audit(client, req, {
      module: 'Admin',
      action: 'Reset Password',
      entityType: 'User',
      entityId: user.id,
      details: `Reset password for ${user.username}`,
      newValue: { mustChangePassword },
    });
    await client.query('commit');
    res.json({
      status: 'ok',
      userId: user.id,
      userName: user.username,
      mustChangePassword,
      temporaryPassword: parsed.data.newPassword ? undefined : temporaryPassword,
    });
  } catch (error) {
    await client.query('rollback');
    console.error(error);
    res.status(500).json({ error: 'Password reset failed' });
  } finally {
    client.release();
  }
});

app.get('/api/employees', requireDatabase, requireAuth, requireRoles('Admin', 'HR', 'CountryDirector', 'TeamLead', 'ProjectManager', 'Employee'), async (req, res) => {
  const params = [];
  let where = '';
  if (req.user.activeRole === 'Employee' || req.user.activeRole === 'TeamLead') {
    params.push(req.user.employeeRecordId, req.user.employeeId);
    where = 'where e.id = $1 or e.employee_id = $2';
  } else if (req.user.activeRole === 'CountryDirector') {
    params.push(req.user.countryDirectorId);
    where = `
      where e.primary_country_director_id = $1
         or exists (
          select 1 from employee_country_director_map scope
          where scope.employee_id = e.id and scope.country_director_id = $1
        )
    `;
  } else if (req.user.activeRole === 'ProjectManager') {
    params.push(req.user.employeeRecordId, req.user.employeeId);
    where = `
      where e.id = $1 or e.employee_id = $2
         or exists (
          select 1
          from project_allocations pa
          join projects p on p.id = pa.project_id
          where pa.employee_id = e.id
            and (p.manager_id = $1 or p.manager_id = $2)
        )
    `;
  }
  await run(res, `
    select e.*, coalesce(json_agg(ecdm.country_director_id) filter (where ecdm.country_director_id is not null), '[]') as mapped_country_director_ids
    from employees e
    left join employee_country_director_map ecdm on ecdm.employee_id = e.id
    ${where}
    group by e.id
    order by e.name
  `, params);
});

app.post('/api/employees', requireDatabase, requireAuth, requireRoles('Admin', 'HR'), async (req, res) => {
  const schema = z.object({
    id: z.string().min(1).optional(),
    employee_id: z.string().min(1),
    name: z.string().min(1),
    email: z.string().email(),
    designation: z.string().min(1),
    department: z.string().min(1),
    country: z.string().min(1),
    reporting_manager_id: z.string().min(1).optional().nullable(),
    primary_country_director_id: z.string().min(1),
    mapped_country_director_ids: z.array(z.string()).default([]),
    utilization_eligible: z.boolean().optional(),
    joining_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
    exit_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
    standard_weekly_hours: z.number().min(1).max(168).optional().nullable(),
    capacity_type: z.string().min(1).optional().nullable(),
    contract_type: z.string().min(1).optional().nullable(),
    leave_policy_id: z.string().optional().nullable(),
    entra_object_id: z.string().optional().nullable(),
    teams_user_id: z.string().optional().nullable(),
    roles: z.array(z.enum(['Employee', 'TeamLead', 'ProjectManager', 'CountryDirector', 'HR', 'Admin'])).optional(),
    initial_password: z.string().min(6).optional(),
    status: z.enum(['Active', 'On Leave', 'Exited']).default('Active'),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const client = await pool.connect();
  try {
    await client.query('begin');
    const previous = (await client.query('select * from employees where employee_id = $1', [parsed.data.employee_id])).rows[0];
    const employeeCode = parsed.data.employee_id.toUpperCase();
    const designation = parsed.data.designation.toLowerCase();
    const department = parsed.data.department.toLowerCase();
    const defaultUtilizationEligible = !(
      employeeCode.startsWith('ADMIN-') ||
      employeeCode.startsWith('HR-') ||
      employeeCode.startsWith('CD-') ||
      designation === 'country director' ||
      designation === 'system administrator' ||
      designation === 'hr manager' ||
      department === 'regional leadership' ||
      department === 'administration' ||
      department === 'human resources'
    );
    const utilizationEligible = parsed.data.utilization_eligible ?? defaultUtilizationEligible;
    const employeeResult = await client.query(`
      insert into employees (
        id, employee_id, name, email, designation, department, country, reporting_manager_id,
        primary_country_director_id, status, utilization_eligible, joining_date, exit_date,
        standard_weekly_hours, capacity_type, contract_type, leave_policy_id, entra_object_id, teams_user_id
      )
      values (coalesce($1, 'e-' || gen_random_uuid()::text), $2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
      on conflict (employee_id) do update set
        name = excluded.name,
        email = excluded.email,
        designation = excluded.designation,
        department = excluded.department,
        country = excluded.country,
        reporting_manager_id = excluded.reporting_manager_id,
        primary_country_director_id = excluded.primary_country_director_id,
        status = excluded.status,
        utilization_eligible = excluded.utilization_eligible,
        joining_date = excluded.joining_date,
        exit_date = excluded.exit_date,
        standard_weekly_hours = excluded.standard_weekly_hours,
        capacity_type = excluded.capacity_type,
        contract_type = excluded.contract_type,
        leave_policy_id = excluded.leave_policy_id,
        entra_object_id = excluded.entra_object_id,
        teams_user_id = excluded.teams_user_id,
        updated_at = now()
      returning *
    `, [
      parsed.data.id || null,
      parsed.data.employee_id,
      parsed.data.name,
      parsed.data.email,
      parsed.data.designation,
      parsed.data.department,
      parsed.data.country,
      parsed.data.reporting_manager_id || null,
      parsed.data.primary_country_director_id,
      parsed.data.status,
      utilizationEligible,
      parsed.data.joining_date || null,
      parsed.data.exit_date || null,
      parsed.data.standard_weekly_hours || 40,
      parsed.data.capacity_type || (utilizationEligible ? 'Delivery' : 'Governance'),
      parsed.data.contract_type || 'Permanent',
      parsed.data.leave_policy_id || null,
      parsed.data.entra_object_id || null,
      parsed.data.teams_user_id || null,
    ]);
    const employee = employeeResult.rows[0];
    const mappedIds = Array.from(new Set([parsed.data.primary_country_director_id, ...parsed.data.mapped_country_director_ids].filter(Boolean)));
    await client.query('delete from employee_country_director_map where employee_id = $1', [employee.id]);
    for (const directorId of mappedIds) {
      await client.query(`
        insert into employee_country_director_map (employee_id, country_director_id)
        values ($1,$2)
        on conflict do nothing
      `, [employee.id, directorId]);
    }

    const existingUser = (await client.query('select id from users where lower(username) = lower($1) or employee_id = $2', [parsed.data.employee_id, parsed.data.employee_id])).rows[0];
    const passwordHash = existingUser && !parsed.data.initial_password
      ? null
      : await scryptHash(parsed.data.initial_password || process.env.DEMO_SEED_PASSWORD || 'demo123');
    const userResult = await client.query(`
      insert into users (username, employee_id, email, password_hash, status, updated_at)
      values ($1,$2,$3,$4,$5,now())
      on conflict (username) do update set
        employee_id = excluded.employee_id,
        email = excluded.email,
        password_hash = coalesce($4, users.password_hash),
        status = excluded.status,
        updated_at = now()
      returning id
    `, [
      parsed.data.employee_id.toLowerCase(),
      parsed.data.employee_id,
      parsed.data.email,
      passwordHash,
      parsed.data.status === 'Exited' ? 'Disabled' : 'Active',
    ]);
    const defaultRoleNames = employeeCode.startsWith('ADMIN-')
      ? ['Admin']
      : employeeCode.startsWith('HR-')
        ? ['HR']
        : employeeCode.startsWith('CD-')
          ? ['CountryDirector']
          : employeeCode.startsWith('PM-')
            ? ['ProjectManager', 'Employee']
            : ['Employee'];
    const roleNames = parsed.data.roles || defaultRoleNames;
    const roleResult = await client.query('select id, name from roles where name = any($1::text[])', [roleNames]);
    await client.query('delete from user_roles where user_id = $1', [userResult.rows[0].id]);
    for (const role of roleResult.rows) {
      await client.query('insert into user_roles (user_id, role_id) values ($1,$2) on conflict do nothing', [userResult.rows[0].id, role.id]);
    }
    await audit(client, req, {
      module: 'Employee',
      action: previous ? 'Update Employee' : 'Create Employee',
      entityType: 'Employee',
      entityId: employee.id,
      oldValue: previous,
      newValue: employee,
      details: `${previous ? 'Updated' : 'Created'} employee ${employee.employee_id} and synchronized login`,
    });
    await client.query('commit');
    res.json({ ...employee, mapped_country_director_ids: mappedIds });
  } catch (error) {
    await client.query('rollback');
    console.error(error);
    res.status(500).json({ error: 'Employee save failed' });
  } finally {
    client.release();
  }
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

app.get('/api/projects', requireDatabase, requireAuth, requireRoles('Admin', 'HR', 'CountryDirector', 'ProjectManager', 'Employee', 'TeamLead'), async (req, res) => {
  const params = [];
  let where = '';
  if (req.user.activeRole === 'Employee' || req.user.activeRole === 'TeamLead') {
    params.push(req.user.employeeRecordId, req.user.employeeId);
    where = `
      where exists (
        select 1 from project_allocations pa
        where pa.project_id = projects.id
          and (pa.employee_id = $1 or pa.employee_id = $2)
      )
    `;
  } else if (req.user.activeRole === 'ProjectManager') {
    params.push(req.user.employeeRecordId, req.user.employeeId);
    where = 'where manager_id = $1 or manager_id = $2';
  } else if (req.user.activeRole === 'CountryDirector') {
    params.push(req.user.countryDirectorId);
    where = `
      where exists (
        select 1
        from project_allocations pa
        join employees e on e.id = pa.employee_id
        left join employee_country_director_map ecdm on ecdm.employee_id = e.id
        where pa.project_id = projects.id
          and (e.primary_country_director_id = $1 or ecdm.country_director_id = $1)
      )
    `;
  }
  await run(res, `select * from projects ${where} order by name`, params);
});
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
app.get('/api/clients', requireDatabase, requireAuth, requireRoles('Admin', 'HR', 'CountryDirector', 'ProjectManager', 'Employee', 'TeamLead'), async (req, res) => {
  const params = [];
  let where = '';
  if (req.user.activeRole === 'CountryDirector') {
    params.push(req.user.countryDirectorId);
    where = `
      where exists (
        select 1 from client_country_director_map scope
        where scope.client_id = c.id and scope.country_director_id = $1
      )
    `;
  } else if (req.user.activeRole === 'ProjectManager') {
    params.push(req.user.employeeRecordId, req.user.employeeId);
    where = 'where exists (select 1 from projects p where p.client_id = c.id and (p.manager_id = $1 or p.manager_id = $2))';
  } else if (req.user.activeRole === 'Employee' || req.user.activeRole === 'TeamLead') {
    params.push(req.user.employeeRecordId, req.user.employeeId);
    where = `
      where exists (
        select 1
        from projects p
        join project_allocations pa on pa.project_id = p.id
        where p.client_id = c.id and (pa.employee_id = $1 or pa.employee_id = $2)
      )
    `;
  }
  await run(res, `
    select c.*, coalesce(json_agg(ccdm.country_director_id) filter (where ccdm.country_director_id is not null), '[]') as country_director_ids
    from clients c
    left join client_country_director_map ccdm on ccdm.client_id = c.id
    ${where}
    group by c.id
    order by c.name
  `, params);
});
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
app.get('/api/allocations', requireDatabase, requireAuth, requireRoles('Admin', 'HR', 'CountryDirector', 'ProjectManager', 'Employee', 'TeamLead'), async (req, res) => {
  const params = [];
  let where = '';
  if (req.user.activeRole === 'Employee' || req.user.activeRole === 'TeamLead') {
    params.push(req.user.employeeRecordId, req.user.employeeId);
    where = 'where employee_id = $1 or employee_id = $2';
  } else if (req.user.activeRole === 'ProjectManager') {
    params.push(req.user.employeeRecordId, req.user.employeeId);
    where = `
      where exists (
        select 1 from projects p
        where p.id = project_allocations.project_id
          and (p.manager_id = $1 or p.manager_id = $2)
      )
    `;
  } else if (req.user.activeRole === 'CountryDirector') {
    params.push(req.user.countryDirectorId);
    where = `
      where exists (
        select 1
        from employees e
        left join employee_country_director_map ecdm on ecdm.employee_id = e.id
        where e.id = project_allocations.employee_id
          and (e.primary_country_director_id = $1 or ecdm.country_director_id = $1)
      )
    `;
  }
  await run(res, `select * from project_allocations ${where} order by start_date desc`, params);
});
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
    if (req.user.activeRole === 'ProjectManager') {
      const managed = (await client.query('select 1 from projects where id = $1 and (manager_id = $2 or manager_id = $3)', [previous.project_id, req.user.employeeRecordId, req.user.employeeId])).rows[0];
      if (!managed) {
        await client.query('rollback');
        res.status(403).json({ error: 'Project managers can end only allocations on their own projects' });
        return;
      }
    }
    if (req.user.activeRole === 'CountryDirector') {
      const scoped = (await client.query(`
        select 1
        from employees e
        left join employee_country_director_map ecdm on ecdm.employee_id = e.id
        where e.id = $1 and (e.primary_country_director_id = $2 or ecdm.country_director_id = $2)
        limit 1
      `, [previous.employee_id, req.user.countryDirectorId])).rows[0];
      if (!scoped) {
        await client.query('rollback');
        res.status(403).json({ error: 'Country Directors can end only scoped employee allocations' });
        return;
      }
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
app.get('/api/timesheets', requireDatabase, requireAuth, requireRoles('Admin', 'HR', 'CountryDirector', 'ProjectManager', 'TeamLead', 'Employee'), async (req, res) => {
  const params = [];
  let where = '';
  if (req.user.activeRole === 'Employee' || req.user.activeRole === 'TeamLead') {
    params.push(req.user.employeeRecordId, req.user.employeeId);
    where = 'where t.employee_id = $1 or e.employee_id = $2';
  } else if (req.user.activeRole === 'CountryDirector') {
    params.push(req.user.countryDirectorId);
    where = `
      where e.primary_country_director_id = $1
         or exists (
          select 1 from employee_country_director_map ecdm
          where ecdm.employee_id = e.id and ecdm.country_director_id = $1
        )
    `;
  } else if (req.user.activeRole === 'ProjectManager') {
    params.push(req.user.employeeRecordId, req.user.employeeId);
    where = `
      where exists (
        select 1
        from timesheet_entries scope_te
        join projects scope_p on scope_p.id = scope_te.project_id
        where scope_te.timesheet_id = t.id
          and (scope_p.manager_id = $1 or scope_p.manager_id = $2)
      )
    `;
  }
  await run(res, `
    select
      t.*,
      coalesce(json_agg(json_build_object(
        'id', te.id,
        'employee_id', t.employee_id,
        'project_id', te.project_id,
        'project_name', p.name,
        'work_type', te.work_type,
        'client_name', te.client_name,
        'category', te.category,
        'work_date', te.work_date,
        'hours', te.hours,
        'remark', te.remark,
        'status', t.status,
        'billable', te.billable,
        'week_ending', t.week_ending
      ) order by te.work_date, te.id) filter (where te.id is not null), '[]') as entries
    from timesheets t
    join employees e on e.id = t.employee_id
    left join timesheet_entries te on te.timesheet_id = t.id
    left join projects p on p.id = te.project_id
    ${where}
    group by t.id
    order by t.week_ending desc, t.updated_at desc
  `, params);
});
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

    const totalHours = round1(parsed.data.entries.reduce((sum, entry) => sum + entry.hours, 0));
    const billableHours = round1(parsed.data.entries.filter(entry => entry.billable).reduce((sum, entry) => sum + entry.hours, 0));
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
        round1(entry.hours),
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
app.get('/api/settings', requireDatabase, requireAuth, (_req, res) => run(res, 'select key, value from system_settings order by key'));
app.post('/api/settings', requireDatabase, requireAuth, requireRoles('Admin', 'HR'), async (req, res) => {
  const schema = z.object({
    expectedWeeklyHours: z.number().min(1).max(168),
    utilizationThresholdHigh: z.number().min(0).max(300),
    utilizationThresholdLow: z.number().min(0).max(300),
    benchThreshold: z.number().min(0).max(100),
    timesheetPolicyMaxHours: z.number().min(1).max(168).optional(),
    blockOverAllocation: z.boolean().optional(),
    demoSubmissionMode: z.boolean().optional(),
    currency: z.string().min(1).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const client = await pool.connect();
  try {
    await client.query('begin');
    const previous = (await client.query('select key, value from system_settings order by key')).rows;
    for (const [key, value] of Object.entries(parsed.data)) {
      await client.query(`
        insert into system_settings (key, value, updated_at)
        values ($1, $2::jsonb, now())
        on conflict (key) do update set value = excluded.value, updated_at = now()
      `, [key, JSON.stringify(value)]);
    }
    await audit(client, req, {
      module: 'Settings',
      action: 'Update Settings',
      entityType: 'SystemSettings',
      entityId: 'system',
      oldValue: previous,
      newValue: parsed.data,
      details: 'Updated system settings',
    });
    await client.query('commit');
    const result = await pool.query('select key, value from system_settings order by key');
    res.json(result.rows);
  } catch (error) {
    await client.query('rollback');
    console.error(error);
    res.status(500).json({ error: 'Settings save failed' });
  } finally {
    client.release();
  }
});

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

app.get('/api/country-directors', requireDatabase, requireAuth, (_req, res) => run(res, 'select * from country_directors order by region, name'));
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
app.get('/api/role-definitions', requireDatabase, requireAuth, (_req, res) => run(res, 'select * from role_definitions where active = true order by name'));
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

const utilizationReportSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  months: z.coerce.number().int().min(1).max(24).optional(),
});

const getUtilizationReport = async (req, res, mode) => {
  const parsed = utilizationReportSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const settingsResult = await pool.query('select key, value from system_settings');
  const settings = Object.fromEntries(settingsResult.rows.map(row => [row.key, row.value]));
  const expectedWeeklyHours = Number(settings.expectedWeeklyHours || 40);
  const highThreshold = Number(settings.utilizationThresholdHigh || 100);
  const lowThreshold = Number(settings.utilizationThresholdLow || 80);
  const benchThreshold = Number(settings.benchThreshold || 20);

  const reportDate = parsed.data.date || todayIso();
  const forecastMonths = parsed.data.months || 3;
  const forecastDate = new Date(`${reportDate}T00:00:00.000Z`);
  forecastDate.setUTCMonth(forecastDate.getUTCMonth() + forecastMonths);
  const targetDate = mode === 'forecast' ? forecastDate.toISOString().slice(0, 10) : reportDate;
  const includeProposed = mode === 'forecast';

  const params = [targetDate, expectedWeeklyHours, highThreshold, lowThreshold, benchThreshold, includeProposed, mode];
  const scopeWhere = buildEmployeeScopeWhere(req, params, 'e');

  try {
    const result = await pool.query(`
      with scoped_employees as (
        select e.*,
          coalesce(jsonb_agg(ecdm.country_director_id) filter (where ecdm.country_director_id is not null), '[]'::jsonb) as mapped_country_director_ids
        from employees e
        left join employee_country_director_map ecdm on ecdm.employee_id = e.id
        where ${scopeWhere}
        group by e.id
      ),
      employee_load as (
        select
          e.id,
          e.employee_id,
          e.name,
          e.email,
          e.designation,
          e.department,
          e.country,
          e.reporting_manager_id,
          e.primary_country_director_id,
          e.mapped_country_director_ids,
          e.status,
          e.utilization_eligible,
          e.joining_date,
          e.exit_date,
          e.standard_weekly_hours,
          e.capacity_type,
          e.contract_type,
          e.leave_policy_id,
          e.entra_object_id,
          e.teams_user_id,
          coalesce(sum(pa.percentage) filter (
            where pa.status = 'Active'
              and p.id is not null
              and (p.status = 'Active' or ($6::boolean and p.status = 'Proposed'))
              and p.start_date <= $1::date
              and p.end_date >= $1::date
              and pa.start_date <= $1::date
              and pa.end_date >= $1::date
          ), 0) as planned_utilization,
          count(pa.id) filter (
            where pa.status = 'Active'
              and p.id is not null
              and (p.status = 'Active' or ($6::boolean and p.status = 'Proposed'))
              and p.start_date <= $1::date
              and p.end_date >= $1::date
              and pa.start_date <= $1::date
              and pa.end_date >= $1::date
          )::int as active_project_count
        from scoped_employees e
        left join project_allocations pa on pa.employee_id = e.id
        left join projects p on p.id = pa.project_id
        where e.status = 'Active' and e.utilization_eligible = true
        group by e.id, e.employee_id, e.name, e.email, e.designation, e.department, e.country,
          e.reporting_manager_id, e.primary_country_director_id, e.mapped_country_director_ids, e.status,
          e.utilization_eligible, e.joining_date, e.exit_date, e.standard_weekly_hours, e.capacity_type,
          e.contract_type, e.leave_policy_id, e.entra_object_id, e.teams_user_id
      ),
      latest_approved as (
        select distinct on (t.employee_id)
          t.employee_id,
          t.week_ending,
          t.billable_hours,
          round((t.billable_hours / nullif($2::numeric, 0)) * 1000) / 10 as actual_utilization
        from timesheets t
        where t.status = 'Approved'
        order by t.employee_id, t.week_ending desc
      )
      select
        el.id,
        el.employee_id,
        el.name,
        el.email,
        el.designation,
        el.department,
        el.country,
        el.reporting_manager_id,
        el.primary_country_director_id,
        el.mapped_country_director_ids,
        el.status,
        el.utilization_eligible,
        el.joining_date,
        el.exit_date,
        el.standard_weekly_hours,
        el.capacity_type,
        el.contract_type,
        el.leave_policy_id,
        el.entra_object_id,
        el.teams_user_id,
        el.planned_utilization,
        coalesce(la.actual_utilization, 0) as actual_utilization,
        la.week_ending as latest_approved_week,
        el.active_project_count,
        case
          when el.planned_utilization > $3::numeric then 'Overloaded'
          when el.planned_utilization <= $5::numeric then 'Bench'
          when el.planned_utilization < $4::numeric then 'Underutilized'
          else 'Balanced'
        end as utilization_band
      from employee_load el
      left join latest_approved la on la.employee_id = el.id
      where (
        not (upper(el.employee_id) like 'PM-%' or el.designation = 'Project Manager')
        or el.active_project_count > 0
        or el.planned_utilization > 0
      )
      order by
        case when $7 = 'actual' then coalesce(la.actual_utilization, 0) else el.planned_utilization end desc,
        el.name
    `, params);
    res.json({
      mode,
      asOfDate: targetDate,
      sourceDate: reportDate,
      forecastMonths: mode === 'forecast' ? forecastMonths : null,
      expectedWeeklyHours,
      thresholds: {
        high: highThreshold,
        low: lowThreshold,
        bench: benchThreshold,
      },
      summary: {
        rows: result.rows.length,
        averagePlanned: result.rows.length
          ? Number((result.rows.reduce((sum, row) => sum + Number(row.planned_utilization), 0) / result.rows.length).toFixed(1))
          : 0,
        averageActual: result.rows.length
          ? Number((result.rows.reduce((sum, row) => sum + Number(row.actual_utilization), 0) / result.rows.length).toFixed(1))
          : 0,
        overloaded: result.rows.filter(row => Number(row.planned_utilization) > highThreshold).length,
        underutilized: result.rows.filter(row => {
          const planned = Number(row.planned_utilization);
          return planned < lowThreshold && planned > benchThreshold;
        }).length,
        bench: result.rows.filter(row => Number(row.planned_utilization) <= benchThreshold).length,
      },
      rows: result.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Utilization report failed' });
  }
};

app.get('/api/reports/planned-utilization', requireDatabase, requireAuth, requireRoles('Admin', 'HR', 'CountryDirector', 'ProjectManager', 'TeamLead', 'Employee'), (req, res) => {
  getUtilizationReport(req, res, 'planned');
});
app.get('/api/reports/actual-utilization', requireDatabase, requireAuth, requireRoles('Admin', 'HR', 'CountryDirector', 'ProjectManager', 'TeamLead', 'Employee'), (req, res) => {
  getUtilizationReport(req, res, 'actual');
});
app.get('/api/reports/forecast-utilization', requireDatabase, requireAuth, requireRoles('Admin', 'HR', 'CountryDirector', 'ProjectManager', 'TeamLead', 'Employee'), (req, res) => {
  getUtilizationReport(req, res, 'forecast');
});

const getDataQualityPayload = async (req) => {
  const params = [];
  const employeeScopeWhere = buildEmployeeScopeWhere(req, params, 'e');
  const result = await pool.query(`
    with scoped_employees as (
      select e.*
      from employees e
      where ${employeeScopeWhere}
    ),
    scoped_allocations as (
      select pa.*, p.name as project_name, p.start_date as project_start_date, p.end_date as project_end_date
      from project_allocations pa
      join scoped_employees e on e.id = pa.employee_id
      join projects p on p.id = pa.project_id
    ),
    issues as (
      select
        'Employee' as entity_type,
        e.id as entity_id,
        e.name as entity,
        'Missing reporting manager' as issue_type,
        coalesce(e.email, e.employee_id) as owner,
        'Approval routing and team views may be unreliable.' as impact,
        'Assign a reporting manager in Employee Master.' as suggested_action
      from scoped_employees e
      where e.status = 'Active' and e.reporting_manager_id is null

      union all

      select
        'Employee',
        e.id,
        e.name,
        'Missing capacity profile',
        coalesce(e.email, e.employee_id),
        'Availability and utilization handover checks cannot be fully trusted.',
        'Set standard weekly hours, capacity type, and contract type.'
      from scoped_employees e
      where e.status = 'Active'
        and (e.standard_weekly_hours is null or e.capacity_type is null or e.contract_type is null)

      union all

      select
        'Employee',
        e.id,
        e.name,
        'Missing Teams identity link',
        coalesce(e.email, e.employee_id),
        'Future Teams approvals and reminders cannot target this user.',
        'Capture the Teams user link during identity onboarding.'
      from scoped_employees e
      where e.status = 'Active' and nullif(e.teams_user_id, '') is null

      union all

      select
        'Employee',
        e.id,
        e.name,
        'Demo data remnant',
        coalesce(e.email, e.employee_id),
        'Production handover may still contain seeded demo records.',
        'Replace demo user and employee records with company-owned data.'
      from scoped_employees e
      where e.email ilike '%.demo' or e.email ilike '%@boundaryless.demo'

      union all

      select
        'Allocation',
        sa.id,
        sa.project_name,
        'Allocation outside project timeline',
        sa.employee_id,
        'Planned and forecast utilization can be incorrect for this assignment.',
        'Adjust allocation dates to fit within the project start and end dates.'
      from scoped_allocations sa
      where sa.start_date < sa.project_start_date or sa.end_date > sa.project_end_date
    )
    select * from issues order by issue_type, entity
  `, params);

  const scopedCount = await pool.query(`
    select count(*)::int as count
    from employees e
    where ${employeeScopeWhere}
  `, params);
  const totalRecords = Number(scopedCount.rows[0]?.count || 0);
  const issueCount = result.rows.length;
  const denominator = Math.max(totalRecords * 4, 1);
  const score = Math.max(0, Math.round(((denominator - issueCount) / denominator) * 100));
  const byType = result.rows.reduce((acc, issue) => {
    acc[issue.issue_type] = (acc[issue.issue_type] || 0) + 1;
    return acc;
  }, {});
  return {
    score,
    totalRecords,
    issueCount,
    byType,
    issues: result.rows,
    generatedAt: new Date().toISOString(),
  };
};

app.get('/api/reports/data-quality', requireDatabase, requireAuth, requireRoles('Admin', 'HR', 'CountryDirector', 'ProjectManager', 'TeamLead'), async (req, res) => {
  try {
    res.json(await getDataQualityPayload(req));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Data quality report failed' });
  }
});

app.get('/api/reports/dashboard', requireDatabase, requireAuth, requireRoles('Admin', 'HR', 'CountryDirector', 'ProjectManager', 'TeamLead'), async (req, res) => {
  const params = [];
  const employeeScopeWhere = buildEmployeeScopeWhere(req, params, 'e');
  const projectRiskParams = [];
  const projectScopeWhere = buildProjectScopeWhere(req, projectRiskParams, 'p');
  try {
    const [settingsResult, workforceResult, projectRiskResult, pendingTimesheetsResult, quality] = await Promise.all([
      pool.query('select key, value from system_settings'),
      pool.query(`
        select
          count(*) filter (where e.status = 'Active')::int as active_people,
          count(*) filter (where e.status = 'Active' and e.utilization_eligible = true)::int as utilization_eligible_fte,
          count(*) filter (where e.status = 'Active' and e.utilization_eligible = false)::int as governance_users
        from employees e
        where ${employeeScopeWhere}
      `, params),
      pool.query(`
        select count(distinct p.id)::int as staffing_risks
        from projects p
        where p.status in ('Active', 'Proposed')
          and ${projectScopeWhere}
          and not exists (
            select 1 from project_allocations pa
            where pa.project_id = p.id and pa.status = 'Active'
          )
      `, projectRiskParams),
      pool.query(`
        select count(*)::int as pending
        from timesheets t
        join employees e on e.id = t.employee_id
        where t.status = 'Submitted' and ${employeeScopeWhere}
      `, params),
      getDataQualityPayload(req),
    ]);
    const settings = Object.fromEntries(settingsResult.rows.map(row => [row.key, row.value]));
    res.json({
      generatedAt: new Date().toISOString(),
      settings,
      workforce: workforceResult.rows[0] || {},
      projectStaffingRisks: Number(projectRiskResult.rows[0]?.staffing_risks || 0),
      pendingTimesheets: Number(pendingTimesheetsResult.rows[0]?.pending || 0),
      dataQuality: quality,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Dashboard report failed' });
  }
});

app.get('/api/import-export-logs', requireDatabase, requireAuth, requireRoles('Admin', 'HR'), (_req, res) => run(res, 'select * from import_export_logs order by created_at desc limit 100'));
app.post('/api/import-export-logs', requireDatabase, requireAuth, requireRoles('Admin', 'HR'), async (req, res) => {
  const schema = z.object({
    operation: z.enum(['Import', 'Export']),
    channel: z.string().min(1),
    fileName: z.string().min(1),
    status: z.enum(['Success', 'Partial', 'Failed', 'Dry Run']),
    totalRows: z.number().int().min(0),
    validRows: z.number().int().min(0),
    errorRows: z.number().int().min(0),
    errors: z.array(z.object({
      rowNumber: z.number().int(),
      field: z.string().optional(),
      message: z.string(),
    })).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  await run(res, `
    insert into import_export_logs (operation, channel, file_name, status, total_rows, valid_rows, error_rows, errors, user_name)
    values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    returning *
  `, [
    parsed.data.operation,
    parsed.data.channel,
    parsed.data.fileName,
    parsed.data.status,
    parsed.data.totalRows,
    parsed.data.validRows,
    parsed.data.errorRows,
    parsed.data.errors ? JSON.stringify(parsed.data.errors) : null,
    req.user.username,
  ]);
});

app.post('/api/imports/employees/apply', requireDatabase, requireAuth, requireRoles('Admin', 'HR'), async (req, res) => {
  const rowSchema = z.object({
    employeeId: z.string().min(1),
    name: z.string().min(1),
    email: z.string().email(),
    designation: z.string().optional(),
    department: z.string().optional(),
    country: z.string().optional(),
    reportingManagerId: z.string().optional(),
    primaryCountryDirectorId: z.string().optional(),
    mappedCountryDirectorIds: z.union([z.string(), z.array(z.string())]).optional(),
    status: z.enum(['Active', 'On Leave', 'Exited']).optional(),
    utilizationEligible: z.union([z.boolean(), z.string()]).optional(),
    joiningDate: z.string().optional(),
    exitDate: z.string().optional(),
    standardWeeklyHours: z.union([z.number(), z.string()]).optional(),
    capacityType: z.string().optional(),
    contractType: z.string().optional(),
    entraObjectId: z.string().optional(),
    teamsUserId: z.string().optional(),
    roles: z.union([z.string(), z.array(z.string())]).optional(),
    initialPassword: z.string().optional(),
  });
  const schema = z.object({
    fileName: z.string().min(1),
    rows: z.array(rowSchema).min(1),
    totalRows: z.number().int().min(0).optional(),
    clientErrors: z.array(z.object({
      rowNumber: z.number().int(),
      field: z.string().optional(),
      message: z.string(),
    })).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const client = await pool.connect();
  const errors = [...(parsed.data.clientErrors || [])];
  let saved = 0;
  try {
    await client.query('begin');
    const directorResult = await client.query('select id from country_directors');
    const directorIds = new Set(directorResult.rows.map(row => row.id));
    const employeeRole = (await client.query('select id from roles where name = $1', ['Employee'])).rows[0];

    for (const [index, row] of parsed.data.rows.entries()) {
      const rowNumber = index + 2;
      const mappedIds = splitPipeList(row.mappedCountryDirectorIds);
      const primaryDirectorId = row.primaryCountryDirectorId || mappedIds[0] || null;
      const rowErrors = [];
      if (!primaryDirectorId) rowErrors.push({ rowNumber, field: 'primaryCountryDirectorId', message: 'Primary country director is required.' });
      if (primaryDirectorId && !directorIds.has(primaryDirectorId)) rowErrors.push({ rowNumber, field: 'primaryCountryDirectorId', message: 'Primary country director does not exist.' });
      for (const directorId of mappedIds) {
        if (!directorIds.has(directorId)) rowErrors.push({ rowNumber, field: 'mappedCountryDirectorIds', message: `Country director ${directorId} does not exist.` });
      }
      let reportingManagerId = null;
      if (row.reportingManagerId) {
        const manager = (await client.query(`
          select id from employees
          where (id = $1 or employee_id = $1) and status <> 'Exited'
          limit 1
        `, [row.reportingManagerId])).rows[0];
        if (!manager) rowErrors.push({ rowNumber, field: 'reportingManagerId', message: 'Reporting manager employee record does not exist or is exited.' });
        reportingManagerId = manager?.id || null;
      }
      if (rowErrors.length > 0) {
        errors.push(...rowErrors);
        continue;
      }

      const previous = (await client.query('select * from employees where employee_id = $1 limit 1', [row.employeeId])).rows[0];
      const employeeCode = row.employeeId.toUpperCase();
      const designation = row.designation || previous?.designation || 'Consultant';
      const department = row.department || previous?.department || 'Digital Transformation';
      const defaultUtilizationEligible = !(
        employeeCode.startsWith('ADMIN-') ||
        employeeCode.startsWith('HR-') ||
        employeeCode.startsWith('CD-') ||
        designation.toLowerCase() === 'country director' ||
        designation.toLowerCase() === 'system administrator' ||
        designation.toLowerCase() === 'hr manager' ||
        department.toLowerCase() === 'regional leadership' ||
        department.toLowerCase() === 'administration' ||
        department.toLowerCase() === 'human resources'
      );
      const utilizationEligible = parseBoolean(row.utilizationEligible, previous?.utilization_eligible ?? defaultUtilizationEligible);
      const standardWeeklyHours = row.standardWeeklyHours === undefined || row.standardWeeklyHours === ''
        ? Number(previous?.standard_weekly_hours || 40)
        : Number(row.standardWeeklyHours);
      const employeeResult = await client.query(`
        insert into employees (
          id, employee_id, name, email, designation, department, country, reporting_manager_id,
          primary_country_director_id, status, utilization_eligible, joining_date, exit_date,
          standard_weekly_hours, capacity_type, contract_type, entra_object_id, teams_user_id, updated_at
        )
        values (coalesce($1, 'e-' || gen_random_uuid()::text), $2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,now())
        on conflict (employee_id) do update set
          name = excluded.name,
          email = excluded.email,
          designation = excluded.designation,
          department = excluded.department,
          country = excluded.country,
          reporting_manager_id = excluded.reporting_manager_id,
          primary_country_director_id = excluded.primary_country_director_id,
          status = excluded.status,
          utilization_eligible = excluded.utilization_eligible,
          joining_date = excluded.joining_date,
          exit_date = excluded.exit_date,
          standard_weekly_hours = excluded.standard_weekly_hours,
          capacity_type = excluded.capacity_type,
          contract_type = excluded.contract_type,
          entra_object_id = excluded.entra_object_id,
          teams_user_id = excluded.teams_user_id,
          updated_at = now()
        returning *
      `, [
        previous?.id || null,
        row.employeeId,
        row.name,
        row.email,
        designation,
        department,
        row.country || previous?.country || 'United Kingdom',
        reportingManagerId || previous?.reporting_manager_id || null,
        primaryDirectorId,
        row.status || previous?.status || 'Active',
        utilizationEligible,
        row.joiningDate || previous?.joining_date || null,
        row.exitDate || previous?.exit_date || null,
        Number.isFinite(standardWeeklyHours) ? standardWeeklyHours : 40,
        row.capacityType || previous?.capacity_type || (utilizationEligible ? 'Delivery' : 'Governance'),
        row.contractType || previous?.contract_type || 'Permanent',
        row.entraObjectId || previous?.entra_object_id || null,
        row.teamsUserId || previous?.teams_user_id || null,
      ]);
      const employee = employeeResult.rows[0];
      const allMappedIds = Array.from(new Set([primaryDirectorId, ...mappedIds].filter(Boolean)));
      await client.query('delete from employee_country_director_map where employee_id = $1', [employee.id]);
      for (const directorId of allMappedIds) {
        await client.query(`
          insert into employee_country_director_map (employee_id, country_director_id)
          values ($1,$2)
          on conflict do nothing
        `, [employee.id, directorId]);
      }

      const existingUser = (await client.query('select id from users where lower(username) = lower($1) or employee_id = $2', [row.employeeId, row.employeeId])).rows[0];
      const passwordHash = existingUser ? null : await scryptHash(row.initialPassword || process.env.DEMO_SEED_PASSWORD || 'demo123');
      const userResult = await client.query(`
        insert into users (username, employee_id, email, password_hash, status, updated_at)
        values ($1,$2,$3,$4,$5,now())
        on conflict (username) do update set
          employee_id = excluded.employee_id,
          email = excluded.email,
          password_hash = coalesce($4, users.password_hash),
          status = excluded.status,
          updated_at = now()
        returning id
      `, [
        row.employeeId,
        row.employeeId,
        row.email,
        passwordHash,
        employee.status === 'Exited' ? 'Disabled' : 'Active',
      ]);
      const roleNames = splitPipeList(row.roles);
      const requestedRoles = roleNames.length > 0 ? roleNames : ['Employee'];
      const rolesResult = await client.query('select id, name from roles where name = any($1::text[])', [requestedRoles]);
      if (rolesResult.rows.length > 0) {
        await client.query('delete from user_roles where user_id = $1', [userResult.rows[0].id]);
        for (const role of rolesResult.rows) {
          await client.query('insert into user_roles (user_id, role_id) values ($1,$2) on conflict do nothing', [userResult.rows[0].id, role.id]);
        }
      } else if (employeeRole) {
        await client.query('insert into user_roles (user_id, role_id) values ($1,$2) on conflict do nothing', [userResult.rows[0].id, employeeRole.id]);
      }
      await audit(client, req, {
        module: 'Import',
        action: previous ? 'Import Update Employee' : 'Import Create Employee',
        entityType: 'Employee',
        entityId: employee.id,
        oldValue: previous,
        newValue: employee,
        details: `${previous ? 'Updated' : 'Created'} employee ${employee.employee_id} from ${parsed.data.fileName}`,
      });
      saved += 1;
    }

    const status = saved === 0 ? 'Failed' : errors.length > 0 ? 'Partial' : 'Success';
    const logResult = await client.query(`
      insert into import_export_logs (operation, channel, file_name, status, total_rows, valid_rows, error_rows, errors, user_name)
      values ('Import','Employee Master',$1,$2,$3,$4,$5,$6,$7)
      returning *
    `, [
      parsed.data.fileName,
      status,
      parsed.data.totalRows ?? parsed.data.rows.length,
      saved,
      errors.length,
      errors.length ? JSON.stringify(errors) : null,
      req.user.username,
    ]);
    await client.query('commit');
    res.json({
      status,
      totalRows: parsed.data.totalRows ?? parsed.data.rows.length,
      validRows: saved,
      errorRows: errors.length,
      errors,
      log: logResult.rows[0],
    });
  } catch (error) {
    await client.query('rollback');
    console.error(error);
    res.status(500).json({ error: 'Employee import apply failed' });
  } finally {
    client.release();
  }
});

app.post('/api/imports/clients/apply', requireDatabase, requireAuth, requireRoles('Admin', 'HR'), async (req, res) => {
  const rowSchema = z.object({
    id: z.string().min(1).optional(),
    name: z.string().min(1),
    industry: z.string().optional(),
    accountOwnerId: z.string().optional(),
    countryDirectorIds: z.union([z.string(), z.array(z.string())]).optional(),
    status: z.enum(['Active', 'Inactive']).optional(),
  });
  const schema = z.object({
    fileName: z.string().min(1),
    rows: z.array(rowSchema).min(1),
    totalRows: z.number().int().min(0).optional(),
    clientErrors: z.array(z.object({
      rowNumber: z.number().int(),
      field: z.string().optional(),
      message: z.string(),
    })).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const client = await pool.connect();
  const errors = [...(parsed.data.clientErrors || [])];
  let saved = 0;
  try {
    await client.query('begin');
    const directorResult = await client.query('select id from country_directors');
    const directorIds = new Set(directorResult.rows.map(row => row.id));

    for (const [index, row] of parsed.data.rows.entries()) {
      const rowNumber = index + 2;
      const countryDirectorIds = splitPipeList(row.countryDirectorIds);
      const rowErrors = [];
      for (const directorId of countryDirectorIds) {
        if (!directorIds.has(directorId)) rowErrors.push({ rowNumber, field: 'countryDirectorIds', message: `Country director ${directorId} does not exist.` });
      }
      let accountOwnerId = row.accountOwnerId || null;
      if (accountOwnerId) {
        const owner = (await client.query(
          'select id from employees where (id = $1 or employee_id = $1) and status <> $2',
          [accountOwnerId, 'Exited'],
        )).rows[0];
        if (!owner) {
          rowErrors.push({ rowNumber, field: 'accountOwnerId', message: 'Account owner employee record does not exist or is exited.' });
        } else {
          accountOwnerId = owner.id;
        }
      }
      if (rowErrors.length > 0) {
        errors.push(...rowErrors);
        continue;
      }

      const previous = (await client.query(`
        select *
        from clients
        where ($1::text is not null and id = $1) or lower(name) = lower($2)
        limit 1
      `, [row.id || null, row.name])).rows[0];
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
      `, [
        previous?.id || row.id || null,
        row.name,
        row.industry || previous?.industry || 'Unclassified',
        accountOwnerId || previous?.account_owner_id || null,
        row.status || previous?.status || 'Active',
      ]);
      const savedClient = result.rows[0];
      await client.query('delete from client_country_director_map where client_id = $1', [savedClient.id]);
      for (const directorId of countryDirectorIds) {
        await client.query(`
          insert into client_country_director_map (client_id, country_director_id)
          values ($1, $2)
          on conflict do nothing
        `, [savedClient.id, directorId]);
      }
      await client.query(
        'update projects set client_id = $1, client = $2, updated_at = now() where client_id = $1 or client = $3',
        [savedClient.id, savedClient.name, previous?.name || savedClient.name],
      );
      await audit(client, req, {
        module: 'Import',
        action: previous ? 'Import Update Client' : 'Import Create Client',
        entityType: 'Client',
        entityId: savedClient.id,
        oldValue: previous,
        newValue: savedClient,
        details: `${previous ? 'Updated' : 'Created'} client ${savedClient.name} from ${parsed.data.fileName}`,
      });
      saved += 1;
    }

    const status = saved === 0 ? 'Failed' : errors.length > 0 ? 'Partial' : 'Success';
    const logResult = await client.query(`
      insert into import_export_logs (operation, channel, file_name, status, total_rows, valid_rows, error_rows, errors, user_name)
      values ('Import','Client Master',$1,$2,$3,$4,$5,$6,$7)
      returning *
    `, [
      parsed.data.fileName,
      status,
      parsed.data.totalRows ?? parsed.data.rows.length,
      saved,
      errors.length,
      errors.length ? JSON.stringify(errors) : null,
      req.user.username,
    ]);
    await client.query('commit');
    res.json({
      status,
      totalRows: parsed.data.totalRows ?? parsed.data.rows.length,
      validRows: saved,
      errorRows: errors.length,
      errors,
      log: logResult.rows[0],
    });
  } catch (error) {
    await client.query('rollback');
    console.error(error);
    res.status(500).json({ error: 'Client import apply failed' });
  } finally {
    client.release();
  }
});

app.post('/api/imports/projects/apply', requireDatabase, requireAuth, requireRoles('Admin', 'HR'), async (req, res) => {
  const rowSchema = z.object({
    projectCode: z.string().min(1),
    name: z.string().min(1),
    clientId: z.string().optional(),
    client: z.string().min(1),
    managerId: z.string().min(1),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    status: z.enum(['Proposed', 'Active', 'On Hold', 'Completed']).optional(),
    billable: z.union([z.boolean(), z.string()]).optional(),
    projectType: z.string().optional(),
    country: z.string().optional(),
    notes: z.string().optional(),
  });
  const schema = z.object({
    fileName: z.string().min(1),
    rows: z.array(rowSchema).min(1),
    totalRows: z.number().int().min(0).optional(),
    clientErrors: z.array(z.object({
      rowNumber: z.number().int(),
      field: z.string().optional(),
      message: z.string(),
    })).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const client = await pool.connect();
  const errors = [...(parsed.data.clientErrors || [])];
  let saved = 0;
  try {
    await client.query('begin');

    for (const [index, row] of parsed.data.rows.entries()) {
      const rowNumber = index + 2;
      const rowErrors = [];
      if (row.endDate < row.startDate) {
        rowErrors.push({ rowNumber, field: 'endDate', message: 'End date must be on or after start date.' });
      }

      const clientRecord = (await client.query(`
        select id, name, status
        from clients
        where ($1::text is not null and id = $1) or lower(name) = lower($2)
        limit 1
      `, [row.clientId || null, row.client])).rows[0];
      if (!clientRecord || clientRecord.status !== 'Active') {
        rowErrors.push({ rowNumber, field: 'client', message: 'Project must reference an active client.' });
      }

      const manager = (await client.query(`
        select id, name, status
        from employees
        where (id = $1 or employee_id = $1) and status <> 'Exited'
        limit 1
      `, [row.managerId])).rows[0];
      if (!manager) {
        rowErrors.push({ rowNumber, field: 'managerId', message: 'Project manager employee record does not exist or is exited.' });
      }

      if (rowErrors.length > 0) {
        errors.push(...rowErrors);
        continue;
      }

      const previous = (await client.query('select * from projects where project_code = $1 limit 1', [row.projectCode])).rows[0];
      const result = await client.query(`
        insert into projects (id, project_code, name, client_id, client, manager_id, manager_name, start_date, end_date, status, billable, project_type, country, notes)
        values (coalesce($1, 'p-' || gen_random_uuid()::text), $2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
        on conflict (project_code) do update set
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
        previous?.id || null,
        row.projectCode,
        row.name,
        clientRecord.id,
        clientRecord.name,
        manager.id,
        manager.name,
        row.startDate,
        row.endDate,
        row.status || previous?.status || 'Proposed',
        parseBoolean(row.billable, previous?.billable ?? true),
        row.projectType || previous?.project_type || null,
        row.country || previous?.country || null,
        row.notes || previous?.notes || null,
      ]);
      const project = result.rows[0];
      await audit(client, req, {
        module: 'Import',
        action: previous ? 'Import Update Project' : 'Import Create Project',
        entityType: 'Project',
        entityId: project.id,
        oldValue: previous,
        newValue: project,
        details: `${previous ? 'Updated' : 'Created'} project ${project.project_code} from ${parsed.data.fileName}`,
      });
      saved += 1;
    }

    const status = saved === 0 ? 'Failed' : errors.length > 0 ? 'Partial' : 'Success';
    const logResult = await client.query(`
      insert into import_export_logs (operation, channel, file_name, status, total_rows, valid_rows, error_rows, errors, user_name)
      values ('Import','Project Master',$1,$2,$3,$4,$5,$6,$7)
      returning *
    `, [
      parsed.data.fileName,
      status,
      parsed.data.totalRows ?? parsed.data.rows.length,
      saved,
      errors.length,
      errors.length ? JSON.stringify(errors) : null,
      req.user.username,
    ]);
    await client.query('commit');
    res.json({
      status,
      totalRows: parsed.data.totalRows ?? parsed.data.rows.length,
      validRows: saved,
      errorRows: errors.length,
      errors,
      log: logResult.rows[0],
    });
  } catch (error) {
    await client.query('rollback');
    console.error(error);
    res.status(500).json({ error: 'Project import apply failed' });
  } finally {
    client.release();
  }
});

app.post('/api/imports/allocations/apply', requireDatabase, requireAuth, requireRoles('Admin', 'HR'), async (req, res) => {
  const rowSchema = z.object({
    id: z.string().min(1).optional(),
    employeeId: z.string().min(1),
    projectId: z.string().min(1),
    roleOnProject: z.string().optional(),
    percentage: z.coerce.number().min(0).max(200),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    billable: z.union([z.boolean(), z.string()]).optional(),
    status: z.enum(['Active', 'Paused', 'Completed']).optional(),
    comments: z.string().optional(),
  });
  const schema = z.object({
    fileName: z.string().min(1),
    rows: z.array(rowSchema).min(1),
    totalRows: z.number().int().min(0).optional(),
    clientErrors: z.array(z.object({
      rowNumber: z.number().int(),
      field: z.string().optional(),
      message: z.string(),
    })).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const client = await pool.connect();
  const errors = [...(parsed.data.clientErrors || [])];
  let saved = 0;
  try {
    await client.query('begin');
    const blockOverAllocation = await getSetting('blockOverAllocation', false);

    for (const [index, row] of parsed.data.rows.entries()) {
      const rowNumber = index + 2;
      const rowErrors = [];
      if (row.endDate < row.startDate) {
        rowErrors.push({ rowNumber, field: 'endDate', message: 'End date must be on or after start date.' });
      }

      const employee = (await client.query(`
        select *
        from employees
        where (id = $1 or employee_id = $1) and status <> 'Exited'
        limit 1
      `, [row.employeeId])).rows[0];
      if (!employee) {
        rowErrors.push({ rowNumber, field: 'employeeId', message: 'Allocation must reference an active employee.' });
      }

      const project = (await client.query(`
        select *
        from projects
        where (id = $1 or project_code = $1) and status in ('Active', 'Proposed')
        limit 1
      `, [row.projectId])).rows[0];
      if (!project) {
        rowErrors.push({ rowNumber, field: 'projectId', message: 'Allocation must reference an active or proposed project.' });
      } else if (row.startDate < toIsoDate(project.start_date) || row.endDate > toIsoDate(project.end_date)) {
        rowErrors.push({ rowNumber, field: 'startDate', message: 'Allocation dates must stay within the project timeline.' });
      }

      if (blockOverAllocation && employee && row.status !== 'Paused' && row.status !== 'Completed') {
        const loadResult = await client.query(`
          select coalesce(sum(percentage), 0) as total
          from project_allocations
          where employee_id = $1
            and id <> coalesce($2, '')
            and status = 'Active'
            and daterange(start_date, end_date, '[]') && daterange($3::date, $4::date, '[]')
        `, [employee.id, row.id || null, row.startDate, row.endDate]);
        const total = parsePercent(loadResult.rows[0]?.total) + row.percentage;
        if (total > 100) {
          rowErrors.push({ rowNumber, field: 'percentage', message: `Allocation would exceed 100% for overlapping dates (${total}%).` });
        }
      }

      if (rowErrors.length > 0) {
        errors.push(...rowErrors);
        continue;
      }

      const previous = row.id
        ? (await client.query('select * from project_allocations where id = $1 limit 1', [row.id])).rows[0]
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
        previous?.id || row.id || null,
        employee.id,
        project.id,
        row.roleOnProject || previous?.role_on_project || employee.designation,
        row.percentage,
        row.startDate,
        row.endDate,
        parseBoolean(row.billable, previous?.billable ?? true),
        row.status || previous?.status || 'Active',
        row.comments || previous?.comments || null,
      ]);
      const allocation = result.rows[0];
      await audit(client, req, {
        module: 'Import',
        action: previous ? 'Import Update Allocation' : 'Import Create Allocation',
        entityType: 'Allocation',
        entityId: allocation.id,
        oldValue: previous,
        newValue: allocation,
        details: `${previous ? 'Updated' : 'Created'} allocation for ${employee.employee_id} on ${project.project_code} from ${parsed.data.fileName}`,
      });
      saved += 1;
    }

    const status = saved === 0 ? 'Failed' : errors.length > 0 ? 'Partial' : 'Success';
    const logResult = await client.query(`
      insert into import_export_logs (operation, channel, file_name, status, total_rows, valid_rows, error_rows, errors, user_name)
      values ('Import','Allocation Control',$1,$2,$3,$4,$5,$6,$7)
      returning *
    `, [
      parsed.data.fileName,
      status,
      parsed.data.totalRows ?? parsed.data.rows.length,
      saved,
      errors.length,
      errors.length ? JSON.stringify(errors) : null,
      req.user.username,
    ]);
    await client.query('commit');
    res.json({
      status,
      totalRows: parsed.data.totalRows ?? parsed.data.rows.length,
      validRows: saved,
      errorRows: errors.length,
      errors,
      log: logResult.rows[0],
    });
  } catch (error) {
    await client.query('rollback');
    console.error(error);
    res.status(500).json({ error: 'Allocation import apply failed' });
  } finally {
    client.release();
  }
});

app.post('/api/imports/timesheets/apply', requireDatabase, requireAuth, requireRoles('Admin', 'HR'), async (req, res) => {
  const rowSchema = z.object({
    employeeId: z.string().min(1),
    weekEnding: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    workType: z.enum(['Project Work', 'Client Misc Task']),
    projectId: z.string().optional(),
    clientName: z.string().optional(),
    category: z.string().optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    hours: z.coerce.number().min(0).max(24),
    remark: z.string().optional(),
    billable: z.union([z.boolean(), z.string()]).optional(),
    status: z.enum(['Draft', 'Submitted', 'Approved', 'Rejected']).optional(),
    rejectionReason: z.string().optional(),
  });
  const schema = z.object({
    fileName: z.string().min(1),
    rows: z.array(rowSchema).min(1),
    totalRows: z.number().int().min(0).optional(),
    clientErrors: z.array(z.object({
      rowNumber: z.number().int(),
      field: z.string().optional(),
      message: z.string(),
    })).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const client = await pool.connect();
  const errors = [...(parsed.data.clientErrors || [])];
  const groups = new Map();
  let validEntryRows = 0;
  try {
    await client.query('begin');

    for (const [index, row] of parsed.data.rows.entries()) {
      const rowNumber = index + 2;
      const rowErrors = [];
      if (isAfterToday(row.weekEnding) || isAfterToday(row.date)) {
        rowErrors.push({ rowNumber, field: 'date', message: 'Future week timesheets and future-dated entries cannot be imported.' });
      }

      const employee = (await client.query(`
        select id, employee_id, name, status
        from employees
        where (id = $1 or employee_id = $1) and status <> 'Exited'
        limit 1
      `, [row.employeeId])).rows[0];
      if (!employee) {
        rowErrors.push({ rowNumber, field: 'employeeId', message: 'Timesheet must reference an active employee.' });
      }

      let project = null;
      if (row.workType === 'Project Work') {
        if (!row.projectId) {
          rowErrors.push({ rowNumber, field: 'projectId', message: 'Project Work entries require a project.' });
        } else {
          project = (await client.query(`
            select id, name, status
            from projects
            where (id = $1 or project_code = $1) and status <> 'Completed'
            limit 1
          `, [row.projectId])).rows[0];
          if (!project) {
            rowErrors.push({ rowNumber, field: 'projectId', message: 'Project Work entries must reference active, proposed, or on-hold projects.' });
          }
        }
      }
      if (row.workType === 'Client Misc Task' && !row.clientName) {
        rowErrors.push({ rowNumber, field: 'clientName', message: 'Client Misc Task entries require a client name.' });
      }

      if (rowErrors.length > 0) {
        errors.push(...rowErrors);
        continue;
      }

      const status = row.status || 'Submitted';
      const key = `${employee.id}:${row.weekEnding}`;
      const group = groups.get(key) || {
        employee,
        weekEnding: row.weekEnding,
        status,
        rejectionReason: row.rejectionReason || null,
        entries: [],
      };
      if (group.status !== status) {
        errors.push({ rowNumber, field: 'status', message: 'Rows for the same employee/week must use the same timesheet status.' });
        continue;
      }
      group.entries.push({
        projectId: project?.id || null,
        workType: row.workType,
        clientName: row.clientName || null,
        category: row.category || null,
        workDate: row.date,
        hours: round1(row.hours),
        remark: row.remark || null,
        billable: parseBoolean(row.billable, row.workType === 'Project Work'),
      });
      groups.set(key, group);
      validEntryRows += 1;
    }

    for (const group of groups.values()) {
      const totalHours = round1(group.entries.reduce((sum, entry) => sum + Number(entry.hours || 0), 0));
      const billableHours = round1(group.entries.filter(entry => entry.billable).reduce((sum, entry) => sum + Number(entry.hours || 0), 0));
      const previous = (await client.query('select * from timesheets where employee_id = $1 and week_ending = $2', [group.employee.id, group.weekEnding])).rows[0];
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
        group.employee.id,
        group.weekEnding,
        group.status,
        totalHours,
        billableHours,
        group.rejectionReason,
      ]);
      const timesheet = timesheetResult.rows[0];
      await client.query('delete from timesheet_entries where timesheet_id = $1', [timesheet.id]);
      for (const entry of group.entries) {
        await client.query(`
          insert into timesheet_entries (timesheet_id, project_id, work_type, client_name, category, work_date, hours, remark, billable)
          values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        `, [
          timesheet.id,
          entry.projectId,
          entry.workType,
          entry.clientName,
          entry.category,
          entry.workDate,
          entry.hours,
          entry.remark,
          entry.billable,
        ]);
      }
      await audit(client, req, {
        module: 'Import',
        action: previous ? 'Import Update Timesheet' : 'Import Create Timesheet',
        entityType: 'Timesheet',
        entityId: String(timesheet.id),
        oldValue: previous,
        newValue: timesheet,
        details: `${previous ? 'Updated' : 'Created'} ${group.status} timesheet for ${group.employee.employee_id}, week ending ${group.weekEnding} from ${parsed.data.fileName}`,
        reason: group.rejectionReason,
      });
    }

    const status = validEntryRows === 0 ? 'Failed' : errors.length > 0 ? 'Partial' : 'Success';
    const logResult = await client.query(`
      insert into import_export_logs (operation, channel, file_name, status, total_rows, valid_rows, error_rows, errors, user_name)
      values ('Import','Timesheet Import',$1,$2,$3,$4,$5,$6,$7)
      returning *
    `, [
      parsed.data.fileName,
      status,
      parsed.data.totalRows ?? parsed.data.rows.length,
      validEntryRows,
      errors.length,
      errors.length ? JSON.stringify(errors) : null,
      req.user.username,
    ]);
    await client.query('commit');
    res.json({
      status,
      totalRows: parsed.data.totalRows ?? parsed.data.rows.length,
      validRows: validEntryRows,
      errorRows: errors.length,
      errors,
      log: logResult.rows[0],
    });
  } catch (error) {
    await client.query('rollback');
    console.error(error);
    res.status(500).json({ error: 'Timesheet import apply failed' });
  } finally {
    client.release();
  }
});

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

if (isProduction || process.env.SERVE_STATIC === 'true') {
  if (existsSync(distDir)) {
    app.use('/assets', express.static(join(distDir, 'assets'), {
      immutable: true,
      maxAge: '1y',
    }));
    app.use(express.static(distDir, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('index.html')) {
          res.setHeader('Cache-Control', 'no-store');
        }
      },
    }));
    app.get('*', (req, res) => {
      if (req.path.startsWith('/assets/')) {
        res.status(404).send('Asset not found');
        return;
      }
      res.setHeader('Cache-Control', 'no-store');
      res.sendFile(join(distDir, 'index.html'));
    });
  } else if (isProduction) {
    console.error(`Production startup blocked. Built frontend not found at ${distDir}. Run npm run build first.`);
    process.exit(1);
  }
}

app.listen(port, () => {
  console.log(`Boundaryless-WorkOS Workforce Operations Core API listening on http://localhost:${port}`);
});
