import 'dotenv/config';
import crypto from 'node:crypto';
import pg from 'pg';
import {
  DEFAULT_COUNTRIES,
  DEFAULT_DEPARTMENTS,
  DEFAULT_INDUSTRIES,
  createDefaultCatalog,
  generateDemoDataset,
} from '../src/services/demoData.ts';

const { Pool } = pg;

const reset = process.argv.includes('--reset') || process.env.RESET_DEMO_DATA === 'true';
const password = process.env.DEMO_SEED_PASSWORD || 'demo123';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required to seed demo data.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined,
});

const scryptHash = async (value) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const key = await new Promise((resolve, reject) => {
    crypto.scrypt(value, salt, 64, (error, result) => error ? reject(error) : resolve(result.toString('hex')));
  });
  return `scrypt$${salt}$${key}`;
};

const rolesForEmployee = (employee) => {
  if (employee.employeeId === 'ADMIN-1') return ['Admin'];
  if (employee.employeeId === 'HR-1') return ['HR'];
  if (employee.employeeId.startsWith('CD-')) return ['CountryDirector'];
  if (employee.employeeId.startsWith('PM-')) return ['ProjectManager', 'Employee'];
  return ['Employee'];
};

const query = (client, text, params = []) => client.query(text, params);

const seed = async () => {
  const dataset = generateDemoDataset();
  const catalogItems = [
    ...createDefaultCatalog('department', DEFAULT_DEPARTMENTS).map(item => ({ ...item, catalogType: 'departments' })),
    ...createDefaultCatalog('country', DEFAULT_COUNTRIES).map(item => ({ ...item, catalogType: 'countries' })),
    ...createDefaultCatalog('industry', DEFAULT_INDUSTRIES).map(item => ({ ...item, catalogType: 'industries' })),
  ];
  const passwordHash = await scryptHash(password);
  const client = await pool.connect();

  try {
    await client.query('begin');

    if (reset) {
      await client.query(`
        truncate table
          audit_logs,
          timesheet_entries,
          timesheets,
          project_allocations,
          projects,
          employee_country_director_map,
          employees,
          client_country_director_map,
          clients,
          role_definitions,
          catalog_items,
          user_roles,
          users,
          country_directors
        restart identity cascade
      `);
    }

    await query(client, `
      insert into roles(name)
      values ('Employee'), ('TeamLead'), ('ProjectManager'), ('CountryDirector'), ('HR'), ('Admin')
      on conflict (name) do nothing
    `);

    for (const director of dataset.countryDirectors) {
      await query(client, `
        insert into country_directors (id, name, region)
        values ($1,$2,$3)
        on conflict (id) do update set name = excluded.name, region = excluded.region
      `, [director.id, director.name, director.region]);
    }

    for (const item of catalogItems) {
      await query(client, `
        update catalog_items
        set catalog_type = $2,
            name = $3,
            active = $4,
            updated_at = $6
        where id = $1
           or (catalog_type = $2 and name = $3)
      `, [item.id, item.catalogType, item.name, item.active, item.createdAt, item.updatedAt || item.createdAt]);

      await query(client, `
        insert into catalog_items (id, catalog_type, name, active, created_at, updated_at)
        select $1::text,$2::text,$3::text,$4::boolean,$5::timestamptz,$6::timestamptz
        where not exists (
          select 1 from catalog_items where id = $1 or (catalog_type = $2 and name = $3)
        )
      `, [item.id, item.catalogType, item.name, item.active, item.createdAt, item.updatedAt || item.createdAt]);
    }

    for (const role of dataset.roleDefinitions) {
      await query(client, `
        insert into role_definitions (id, name, department, description, active, created_at, updated_at)
        values ($1,$2,$3,$4,$5,$6,now())
        on conflict (id) do update set
          name = excluded.name,
          department = excluded.department,
          description = excluded.description,
          active = excluded.active,
          updated_at = now()
      `, [role.id, role.name, role.department, role.description || null, role.active, role.createdAt || new Date().toISOString()]);
    }

    for (const account of dataset.clients) {
      await query(client, `
        insert into clients (id, name, industry, account_owner_id, status, created_at, updated_at)
        values ($1,$2,$3,$4,$5,$6,$7)
        on conflict (id) do update set
          name = excluded.name,
          industry = excluded.industry,
          account_owner_id = excluded.account_owner_id,
          status = excluded.status,
          updated_at = excluded.updated_at
      `, [account.id, account.name, account.industry, account.accountOwnerId || null, account.status, account.createdAt, account.updatedAt]);

      await query(client, 'delete from client_country_director_map where client_id = $1', [account.id]);
      for (const directorId of account.countryDirectorIds || []) {
        await query(client, `
          insert into client_country_director_map (client_id, country_director_id)
          values ($1,$2)
          on conflict do nothing
        `, [account.id, directorId]);
      }
    }

    for (const employee of dataset.employees) {
      await query(client, `
        insert into employees (
          id, employee_id, name, email, designation, department, country,
          primary_country_director_id, status, expected_weekly_hours, updated_at
        )
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now())
        on conflict (id) do update set
          employee_id = excluded.employee_id,
          name = excluded.name,
          email = excluded.email,
          designation = excluded.designation,
          department = excluded.department,
          country = excluded.country,
          primary_country_director_id = excluded.primary_country_director_id,
          status = excluded.status,
          expected_weekly_hours = excluded.expected_weekly_hours,
          updated_at = now()
      `, [
        employee.id,
        employee.employeeId,
        employee.name,
        employee.email,
        employee.designation,
        employee.department,
        employee.country,
        employee.primaryCountryDirectorId,
        employee.status,
        40,
      ]);

      await query(client, 'delete from employee_country_director_map where employee_id = $1', [employee.id]);
      for (const directorId of employee.mappedCountryDirectorIds || []) {
        await query(client, `
          insert into employee_country_director_map (employee_id, country_director_id)
          values ($1,$2)
          on conflict do nothing
        `, [employee.id, directorId]);
      }
    }

    for (const project of dataset.projects) {
      await query(client, `
        insert into projects (
          id, project_code, name, client_id, client, manager_id, manager_name,
          billable, start_date, end_date, status, updated_at
        )
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now())
        on conflict (id) do update set
          project_code = excluded.project_code,
          name = excluded.name,
          client_id = excluded.client_id,
          client = excluded.client,
          manager_id = excluded.manager_id,
          manager_name = excluded.manager_name,
          billable = excluded.billable,
          start_date = excluded.start_date,
          end_date = excluded.end_date,
          status = excluded.status,
          updated_at = now()
      `, [
        project.id,
        project.projectCode,
        project.name,
        project.clientId || null,
        project.client,
        project.managerId,
        project.managerName,
        project.billable,
        project.startDate,
        project.endDate,
        project.status,
      ]);
    }

    for (const allocation of dataset.allocations) {
      await query(client, `
        insert into project_allocations (
          id, employee_id, project_id, role_on_project, percentage,
          start_date, end_date, billable, status, updated_at
        )
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,now())
        on conflict (id) do update set
          employee_id = excluded.employee_id,
          project_id = excluded.project_id,
          role_on_project = excluded.role_on_project,
          percentage = excluded.percentage,
          start_date = excluded.start_date,
          end_date = excluded.end_date,
          billable = excluded.billable,
          status = excluded.status,
          updated_at = now()
      `, [
        allocation.id,
        allocation.employeeId,
        allocation.projectId,
        allocation.roleOnProject || null,
        allocation.percentage,
        allocation.startDate,
        allocation.endDate,
        allocation.billable,
        allocation.status,
      ]);
    }

    const roleIds = new Map((await query(client, 'select id, name from roles')).rows.map(role => [role.name, role.id]));
    for (const employee of dataset.employees) {
      const username = employee.employeeId.toLowerCase();
      const result = await query(client, `
        insert into users (username, employee_id, email, password_hash, status, updated_at)
        values ($1,$2,$3,$4,$5,now())
        on conflict (username) do update set
          employee_id = excluded.employee_id,
          email = excluded.email,
          password_hash = excluded.password_hash,
          status = excluded.status,
          updated_at = now()
        returning id
      `, [
        username,
        employee.employeeId,
        employee.email,
        passwordHash,
        employee.status === 'Exited' ? 'Disabled' : 'Active',
      ]);
      const userId = result.rows[0].id;
      await query(client, 'delete from user_roles where user_id = $1', [userId]);
      for (const roleName of rolesForEmployee(employee)) {
        await query(client, `
          insert into user_roles (user_id, role_id)
          values ($1,$2)
          on conflict do nothing
        `, [userId, roleIds.get(roleName)]);
      }
    }

    for (const timesheet of dataset.timesheets) {
      const result = await query(client, `
        insert into timesheets (
          employee_id, week_ending, status, total_hours, billable_hours,
          rejection_reason, submitted_at, approved_at, approved_by, rejected_at, rejected_by, updated_at
        )
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now())
        on conflict (employee_id, week_ending) do update set
          status = excluded.status,
          total_hours = excluded.total_hours,
          billable_hours = excluded.billable_hours,
          rejection_reason = excluded.rejection_reason,
          submitted_at = excluded.submitted_at,
          approved_at = excluded.approved_at,
          approved_by = excluded.approved_by,
          rejected_at = excluded.rejected_at,
          rejected_by = excluded.rejected_by,
          updated_at = now()
        returning id
      `, [
        timesheet.employeeId,
        timesheet.weekEnding,
        timesheet.status,
        timesheet.totalHours,
        timesheet.billableHours,
        timesheet.rejectionReason || timesheet.rejectionNote || null,
        timesheet.submittedAt || null,
        timesheet.approvedAt || null,
        timesheet.approvedBy || null,
        timesheet.rejectedAt || null,
        timesheet.rejectedBy || null,
      ]);
      const timesheetId = result.rows[0].id;
      await query(client, 'delete from timesheet_entries where timesheet_id = $1', [timesheetId]);
      for (const entry of timesheet.entries) {
        await query(client, `
          insert into timesheet_entries (
            timesheet_id, project_id, work_type, client_name, category,
            work_date, hours, remark, billable
          )
          values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        `, [
          timesheetId,
          entry.projectId || null,
          entry.workType,
          entry.clientName || null,
          entry.category || null,
          entry.date,
          entry.hours,
          entry.remark || null,
          entry.billable,
        ]);
      }
    }

    await query(client, `
      insert into audit_logs (user_id, user_name, user_role, module, action, entity_type, entity_id, details)
      values ($1,$2,$3,$4,$5,$6,$7,$8)
    `, ['system', 'Seeder', 'Admin', 'Seed', reset ? 'Reset Demo Seed' : 'Demo Seed', 'DemoDataset', 'demo', 'Seeded backend demo data for multi-user testing']);

    await client.query('commit');
    return {
      employees: dataset.employees.length,
      clients: dataset.clients.length,
      projects: dataset.projects.length,
      allocations: dataset.allocations.length,
      timesheets: dataset.timesheets.length,
      reset,
      demoPassword: password,
    };
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
};

try {
  const summary = await seed();
  console.log(JSON.stringify({ status: 'seeded', ...summary }, null, 2));
} catch (error) {
  console.error('Demo seed failed:', error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
