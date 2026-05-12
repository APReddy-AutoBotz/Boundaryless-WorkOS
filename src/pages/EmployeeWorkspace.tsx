import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowUpRight, Briefcase, Calendar, Clock, Loader2, Target, TrendingUp } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { allocationService, adminService, employeeService, projectService, timesheetService } from '../services/api';
import { authService } from '../services/authService';
import { Allocation, Employee, Project, SystemSettings, TimesheetSummary } from '../types';
import { cn } from '../lib/utils';
import { getLatestApprovedActualUtilization, isProjectAvailableForPlanning, overlapsDateRange } from '../services/calculations';

const todayIso = () => new Date().toISOString().split('T')[0];

const getCurrentWeekEnding = () => {
  const today = new Date();
  const day = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() + (day === 0 ? -6 : 1 - day));
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  return friday.toISOString().split('T')[0];
};

const getUtilLabel = (planned: number, settings: SystemSettings) => {
  if (planned > settings.utilizationThresholdHigh) return { label: 'Overloaded', variant: 'danger' as const };
  if (planned <= settings.benchThreshold) return { label: 'Bench', variant: 'neutral' as const };
  if (planned < settings.utilizationThresholdLow) return { label: 'Underutilized', variant: 'warning' as const };
  return { label: 'Balanced', variant: 'success' as const };
};

