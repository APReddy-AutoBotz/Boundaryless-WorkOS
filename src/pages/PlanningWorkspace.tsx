import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock, Gauge, Layers3, ShieldCheck, UsersRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { planningService } from '../services/api';
import type { ResourcePlanningReport, ResourcePlanningRow, WorkforceCommandCenterReport } from '../types';
import { cn } from '../lib/utils';

const bandForRow = (row: ResourcePlanningRow) => {
  if (row.overloaded) return { label: 'Overload', variant: 'danger' as const };
  if (row.bench) return { label: 'Bench', variant: 'warning' as const };
  if (row.underloaded) return { label: 'Underload', variant: 'info' as const };
  return { label: 'Balanced', variant: 'success' as const };
};

const Metric = ({ label, value, sub, icon: Icon }: { label: string; value: string | number; sub: string; icon: typeof Gauge }) => (
  <Card className="p-0">
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
        <p className="mt-2 text-2xl font-black text-heading">{value}</p>
        <p className="mt-1 text-xs font-bold text-body/60">{sub}</p>
      </div>
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-primary">
        <Icon size={21} />
      </div>
    </div>
  </Card>
);

export const ResourcePlanningBoard = () => {
  const [report, setReport] = useState<ResourcePlanningReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [band, setBand] = useState('All');
  const [search, setSearch] = useState('');

  const refresh = async () => {
    setLoading(true);
    setReport(await planningService.getResourcePlanning());
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  const filteredRows = useMemo(() => {
    const rows = report?.rows || [];
    return rows.filter(row => {
      const matchesSearch = row.employeeName.toLowerCase().includes(search.toLowerCase()) || row.employeeCode.toLowerCase().includes(search.toLowerCase());
      const matchesBand =
        band === 'All' ||
        (band === 'Overload' && row.overloaded) ||
        (band === 'Bench' && row.bench) ||
        (band === 'Underload' && row.underloaded) ||
        (band === 'Roll-off' && row.rollOffDate);
      return matchesSearch && matchesBand;
    });
  }, [report, search, band]);

  const maxLoad = Math.max(...(report?.rows || []).map(row => row.plannedUtilization), 100);
  const rollOffRows = (report?.rows || []).filter(row => row.rollOffDate).slice(0, 8);
  const clientFootprint = useMemo(() => {
    const clients = new Map<string, { people: Set<string>; fte: number; projects: Set<string> }>();
    (report?.rows || []).forEach(row => {
      row.allocations.forEach(allocation => {
        const current = clients.get(allocation.client) || { people: new Set<string>(), fte: 0, projects: new Set<string>() };
        current.people.add(row.employeeId);
        current.projects.add(allocation.projectId);
        current.fte += allocation.percentage / 100;
        clients.set(allocation.client, current);
      });
    });
    return Array.from(clients.entries()).map(([client, value]) => ({
      client,
      people: value.people.size,
      projects: value.projects.size,
      fte: Number(value.fte.toFixed(1)),
    })).sort((a, b) => b.fte - a.fte).slice(0, 8);
  }, [report]);

  if (loading || !report) return <Card>Loading resource planning...</Card>;

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Resource Planning Board"
        subtitle="Availability-aware capacity, bench, overload, roll-off, and client delivery footprint."
        breadcrumb={['Workforce OS', 'Planning']}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-6">
        <Metric label="People" value={report.summary.people} sub="Planning population" icon={UsersRound} />
        <Metric label="Avg Planned" value={`${report.summary.averagePlanned}%`} sub="Allocation load" icon={Gauge} />
        <Metric label="Avail Cap" value={`${report.summary.averageAvailabilityAdjustedCapacity}%`} sub="Leave adjusted" icon={ShieldCheck} />
        <Metric label="Bench" value={report.summary.benchCount} sub="Low load" icon={Layers3} />
        <Metric label="Overload" value={report.summary.overloadedCount} sub="Above threshold" icon={AlertTriangle} />
        <Metric label="Roll-off" value={report.summary.rollOffSoonCount} sub="Next 45 days" icon={CalendarClock} />
      </div>

      <Card title="Availability Timeline">
        <div className="space-y-3">
          {filteredRows.slice(0, 14).map(row => {
            const bandInfo = bandForRow(row);
            return (
              <div key={row.employeeId} className="rounded-lg border border-slate-100 bg-white p-4">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_1fr_180px] lg:items-center">
                  <div className="min-w-0">
                    <Link to={`/employees/${row.employeeId}`} className="font-black text-heading hover:text-primary">{row.employeeName}</Link>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">{row.employeeCode} | {row.department}</p>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                      <span>{row.plannedUtilization}% planned</span>
                      <span>{Math.round(row.availabilityHours)}h available</span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-slate-100">
                      <div
                        className={cn('h-full rounded-full', row.overloaded ? 'bg-danger' : row.bench || row.underloaded ? 'bg-warning' : 'bg-primary')}
                        style={{ width: `${Math.min(100, Math.round((row.plannedUtilization / maxLoad) * 100))}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-start gap-2 lg:justify-end">
                    <Badge variant={bandInfo.variant}>{bandInfo.label}</Badge>
                    {row.rollOffDate && <Badge variant="neutral">Roll-off {row.rollOffDate}</Badge>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card
          title="Overload / Underload View"
          headerAction={
            <div className="flex flex-wrap items-center gap-2">
              <input className="input-field h-9 w-52 text-xs" placeholder="Search resource" value={search} onChange={event => setSearch(event.target.value)} />
              <select className="input-field h-9 w-32 text-xs" value={band} onChange={event => setBand(event.target.value)}>
                {['All', 'Overload', 'Underload', 'Bench', 'Roll-off'].map(option => <option key={option}>{option}</option>)}
              </select>
            </div>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <th className="py-3 pr-4">Resource</th>
                  <th className="py-3 pr-4">Load</th>
                  <th className="py-3 pr-4">Availability</th>
                  <th className="py-3 pr-4">Projects</th>
                  <th className="py-3 pr-4">Band</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map(row => {
                  const bandInfo = bandForRow(row);
                  return (
                    <tr key={row.employeeId} className="border-b border-slate-50">
                      <td className="py-3 pr-4">
                        <Link to={`/employees/${row.employeeId}`} className="font-black text-heading hover:text-primary">{row.employeeName}</Link>
                        <p className="mt-1 text-[10px] font-bold text-slate-400">{row.country}</p>
                      </td>
                      <td className="py-3 pr-4 font-bold">{row.plannedUtilization}%</td>
                      <td className="py-3 pr-4">{Math.round(row.availabilityHours)}h</td>
                      <td className="py-3 pr-4">{row.activeProjectCount}</td>
                      <td className="py-3 pr-4"><Badge variant={bandInfo.variant}>{bandInfo.label}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="space-y-6">
          <Card title="Bench and Roll-Off View">
            <div className="space-y-3">
              {rollOffRows.map(row => (
                <div key={row.employeeId} className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-black text-heading">{row.employeeName}</p>
                    <Badge variant={row.bench ? 'warning' : 'info'}>{row.rollOffDate || 'Bench'}</Badge>
                  </div>
                  <p className="mt-1 text-xs font-bold text-body/60">{row.plannedUtilization}% planned | {row.department}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Client Delivery Footprint">
            <div className="space-y-3">
              {clientFootprint.map(client => (
                <div key={client.client} className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-black text-heading">{client.client}</p>
                    <Badge variant="neutral">{client.fte} FTE</Badge>
                  </div>
                  <p className="mt-1 text-xs font-bold text-body/60">{client.people} people | {client.projects} projects</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export const WorkforceCommandCenter = () => {
  const [report, setReport] = useState<WorkforceCommandCenterReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    planningService.getWorkforceCommandCenter().then(value => {
      setReport(value);
      setLoading(false);
    });
  }, []);

  if (loading || !report) return <Card>Loading command center...</Card>;

  const metrics = [
    { label: 'Data Confidence', value: `${report.dataConfidenceScore}%`, sub: 'Quality score', icon: ShieldCheck },
    { label: 'Availability', value: Math.round(report.leaveAdjustedAvailabilityHours), sub: 'Leave-adjusted hours', icon: CalendarClock },
    { label: 'Approvals', value: report.pendingApprovalLoad, sub: `${report.overdueApprovalLoad} overdue`, icon: Gauge },
    { label: 'Delivery Risk', value: report.notificationDeliveryRisk, sub: 'Failed notifications', icon: AlertTriangle },
    { label: 'Identity Gaps', value: report.missingIdentityLinks, sub: 'Missing Entra links', icon: ShieldCheck },
    { label: 'Teams Gaps', value: report.missingTeamsLinks, sub: 'Missing Teams links', icon: UsersRound },
    { label: 'Staffing Risk', value: report.projectStaffingRisks, sub: 'Projects without active staff', icon: Layers3 },
    { label: 'Overload', value: report.overloadedCount, sub: `${report.benchCount} bench`, icon: AlertTriangle },
  ];

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Workforce Command Center"
        subtitle="Capacity, approvals, notifications, identity readiness, data confidence, and staffing risks."
        breadcrumb={['Workforce OS', 'Command Center']}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map(metric => (
          <div key={metric.label}>
            <Metric
              label={metric.label}
              value={metric.value}
              sub={metric.sub}
              icon={metric.icon}
            />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card title="Risk Stack">
          <div className="space-y-3">
            {[
              { label: 'Overloaded', value: report.overloadedCount, color: 'bg-danger' },
              { label: 'Underloaded', value: report.underloadedCount, color: 'bg-warning' },
              { label: 'Bench', value: report.benchCount, color: 'bg-slate-400' },
              { label: 'Approval Load', value: report.pendingApprovalLoad, color: 'bg-primary' },
              { label: 'Identity Gaps', value: report.missingIdentityLinks + report.missingTeamsLinks, color: 'bg-blue-500' },
            ].map(item => {
              const max = Math.max(report.overloadedCount, report.underloadedCount, report.benchCount, report.pendingApprovalLoad, report.missingIdentityLinks + report.missingTeamsLinks, 1);
              return (
                <div key={item.label}>
                  <div className="flex items-center justify-between text-xs font-black text-heading">
                    <span>{item.label}</span>
                    <span>{item.value}</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-slate-100">
                    <div className={cn('h-full rounded-full', item.color)} style={{ width: `${Math.max(4, (item.value / max) * 100)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card title="Top Risks">
          <div className="space-y-3">
            {report.topRisks.map((risk, index) => (
              <div key={`${risk.riskType}-${index}`} className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-black text-heading">{risk.riskType}</p>
                  <Badge variant={risk.severity === 'Critical' ? 'danger' : risk.severity === 'Warning' ? 'warning' : 'info'}>{risk.severity}</Badge>
                </div>
                <p className="mt-2 text-sm font-medium text-body/70">{risk.description}</p>
                <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">{risk.owner}</p>
              </div>
            ))}
            {report.topRisks.length === 0 && <p className="py-8 text-center text-sm font-bold text-slate-400">No command-center risks in this scope.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
};
