import { ClipboardCheck, Layers3, MonitorCheck, ShieldCheck } from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { PageHeader } from '../components/ui/PageHeader';

type DeliveryStatus = 'Complete foundation' | 'Partial' | 'Pending company input' | 'Future phase';
type UiStatus = 'Available' | 'Partial' | 'Not in Production Core' | 'Not required';

interface TraceabilityRow {
  module: string;
  brdIntent: string;
  phase: 'Production Core' | 'Workforce OS Phase' | 'Company Handover';
  deliveryStatus: DeliveryStatus;
  uiStatus: UiStatus;
  apiDataStatus: string;
  nextAction: string;
}

const rows: TraceabilityRow[] = [
  {
    module: 'Employee Master as root',
    brdIntent: 'Employee records drive identity, reporting lines, capacity, utilization, allocations, approvals, future leave, and Teams identity.',
    phase: 'Production Core',
    deliveryStatus: 'Complete foundation',
    uiStatus: 'Available',
    apiDataStatus: 'Employee UI, backend APIs, production fields, identity placeholders, and import template are in place.',
    nextAction: 'Load real company employee data and validate manager, CD, capacity, and identity mappings.',
  },
  {
    module: 'ESS / Employee Workspace',
    brdIntent: 'Employees can see their own work context, projects, utilization, and timesheet status.',
    phase: 'Production Core',
    deliveryStatus: 'Partial',
    uiStatus: 'Partial',
    apiDataStatus: 'My Workspace and timesheet self-log exist. Leave, notifications, and profile self-service are future modules.',
    nextAction: 'Complete role UAT for employee journeys and defer leave/notifications until after Production Core.',
  },
  {
    module: 'Client and Project Master',
    brdIntent: 'Maintain trusted client/project data with ownership, project timelines, resources, and status.',
    phase: 'Production Core',
    deliveryStatus: 'Complete foundation',
    uiStatus: 'Available',
    apiDataStatus: 'Client, project, detail, allocation links, scoped APIs, and CSV imports exist.',
    nextAction: 'Validate real client/project files and reconcile report totals during UAT.',
  },
  {
    module: 'Allocation Management',
    brdIntent: 'Track project allocation percentages, date ranges, staffing pressure, and planned utilization.',
    phase: 'Production Core',
    deliveryStatus: 'Partial',
    uiStatus: 'Available',
    apiDataStatus: 'Allocation UI and backend endpoints exist with validation and duplicate import guardrails.',
    nextAction: 'Run role-scope UAT and add deeper DB-backed allocation parity fixtures.',
  },
  {
    module: 'Timesheet Management',
    brdIntent: 'Employees submit weekly client/project time; approvers approve/reject; approved time drives actual utilization.',
    phase: 'Production Core',
    deliveryStatus: 'Partial',
    uiStatus: 'Available',
    apiDataStatus: 'Self-log, governance UI, backend endpoints, approval/rejection, and import apply path exist.',
    nextAction: 'Confirm Project Manager and Team Lead approval rules, then complete browser UAT.',
  },
  {
    module: 'Workforce Command Center',
    brdIntent: 'Expose executive workforce KPIs, attention items, utilization health, and data confidence.',
    phase: 'Production Core',
    deliveryStatus: 'Partial',
    uiStatus: 'Available',
    apiDataStatus: 'Dashboard, dashboard report endpoint, data-quality endpoint, and data-quality UI exist.',
    nextAction: 'Validate dashboard and data-quality outputs against real or UAT data.',
  },
  {
    module: 'Reports',
    brdIntent: 'Provide scoped utilization, timesheet, allocation, data-quality, and audit reporting.',
    phase: 'Production Core',
    deliveryStatus: 'Partial',
    uiStatus: 'Available',
    apiDataStatus: 'Planned, actual, forecast, dashboard, data-quality, import/export history, and audit surfaces exist.',
    nextAction: 'Add DB-backed calculation fixtures and browser workflow coverage.',
  },
  {
    module: 'Import / Export',
    brdIntent: 'Support controlled CSV data onboarding, validation, error reports, export history, and auditability.',
    phase: 'Production Core',
    deliveryStatus: 'Partial',
    uiStatus: 'Available',
    apiDataStatus: 'CSV templates, dry-run UI, backend apply endpoints, duplicate-row rejection, and history logging exist.',
    nextAction: 'Run real-file UAT and finalize duplicate-resolution policy with company owners.',
  },
  {
    module: 'Audit and Governance',
    brdIntent: 'Provide source-aware audit trail for critical operations and support security governance.',
    phase: 'Production Core',
    deliveryStatus: 'Partial',
    uiStatus: 'Available',
    apiDataStatus: 'Audit UI and backend audit writes exist for major operations; client audit event inputs are constrained.',
    nextAction: 'Finalize immutable audit coverage, retention policy, and audit export permissions.',
  },
  {
    module: 'Leave Management',
    brdIntent: 'Leave requests, balances, policies, calendars, approvals, and availability-adjusted utilization.',
    phase: 'Workforce OS Phase',
    deliveryStatus: 'Partial',
    uiStatus: 'Available',
    apiDataStatus: 'Leave types, policies, holiday calendars, balances, requests, approval status API, and availability report exist behind feature flags.',
    nextAction: 'Harden accrual automation, richer team hierarchy, calendar UX, and browser UAT evidence before company rollout.',
  },
  {
    module: 'Notification Center',
    brdIntent: 'Role, scope, event, email, and Teams notifications for approvals and operational follow-up.',
    phase: 'Workforce OS Phase',
    deliveryStatus: 'Future phase',
    uiStatus: 'Partial',
    apiDataStatus: 'Feature-gated routes exist; audit source model is prepared; no queue or delivery engine is included yet.',
    nextAction: 'Add notification events, templates, preferences, delivery attempts, mock email adapter, and in-app inbox.',
  },
  {
    module: 'Microsoft Teams Integration',
    brdIntent: 'Teams personal tab, deterministic bot commands, Adaptive Cards, and secure action tokens.',
    phase: 'Workforce OS Phase',
    deliveryStatus: 'Future phase',
    uiStatus: 'Partial',
    apiDataStatus: 'Feature-gated routes exist; Teams user/channel placeholders exist; no bot, cards, or Teams action tokens are implemented yet.',
    nextAction: 'Add Teams mapping, deterministic action tokens, mock adapter, and audit-backed action handling.',
  },
  {
    module: 'Microsoft Entra SSO',
    brdIntent: 'Enterprise SSO and group-to-role mapping.',
    phase: 'Workforce OS Phase',
    deliveryStatus: 'Future phase',
    uiStatus: 'Partial',
    apiDataStatus: 'Feature-gated routes exist; Entra object placeholder exists; username/password remains supported.',
    nextAction: 'Add identity provider links, Entra group-role mappings, mock adapter, and credential handover docs.',
  },
  {
    module: 'Company Production Handover',
    brdIntent: 'Company-owned infrastructure, secrets, real data, UAT evidence, operations, backup, monitoring, and rollback.',
    phase: 'Company Handover',
    deliveryStatus: 'Pending company input',
    uiStatus: 'Not required',
    apiDataStatus: 'Runbooks and checklists exist; execution depends on company credentials, data, and owners.',
    nextAction: 'Collect company DB, hosting, domain, secret, backup, monitoring, and initial admin inputs.',
  },
];