export const EmployeeWorkspace = () => {
  const user = authService.getCurrentUser();
  const [loading, setLoading] = useState(true);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
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
      employeeService.getById(user.id),
      projectService.getAll(),
      allocationService.getAll(),
      timesheetService.getAll(),
      adminService.getSettings(),
    ]).then(([emp, projectData, allocationData, timesheetData, systemSettings]) => {
      setEmployee(emp ?? null);
      setProjects(projectData);
      setAllocations(allocationData.filter(allocation => allocation.employeeId === user.id));
      setTimesheets(timesheetData.filter(timesheet => timesheet.employeeId === user.id));
      setSettings(systemSettings);
    }).finally(() => setLoading(false));
  }, [user]);

  const projectById = useMemo(() => new Map(projects.map(project => [project.id, project])), [projects]);
  const currentDate = todayIso();
  const currentWeekEnding = getCurrentWeekEnding();
  const currentTimesheet = timesheets.find(timesheet => timesheet.weekEnding === currentWeekEnding);

  const currentAllocations = useMemo(() => allocations
    .filter(allocation => {
      const project = projectById.get(allocation.projectId);
      return allocation.status === 'Active' &&
        !!project &&
        isProjectAvailableForPlanning(project, currentDate, currentDate) &&
        overlapsDateRange(allocation.startDate, allocation.endDate, currentDate, currentDate);
    })
    .sort((a, b) => b.percentage - a.percentage || a.projectName.localeCompare(b.projectName)), [allocations, currentDate, projectById]);

  const plannedUtilization = currentAllocations.reduce((sum, allocation) => sum + allocation.percentage, 0);
  const actualUtilization = employee ? getLatestApprovedActualUtilization(employee.id, timesheets, settings) : 0;
  const utilStatus = getUtilLabel(plannedUtilization, settings);
  const currentHours = currentTimesheet?.totalHours ?? 0;
  const submittedWeeks = timesheets.filter(timesheet => timesheet.status !== 'Draft').length;
  const upcomingAllocations = allocations
    .filter(allocation => allocation.status === 'Active')
    .sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime())
    .slice(0, 4);

  if (!user) return <Navigate to="/login" replace />;

  if (loading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="py-20 text-center">
        <h2 className="text-xl font-bold text-heading">Workspace unavailable</h2>
        <p className="mt-2 text-sm text-body/60">Your employee profile is not available in the current workspace.</p>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-500 pb-12">
      <PageHeader
        title="My Workspace"
        subtitle="Your current assignments, utilization, and weekly timesheet status."
        breadcrumb={['Self Service', employee.employeeId]}
        actions={(
          <Link to="/timesheets" className="btn-primary py-2.5 px-5 flex items-center gap-2 shadow-lg shadow-primary/20">
            <Clock size={14} /> Open Timesheet
          </Link>
        )}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Planned Utilization', value: `${plannedUtilization}%`, sub: 'Current allocation load', icon: Target },
          { label: 'Actual Utilization', value: `${actualUtilization}%`, sub: 'Latest approved week', icon: TrendingUp },
          { label: 'This Week Hours', value: `${currentHours}h`, sub: currentTimesheet?.status || 'Not started', icon: Clock },
          { label: 'Active Projects', value: currentAllocations.length, sub: `${submittedWeeks} submitted week${submittedWeeks === 1 ? '' : 's'}`, icon: Briefcase },
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
        <div className="xl:col-span-4 space-y-8">
          <Card title="Utilization Snapshot" headerVariant="secondary">
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Current Status</p>
                  <p className="text-sm font-bold text-heading mt-1">{employee.designation}</p>
                </div>
                <Badge variant={utilStatus.variant}>{utilStatus.label}</Badge>
              </div>
              <div className="space-y-4">
                {[
                  { label: 'Planned', value: plannedUtilization, color: 'bg-primary' },
                  { label: 'Actual', value: actualUtilization, color: 'bg-heading/50' },
                ].map(item => (
                  <div key={item.label}>
                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
                      <span>{item.label}</span>
                      <span>{item.value}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className={cn('h-full rounded-full transition-all', item.color)} style={{ width: `${Math.min(item.value, 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[10px] font-medium text-slate-500 leading-relaxed">
                Planned comes from active allocation percentages. Actual comes from approved timesheet hours against the expected weekly hours.
              </p>
            </div>
          </Card>

          <Card title="This Week Timesheet" headerVariant="secondary">
            <div className="flex items-center justify-between gap-4">
              <div>
                <Badge variant={currentTimesheet?.status === 'Approved' ? 'success' : currentTimesheet?.status === 'Rejected' ? 'danger' : 'neutral'}>
                  {currentTimesheet?.status || 'Not Started'}
                </Badge>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-3">Week ending {currentWeekEnding}</p>
                <p className="text-2xl font-black text-heading mt-2 tabular-nums">{currentHours}h</p>
              </div>
              <Link to="/timesheets" className="btn-secondary py-2.5 px-4 text-[10px] font-bold uppercase tracking-widest">
                Continue
              </Link>
            </div>
          </Card>
        </div>

        <div className="xl:col-span-8 space-y-8">
          <Card title="My Current Projects" subtitle="Active assignments for today." headerVariant="secondary">
            <div className="space-y-3">
              {currentAllocations.map(allocation => {
                const project = projectById.get(allocation.projectId);
                return (
                  <Link
                    key={allocation.id}
                    to={`/projects/${allocation.projectId}`}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 hover:border-primary/30 hover:bg-orange-50/60 transition-all"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-heading truncate">{allocation.projectName}</p>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">
                        {project?.client || 'Client'} | {allocation.roleOnProject || employee.designation}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-black text-primary tabular-nums">{allocation.percentage}%</p>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">{allocation.billable ? 'Billable' : 'Internal'}</p>
                    </div>
                  </Link>
                );
              })}
              {currentAllocations.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center">
                  <p className="text-sm font-bold text-heading">No current active project allocation</p>
                  <p className="text-xs text-slate-400 mt-2">Your assignment list will appear here when allocation control has active plans for today.</p>
                </div>
              )}
            </div>
          </Card>

          <Card title="Allocation Timeline" subtitle="Nearest active assignment end dates." headerVariant="secondary">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {upcomingAllocations.map(allocation => (
                <div key={allocation.id} className="rounded-2xl border border-border-light bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-heading truncate">{allocation.projectName}</p>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">{allocation.startDate} to {allocation.endDate}</p>
                    </div>
                    <Badge variant={allocation.status === 'Active' ? 'success' : 'neutral'}>{allocation.percentage}%</Badge>
                  </div>
                </div>
              ))}
              {upcomingAllocations.length === 0 && (
                <div className="md:col-span-2 rounded-2xl border border-dashed border-slate-200 p-8 text-center">
                  <Calendar className="mx-auto text-slate-300" size={28} />
                  <p className="text-xs font-bold text-slate-400 mt-3">No active allocation timeline to show.</p>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
