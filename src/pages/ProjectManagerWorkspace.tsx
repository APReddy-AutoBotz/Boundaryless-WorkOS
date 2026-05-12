import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { AlertCircle, ArrowUpRight, Briefcase, CheckCircle2, Clock, Loader2, Users } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { allocationService, adminService, employeeService, projectService, timesheetService } from '../services/api';
import { authService } from '../services/authService';
import { Allocation, Employee, Project, SystemSettings, TimesheetSummary } from '../types';
import { cn } from '../lib/utils';
import { isProjectAvailableForPlanning, overlapsDateRange } from '../services/calculations';
import { formatFte, formatHours, formatMetric, formatPercent } from '../lib/format';

const todayIso = () => new Date().toISOString().split('T')[0];

export const ProjectManagerWorkspace = () => {
  const user = authService.getCurrentUser();
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [timesheets, setTimesheets] = useState<TimesheetSummary[]>([]);
  const [settings, setSettings] = useState<SystemSettings>({
    utilizationThresholdHigh: 100,
    utilizationThresholdLow: 80,
    timesheetPolicyMaxHours: 40,
    expectedWeeklyHours: 40,
    benchThreshold: 20,
    currency: 'GBP',
  });

  useEffect(() => {
    if (!user) return;
    Promise.all([
      projectService.getAll(),
      allocationService.getAll(),
      employeeService.getAll(),
      timesheetService.getAll(),
      adminService.getSettings(),
    ]).then(([projectData, allocationData, employeeData, timesheetData, systemSettings]) => {
      const managed = projectData.filter(project =>
        project.managerId === user.id ||
        project.managerId === user.employeeId ||
        project.managerName === user.name
      );
      const managedIds = new Set(managed.map(project => project.id));
      setProjects(managed);
      setAllocations(allocationData.filter(allocation => managedIds.has(allocation.projectId)));
      setEmployees(employeeData);
      setTimesheets(timesheetData.filter(timesheet =>
        timesheet.entries.some(entry => entry.projectId && managedIds.has(entry.projectId))
      ));
      setSettings(systemSettings);
    }).finally(() => setLoading(false));
  }, [user]);

  const currentDate = todayIso();
  const projectById = useMemo(() => new Map(projects.map(project => [project.id, project])), [projects]);
  const employeeById = useMemo(() => new Map(employees.map(employee => [employee.id, employee])), [employees]);

  const currentAllocations = allocations.filter(allocation => {
    const project = projectById.get(allocation.projectId);
    return allocation.status === 'Active' &&
      !!project &&
      isProjectAvailableForPlanning(project, currentDate, currentDate) &&
      overlapsDateRange(allocation.startDate, allocation.endDate, currentDate, currentDate);
  });
  const activeProjects = projects.filter(project => project.status === 'Active' && isProjectAvailableForPlanning(project, currentDate, currentDate));
  const staffedProjectIds = new Set(currentAllocations.map(allocation => allocation.projectId));
  const staffingGaps = activeProjects.filter(project => !staffedProjectIds.has(project.id));
  const teamIds = new Set(currentAllocations.map(allocation => allocation.employeeId));
  const team = Array.from(teamIds)
    .map(employeeId => employeeById.get(employeeId))
    .filter(Boolean) as Employee[];
  const pendingTimesheets = timesheets.filter(timesheet => timesheet.status === 'Submitted');
  const allocatedFte = currentAllocations.reduce((sum, allocation) => sum + allocation.percentage / 100, 0);
  const overloadedTeam = team.filter(employee => employee.plannedUtilization > settings.utilizationThresholdHigh);
  const endingSoon = currentAllocations.filter(allocation => {
    const days = (new Date(allocation.endDate).getTime() - new Date(currentDate).getTime()) / (1000 * 60 * 60 * 24);
    return days >= 0 && days <= 30;
  });

  const getProjectRows = (project: Project) => currentAllocations
    .filter(allocation => allocation.projectId === project.id)
    .map(allocation => {
      const employee = employeeById.get(allocation.employeeId);
      return employee ? { allocation, employee } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b!.allocation.percentage - a!.allocation.percentage || a!.employee.name.localeCompare(b!.employee.name)) as {
      allocation: Allocation;
      employee: Employee;
    }[];

  if (!user) return <Navigate to="/login" replace />;

  if (loading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-500 pb-12">
      <PageHeader
        title="PM Workspace"
        subtitle="Managed projects, team allocation, pending approvals, and staffing risks."
        breadcrumb={['Operations', user.name]}
        actions={(
          <div className="flex items-center gap-2">
            <Link to="/projects" className="btn-secondary py-2.5 px-5 flex items-center gap-2">
              <Briefcase size={14} /> Project Registry
            </Link>
            <Link to="/timesheets/approval" className="btn-primary py-2.5 px-5 flex items-center gap-2 shadow-lg shadow-primary/20">
              <CheckCircle2 size={14} /> Approvals
            </Link>
          </div>
        )}
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {[
          { label: 'Managed Projects', value: projects.length, sub: `${activeProjects.length} active today`, icon: Briefcase },
          { label: 'Current Team', value: team.length, sub: 'Visible resources', icon: Users },
          { label: 'Allocated FTE', value: formatMetric(allocatedFte), sub: 'Across active projects', icon: Users },
          { label: 'Pending Approvals', value: pendingTimesheets.length, sub: 'Submitted timesheets', icon: Clock },
          { label: 'Staffing Risks', value: staffingGaps.length + overloadedTeam.length, sub: `${staffingGaps.length} gaps, ${overloadedTeam.length} overloads`, icon: AlertCircle },
        ].map(item => (
          <div key={item.label} className="bg-white border border-border-light rounded-2xl p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{item.label}</p>
                <p className="text-2xl font-black text-heading mt-2 tabular-nums">{item.value}</p>
                <p className="text-[10px] font-bold text-slate-400 mt-1">{item.sub}</p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-orange-50 text-primary flex items-center justify-center">
                <item.icon size={16} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        <div className="xl:col-span-8 space-y-8">
          <Card title="Managed Project Load" subtitle="Current active staffing by project." headerVariant="secondary">
            <div className="space-y-3">
              {projects.slice(0, 8).map(project => {
                const rows = getProjectRows(project);
                const fte = rows.reduce((sum, row) => sum + row.allocation.percentage / 100, 0);
                return (
                  <Link
                    key={project.id}
                    to={`/projects/${project.id}`}
                    className="block rounded-2xl border border-slate-100 bg-slate-50 p-4 hover:border-primary/30 hover:bg-orange-50/60 transition-all"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-heading truncate">{project.name}</p>
                          <Badge variant={project.status === 'Active' ? 'success' : project.status === 'Proposed' ? 'neutral' : 'warning'}>{project.status}</Badge>
                        </div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">{project.projectCode} | {project.client}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-lg font-black text-heading tabular-nums">{formatFte(fte)}</p>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">{rows.length} resource{rows.length === 1 ? '' : 's'}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {rows.slice(0, 4).map(({ allocation, employee }) => (
                        <span key={allocation.id} className="rounded-xl border border-slate-100 bg-white px-2.5 py-1 text-[10px] font-bold text-heading">
                          {employee.name} <span className="text-primary tabular-nums">{allocation.percentage}%</span>
                        </span>
                      ))}
                      {rows.length === 0 && (
                        <span className="rounded-xl border border-dashed border-slate-200 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                          No current resources
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
              {projects.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center">
                  <p className="text-sm font-bold text-heading">No managed projects in this scope.</p>
                  <p className="text-xs text-slate-400 mt-2">Projects appear here when the project manager mapping matches your user.</p>
                </div>
              )}
            </div>
          </Card>

          <Card title="Team Allocation" subtitle="People currently assigned to your active projects." headerVariant="secondary">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {team
                .sort((a, b) => b.plannedUtilization - a.plannedUtilization || a.name.localeCompare(b.name))
                .slice(0, 8)
                .map(employee => (
                  <Link
                    key={employee.id}
                    to={`/employees/${employee.id}`}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 hover:border-primary/30 hover:bg-orange-50/60 transition-all"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-heading truncate">{employee.name}</p>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">{employee.employeeId} | {employee.designation}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={cn(
                        'text-sm font-black tabular-nums',
                        employee.plannedUtilization > settings.utilizationThresholdHigh ? 'text-danger' : 'text-primary'
                      )}>
                        P {formatPercent(employee.plannedUtilization)}
                      </p>
                      <p className="mt-1 text-[9px] font-bold uppercase tracking-widest text-slate-400 tabular-nums">
                        A {formatPercent(employee.actualUtilization)}
                      </p>
                    </div>
                  </Link>
                ))}
              {team.length === 0 && (
                <div className="md:col-span-2 rounded-2xl border border-dashed border-slate-200 p-8 text-center">
                  <p className="text-xs font-bold text-slate-400">No current team allocation to show.</p>
                </div>
              )}
            </div>
          </Card>
        </div>

        <div className="xl:col-span-4 space-y-8">
          <Card
            title="Pending Approvals"
            headerVariant="secondary"
            headerAction={<Link to="/timesheets/approval" className="text-[10px] font-bold uppercase tracking-widest text-primary">Open</Link>}
          >
            <div className="space-y-3">
              {pendingTimesheets.slice(0, 5).map(timesheet => (
                <Link
                  key={`${timesheet.employeeId}:${timesheet.weekEnding}`}
                  to="/timesheets/approval"
                  className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 hover:border-primary/30 hover:bg-orange-50/60 transition-all"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-heading truncate">{timesheet.employeeName}</p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">{timesheet.weekEnding}</p>
                  </div>
                  <span className="text-xs font-black text-primary tabular-nums">{formatHours(timesheet.totalHours)}</span>
                </Link>
              ))}
              {pendingTimesheets.length === 0 && (
                <p className="text-xs font-bold text-slate-400 py-4">No submitted timesheets are pending in your project scope.</p>
              )}
            </div>
          </Card>

          <Card title="Risk Queue" headerVariant="secondary">
            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-rose-500 mb-2">Staffing Gaps</p>
                <div className="space-y-2">
                  {staffingGaps.slice(0, 3).map(project => (
                    <Link key={project.id} to={`/projects/${project.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2">
                      <span className="text-xs font-bold text-heading truncate">{project.name}</span>
                      <ArrowUpRight size={13} className="text-rose-500 shrink-0" />
                    </Link>
                  ))}
                  {staffingGaps.length === 0 && <p className="text-[10px] font-bold text-slate-400">No active staffing gaps.</p>}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-2">Ending Soon</p>
                <div className="space-y-2">
                  {endingSoon.slice(0, 3).map(allocation => (
                    <Link key={allocation.id} to={`/projects/${allocation.projectId}`} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                      <span className="text-xs font-bold text-heading truncate">{allocation.projectName}</span>
                      <span className="text-[10px] font-bold text-slate-400">{allocation.endDate}</span>
                    </Link>
                  ))}
                  {endingSoon.length === 0 && <p className="text-[10px] font-bold text-slate-400">No allocations ending in the next 30 days.</p>}
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
