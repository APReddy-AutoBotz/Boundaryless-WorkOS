import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const templateDir = join('templates', 'import');

const requiredHeaders = {
  'employees-template.csv': ['employeeId', 'name', 'email', 'designation', 'department', 'country', 'reportingManagerId', 'primaryCountryDirectorId', 'mappedCountryDirectorIds', 'utilizationEligible', 'joiningDate', 'exitDate', 'standardWeeklyHours', 'capacityType', 'contractType', 'entraObjectId', 'teamsUserId', 'roles', 'initialPassword', 'status'],
  'clients-template.csv': ['id', 'name', 'industry', 'accountOwnerId', 'countryDirectorIds', 'status'],
  'projects-template.csv': ['projectCode', 'name', 'clientId', 'client', 'managerId', 'startDate', 'endDate', 'status', 'billable', 'projectType', 'country', 'notes'],
  'allocations-template.csv': ['id', 'employeeId', 'projectId', 'roleOnProject', 'percentage', 'startDate', 'endDate', 'billable', 'status', 'comments'],
  'timesheets-template.csv': ['employeeId', 'weekEnding', 'workType', 'projectId', 'clientName', 'category', 'date', 'hours', 'remark', 'billable', 'status', 'rejectionReason'],
};

for (const [fileName, expectedHeaders] of Object.entries(requiredHeaders)) {
  const csv = readFileSync(join(templateDir, fileName), 'utf8').trim();
  assert.ok(csv, `${fileName} should not be empty`);
  const [headerLine, ...rows] = csv.split(/\r?\n/);
  const headers = headerLine.split(',');
  assert.deepEqual(headers, expectedHeaders, `${fileName} headers must match import contract`);
  assert.ok(rows.length >= 1, `${fileName} should include at least one example row`);
}

console.log(JSON.stringify({
  status: 'passed',
  templates: Object.keys(requiredHeaders),
}, null, 2));
