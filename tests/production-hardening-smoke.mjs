import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const server = readFileSync('server/index.mjs', 'utf8');
const schema = readFileSync('server/schema.sql', 'utf8');
const migrate = readFileSync('server/migrate.mjs', 'utf8');
const apiClient = readFileSync('src/services/apiClient.ts', 'utf8');
const login = readFileSync('src/pages/Login.tsx', 'utf8');
const app = readFileSync('src/App.tsx', 'utf8');
const header = readFileSync('src/components/Layout/Header.tsx', 'utf8');
const sidebar = readFileSync('src/components/Layout/Sidebar.tsx', 'utf8');
const brdTraceability = readFileSync('src/pages/BRDTraceability.tsx', 'utf8');
const featureFlags = readFileSync('src/config/featureFlags.ts', 'utf8');
const leaveManagement = readFileSync('src/pages/LeaveManagement.tsx', 'utf8');
const approvalsWorkspace = readFileSync('src/pages/ApprovalsWorkspace.tsx', 'utf8');
const notificationCenter = readFileSync('src/pages/NotificationCenter.tsx', 'utf8');
const integrationsWorkspace = readFileSync('src/pages/IntegrationsWorkspace.tsx', 'utf8');
const leaveMigration = readFileSync('server/migrations/007_workforce_os_leave.sql', 'utf8');
const approvalMigration = readFileSync('server/migrations/008_workforce_os_approvals.sql', 'utf8');
const notificationMigration = readFileSync('server/migrations/009_workforce_os_notifications.sql', 'utf8');
const integrationMigration = readFileSync('server/migrations/010_workforce_os_integrations.sql', 'utf8');
const requirements = readFileSync('Boundaryless-WorkOS_Requirements.md', 'utf8');
const technicalStatus = readFileSync('Boundaryless-WorkOS_Technical_Status.md', 'utf8');
const handoverChecklist = readFileSync('BOUNDARYLESS_WORKOS_PRODUCTION_HANDOVER_CHECKLIST.md', 'utf8');
const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));