const statusVariant = (status: DeliveryStatus): 'success' | 'warning' | 'info' | 'neutral' => {
  if (status === 'Complete foundation') return 'success';
  if (status === 'Partial') return 'warning';
  if (status === 'Pending company input') return 'info';
  return 'neutral';
};

const coreRows = rows.filter(row => row.phase === 'Production Core');
const futureRows = rows.filter(row => row.phase === 'Workforce OS Phase');
const handoverRows = rows.filter(row => row.phase === 'Company Handover');

export const BRDTraceability = () => (
  <div className="space-y-6 pb-12">
    <PageHeader
      title="BRD Traceability"
      subtitle="Single view of what the BRD requires, what Production Core includes, what has UI today, and what remains future or company-owned."
      breadcrumb={['Governance', 'BRD Traceability']}
    />

    <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-body/50">Production Core</p>
            <p className="mt-3 text-4xl font-black text-heading">{coreRows.length}</p>
          </div>
          <div className="rounded-2xl bg-orange-50 p-3 text-primary">
            <ClipboardCheck size={22} />
          </div>
        </div>
        <p className="mt-3 text-xs font-semibold text-body/60">Modules included in first handover scope</p>
      </Card>
      <Card className="p-5">
        <p className="text-[10px] font-black uppercase tracking-widest text-body/50">UI Available</p>
        <p className="mt-3 text-4xl font-black text-heading">{rows.filter(row => row.uiStatus === 'Available').length}</p>
        <p className="mt-3 text-xs font-semibold text-body/60">Visible product surfaces today</p>
      </Card>
      <Card className="p-5">
        <p className="text-[10px] font-black uppercase tracking-widest text-body/50">Future Modules</p>
        <p className="mt-3 text-4xl font-black text-heading">{futureRows.length}</p>
        <p className="mt-3 text-xs font-semibold text-body/60">Feature-flagged enterprise phases</p>
      </Card>
      <Card className="p-5">
        <p className="text-[10px] font-black uppercase tracking-widest text-body/50">Company Blockers</p>
        <p className="mt-3 text-4xl font-black text-heading">{handoverRows.length}</p>
        <p className="mt-3 text-xs font-semibold text-body/60">Inputs required outside code</p>
      </Card>
    </div>

    <Card className="p-5">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-1 text-primary" size={20} />
        <div>
          <h2 className="text-sm font-black uppercase tracking-widest text-heading">Scope Control</h2>
          <p className="mt-2 max-w-4xl text-sm font-medium leading-relaxed text-body/70">
            Production Core remains focused on workforce master data, projects, clients, allocations, timesheets, utilization, reports,
            imports, exports, audit, and handover readiness. Leave, notifications, Teams, and Entra are preserved in the roadmap,
            and are now controlled by enterprise feature flags so each phase can be implemented without destabilizing the current handover path.
          </p>
        </div>
      </div>
    </Card>

    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-border-light p-5">
        <div className="flex items-center gap-2">
          <Layers3 size={17} className="text-primary" />
          <h2 className="text-sm font-black uppercase tracking-widest text-heading">Traceability Matrix</h2>
        </div>
        <Badge variant="neutral">{rows.length} BRD lines</Badge>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1180px] text-left">
          <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-body/50">
            <tr>
              <th className="px-5 py-3">BRD Module</th>
              <th className="px-5 py-3">Phase</th>
              <th className="px-5 py-3">Delivery</th>
              <th className="px-5 py-3">UI</th>
              <th className="px-5 py-3">API / Data Status</th>
              <th className="px-5 py-3">Next Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-light">
            {rows.map(row => (
              <tr key={row.module} className="align-top hover:bg-orange-50/40">
                <td className="max-w-xs px-5 py-4">
                  <p className="text-sm font-black text-heading">{row.module}</p>
                  <p className="mt-2 text-xs font-medium leading-relaxed text-body/60">{row.brdIntent}</p>
                </td>
                <td className="px-5 py-4">
                  <Badge variant={row.phase === 'Production Core' ? 'success' : row.phase === 'Company Handover' ? 'info' : 'warning'}>
                    {row.phase}
                  </Badge>
                </td>
                <td className="px-5 py-4">
                  <Badge variant={statusVariant(row.deliveryStatus)}>{row.deliveryStatus}</Badge>
                </td>
                <td className="px-5 py-4">
                  <Badge variant={row.uiStatus === 'Available' ? 'success' : row.uiStatus === 'Partial' ? 'warning' : 'neutral'}>
                    <MonitorCheck size={11} className="mr-1" />
                    {row.uiStatus}
                  </Badge>
                </td>
                <td className="max-w-sm px-5 py-4 text-xs font-medium leading-relaxed text-body/70">{row.apiDataStatus}</td>
                <td className="max-w-sm px-5 py-4 text-xs font-bold leading-relaxed text-heading">{row.nextAction}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  </div>
);