assert.match(server, /const requireRoles = \(\.\.\.roles\) => \(req, res, next\) => \{[\s\S]*!roles\.includes\(activeRole\)/, 'backend role guard must enforce activeRole only');
assert.doesNotMatch(server, /roles\.some\(role => userRoles\.has\(role\)\)/, 'backend role guard must not allow inactive assigned roles to bypass activeRole');

assert.match(apiClient, /isDemoFallbackAllowed/, 'frontend must expose demo fallback guard');
assert.match(apiClient, /Backend API is required because demo fallback is disabled/, 'disabled demo fallback must fail closed when backend is unavailable');
assert.match(login, /showDemoShortcuts/, 'login page must hide UAT shortcuts when demo fallback is disabled');

for (const column of [
  'reporting_manager_id',
  'joining_date',
  'exit_date',
  'standard_weekly_hours',
  'capacity_type',
  'contract_type',
  'leave_policy_id',
  'entra_object_id',
  'teams_user_id',
  'active_role',
  'source',
  'ip_address',
  'session_id',
]) {
  assert.match(schema, new RegExp(column), `schema must include ${column}`);
}

assert.match(server, /app\.get\('\/api\/reports\/data-quality'/, 'data quality report endpoint must exist');
assert.match(server, /app\.get\('\/api\/reports\/dashboard'/, 'dashboard report endpoint must exist');
assert.match(server, /app\.get\('\/api\/leave\/requests'/, 'leave request API must exist');
assert.match(server, /app\.patch\('\/api\/leave\/requests\/:id\/status'/, 'leave approval API must exist');
assert.match(server, /app\.get\('\/api\/reports\/availability'/, 'availability report API must exist');
assert.match(server, /app\.get\('\/api\/approvals'/, 'generic approval API must exist');
assert.match(server, /app\.patch\('\/api\/approvals\/:id\/status'/, 'generic approval decision API must exist');
assert.match(server, /app\.get\('\/api\/reports\/approval-sla'/, 'approval SLA API must exist');
assert.match(server, /app\.get\('\/api\/notifications'/, 'notification inbox API must exist');
assert.match(server, /app\.patch\('\/api\/notifications\/:id\/read'/, 'notification read API must exist');
assert.match(server, /app\.get\('\/api\/notification-templates'/, 'notification template API must exist');
assert.match(server, /app\.get\('\/api\/notification-preferences'/, 'notification preference API must exist');
assert.match(server, /app\.get\('\/api\/integrations\/identity-links'/, 'identity provider link API must exist');
assert.match(server, /app\.get\('\/api\/integrations\/entra-role-mappings'/, 'Entra group-role mapping API must exist');
assert.match(server, /app\.get\('\/api\/integrations\/teams-user-links'/, 'Teams user mapping API must exist');
assert.match(server, /app\.post\('\/api\/integrations\/teams-action-tokens'/, 'Teams deterministic action token API must exist');
assert.match(server, /app\.get\('\/api\/integrations\/health'/, 'integration health API must exist');
assert.match(server, /app\.post\('\/api\/auth\/switch-role'/, 'backend active-role switch endpoint must exist');
assert.match(server, /app\.post\('\/api\/audit-events'/, 'backend audit event endpoint must exist for UI-triggered exports');
assert.match(server, /action: z\.enum\(\['Export', 'Import', 'Notify'\]\)/, 'client audit events must be constrained to approved UI event actions');
assert.doesNotMatch(server, /source: z\.string\(\)\.max\(40\)\.optional\(\)/, 'client audit events must not accept arbitrary source values');
assert.match(server, /Missing reporting manager/, 'data quality report must detect missing reporting manager');
assert.match(server, /Demo data remnant/, 'data quality report must detect demo data remnants');
assert.match(app, /\/reports\/data-quality/, 'data quality report must have a routed UI page');
assert.match(header, /authService\.switchRole/, 'header must expose active-role switching for multi-role users');
assert.match(app, /\/governance\/brd-traceability/, 'BRD traceability must have a routed UI page');
assert.match(sidebar, /BRD Traceability/, 'BRD traceability must be visible in navigation for reviewer roles');
assert.match(header, /page-brd-traceability/, 'BRD traceability must be searchable from the header');
assert.match(brdTraceability, /Traceability Matrix/, 'BRD traceability UI must include a traceability matrix');
assert.match(brdTraceability, /Leave Management[\s\S]*Workforce OS Phase[\s\S]*Microsoft Teams Integration[\s\S]*Workforce OS Phase[\s\S]*Microsoft Entra SSO[\s\S]*Workforce OS Phase/, 'BRD traceability UI must cross-check feature-flagged strategic modules');
assert.match(featureFlags, /FEATURE_LEAVE[\s\S]*FEATURE_NOTIFICATIONS[\s\S]*FEATURE_TEAMS[\s\S]*FEATURE_ENTRA[\s\S]*FEATURE_PLANNING/, 'enterprise feature flags must cover all Workforce OS modules');
assert.match(app, /\/ess[\s\S]*\/leave\/my[\s\S]*\/approvals[\s\S]*\/notifications[\s\S]*\/integrations\/identity[\s\S]*\/planning\/resources[\s\S]*\/reports\/command-center/, 'Workforce OS route foundations must exist');
assert.match(app, /<ESSHome \/>[\s\S]*<MyLeave \/>[\s\S]*<TeamLeaveCalendar \/>[\s\S]*<LeaveAdmin \/>/, 'Phase 2 leave routes must render real leave screens');
assert.match(app, /<ApprovalsWorkspace \/>/, 'Phase 3 approvals route must render real approval workspace');
assert.match(app, /<NotificationCenter \/>/, 'Phase 4 notifications route must render real notification center');
assert.match(app, /<IdentityIntegration \/>[\s\S]*<TeamsIntegration \/>/, 'Phase 5 integration routes must render real integration workspaces');
assert.match(sidebar, /feature: 'leave'[\s\S]*feature: 'notifications'[\s\S]*feature: 'planning'[\s\S]*feature: 'entra'[\s\S]*feature: 'teams'/, 'Workforce OS navigation must be feature-gated');
assert.match(header, /feature: 'leave'[\s\S]*feature: 'notifications'[\s\S]*feature: 'planning'[\s\S]*feature: 'entra'[\s\S]*feature: 'teams'/, 'Workforce OS search entries must be feature-gated');
assert.match(leaveManagement, /Leave Balance[\s\S]*Submit Request[\s\S]*Team Leave Calendar[\s\S]*Leave Administration/, 'Phase 2 leave UI must include self-service, balances, team calendar, and admin views');
assert.match(approvalsWorkspace, /Approval Inbox[\s\S]*Approval History[\s\S]*Approval Delegations/, 'Phase 3 approval UI must include inbox, history, and delegations');
assert.match(notificationCenter, /Notification Inbox[\s\S]*Notification Preferences[\s\S]*Admin Notification Templates[\s\S]*Delivery Monitoring/, 'Phase 4 notification UI must include inbox, preferences, templates, and delivery monitoring');
for (const label of ['Identity Provider Links', 'Entra Role Mapping', 'Teams User Mapping', 'Teams Action Tokens', 'Integration Event Logs']) {
  assert.match(integrationsWorkspace, new RegExp(label), `Phase 5 integration UI must include ${label}`);
}

assert.match(migrate, /serverDir, 'migrations'/, 'migration runner must apply versioned migration files');
assert.ok(existsSync('server/migrations/006_boundaryless_workos_prod_core.sql'), 'Boundaryless-WorkOS production-core migration must exist');
assert.ok(existsSync('server/migrations/007_workforce_os_leave.sql'), 'Workforce OS leave migration must exist');
assert.ok(existsSync('server/migrations/008_workforce_os_approvals.sql'), 'Workforce OS approval migration must exist');
assert.ok(existsSync('server/migrations/009_workforce_os_notifications.sql'), 'Workforce OS notification migration must exist');
assert.ok(existsSync('server/migrations/010_workforce_os_integrations.sql'), 'Workforce OS integration migration must exist');
for (const table of ['leave_types', 'leave_policies', 'holiday_calendars', 'leave_balances', 'leave_requests']) {
  assert.match(leaveMigration, new RegExp(`create table if not exists ${table}`), `leave migration must create ${table}`);
}
for (const table of ['approval_records', 'approval_delegations']) {
  assert.match(approvalMigration, new RegExp(`create table if not exists ${table}`), `approval migration must create ${table}`);
}
for (const table of ['notification_events', 'notification_templates', 'notification_preferences', 'notification_delivery_attempts']) {
  assert.match(notificationMigration, new RegExp(`create table if not exists ${table}`), `notification migration must create ${table}`);
}
for (const table of ['identity_provider_links', 'entra_group_role_mappings', 'teams_user_links', 'teams_action_tokens', 'integration_event_logs']) {
  assert.match(integrationMigration, new RegExp(`create table if not exists ${table}`), `integration migration must create ${table}`);
}
assert.match(integrationMigration, /action text not null check \(action in \('approve', 'reject', 'open_portal'\)\)/, 'Teams actions must be deterministic approve/reject/open_portal only');

assert.match(requirements, /Single source of truth for product scope, production-core requirements, implementation status, and next technical plan\./, 'requirements document must be the BRD source of truth');
assert.match(requirements, /## 8\. Completed vs Pending Status/, 'requirements must mark completed and pending status');
assert.match(requirements, /## 9\. Updated Technical Plan/, 'requirements must include the updated technical plan');
assert.match(requirements, /Workforce OS Implementation Vision/, 'requirements must reposition future roadmap as Workforce OS implementation');
assert.match(requirements, /VITE_FEATURE_LEAVE[\s\S]*VITE_FEATURE_NOTIFICATIONS[\s\S]*VITE_FEATURE_TEAMS[\s\S]*VITE_FEATURE_ENTRA[\s\S]*VITE_FEATURE_PLANNING/, 'requirements must document browser feature flags');
assert.match(requirements, /Phase 2: ESS and Leave Management[\s\S]*Phase 3: generic approval engine[\s\S]*Phase 4: notification center[\s\S]*Phase 5: Entra-ready identity mapping[\s\S]*Phase 6: resource planning board/, 'requirements must preserve phased Workforce OS implementation order');
assert.match(requirements, /APP_MODE=production\|demo[\s\S]*DISABLE_DEMO_FALLBACK=true\|false[\s\S]*AUTO_SEED_DEMO=false/, 'requirements must document production environment safety flags');
assert.match(requirements, /Multi-role users cannot use inactive roles to bypass permissions/, 'requirements must retain active-role UAT acceptance');
assert.match(technicalStatus, /avoid a second, conflicting source of truth/, 'technical status must not duplicate the BRD source of truth');
assert.match(handoverChecklist, /APP_MODE=production[\s\S]*DISABLE_DEMO_FALLBACK=true[\s\S]*AUTO_SEED_DEMO=false/, 'handover checklist must require production-safe environment flags');

assert.equal(packageJson.dependencies['@google/genai'], undefined, 'unused Gemini dependency must be removed');

console.log(JSON.stringify({
  status: 'passed',
  activeRoleOnly: true,
  demoFallbackGuard: true,
  boundarylessWorkOSSchema: true,
  dataQualityReport: true,
  versionedMigrations: true,
  sourceOfTruthBrd: true,
  brdTraceabilityUi: true,
  leaveManagement: true,
  approvalEngine: true,
  notificationCenter: true,
  integrationAdapters: true,
}, null, 2));
