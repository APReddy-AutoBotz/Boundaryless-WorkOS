import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { NoticeBanner } from '../components/ui/NoticeBanner';
import { 
  employeeService, 
  projectService, 
  allocationService, 
  timesheetService,
  adminService 
} from '../services/api';
import { authService } from '../services/authService';
import { 
  KPIData, 
  Allocation, 
  Project,
  Employee,
  AuditLog,
  TimesheetSummary,
  CountryDirector,
  SystemSettings
} from '../types';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { 
  TrendingUp, 
  ChevronRight,
  Loader2,
  Filter,
  Download,
  RefreshCcw,
  Clock,
  AlertCircle,
  ArrowUpRight,
  Target,
  Zap,
  Users,
  Briefcase,
  Activity,
  Layers,
  Search,
  ExternalLink,
  ShieldCheck,
  MapPin,
  MoreHorizontal,
  ChevronDown,
  Info
} from 'lucide-react';
import { DataStorage } from '../services/storage';
import { isProjectAvailableForPlanning, overlapsDateRange, getUtilizationEligibleEmployees } from '../services/calculations';

const CHART_COLORS = ['#94A3B8', '#1E293B', '#EF4444', '#F59E0B', '#3B82F6'];

export const Dashboard = () => {
  const [data, setData] = useState<{
    employees: Employee[];
    projects: Project[];
    allocations: Allocation[];
    logs: AuditLog[];
    timesheets: TimesheetSummary[];
    directors: CountryDirector[];
    settings: SystemSettings;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCDId, setSelectedCDId] = useState<string>('all');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [notice, setNotice] = useState('');

  const fetchData = async () => {
    setLoading(true);
    const [employees, projects, allocations, logs, timesheets, directors, settings] = await Promise.all([
      employeeService.getAll(),
      projectService.getAll(),
      allocationService.getAll(),
      adminService.getAuditLogs(),
      timesheetService.getAll(),
      adminService.getCountryDirectors(),
      adminService.getSettings(),
    ]);
    const session = authService.getCurrentUser();
    setData({ employees, projects, allocations, logs, timesheets, directors, settings });
    setCurrentUser(session);
    if (session?.role === 'CountryDirector' && session.cdId) {
      setSelectedCDId(session.cdId);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const stats = useMemo(() => {
    if (!data) return null;
    
    const activeEmps = data.employees.filter(e => e.status === 'Active');
    const utilizationEmps = getUtilizationEligibleEmployees(activeEmps, data.allocations, data.projects);
    
    // ROW 1: Global metrics (Always visible, non-filtered)
    const globalOverloaded = utilizationEmps.filter(e => e.plannedUtilization > data.settings.utilizationThresholdHigh);
    const globalUnderutilized = utilizationEmps.filter(e => e.plannedUtilization < data.settings.utilizationThresholdLow && e.plannedUtilization > data.settings.benchThreshold);
    const globalBench = utilizationEmps.filter(e => e.plannedUtilization <= data.settings.benchThreshold);
    const currentDate = new Date().toISOString().split('T')[0];
    const projectsById = new Map<string, Project>(data.projects.map(project => [project.id, project]));
    const currentStaffedProjectIds = new Set(data.allocations
      .filter(allocation => {
        const project = projectsById.get(allocation.projectId);
        return allocation.status === 'Active' &&
          project?.status === 'Active' &&
          isProjectAvailableForPlanning(project, currentDate, currentDate) &&
          overlapsDateRange(allocation.startDate, allocation.endDate, currentDate, currentDate);
      })
      .map(allocation => allocation.projectId));
    const globalProjectsAtRisk = data.projects.filter(p =>
      p.status === 'On Hold' ||
      (p.status === 'Active' && isProjectAvailableForPlanning(p, currentDate, currentDate) && !currentStaffedProjectIds.has(p.id))
    );
    
    const globalAvgPlanned = utilizationEmps.length > 0
      ? utilizationEmps.reduce((sum, e) => sum + e.plannedUtilization, 0) / utilizationEmps.length
      : 0;

    const globalStats = {
      totalEmployees: activeEmps.length,
      utilizationEligibleEmployees: utilizationEmps.length,
      governanceUsers: activeEmps.length - utilizationEmps.length,
      avgPlanned: globalAvgPlanned,
      overloadedCount: globalOverloaded.length,
      underutilizedCount: globalUnderutilized.length + globalBench.length,
      pendingTimesheets: data.timesheets.filter(t => t.status === 'Submitted').length,
      projectsAtRisk: globalProjectsAtRisk.length
    };
    // ROW 2: Region stats for overview Matrix
    const regionStats = data.directors.map(cd => {
      const cdPeople = activeEmps.filter(e =>
        e.primaryCountryDirectorId === cd.id || 
        e.mappedCountryDirectorIds.includes(cd.id)
      );
      const cdEmps = getUtilizationEligibleEmployees(cdPeople, data.allocations, data.projects, currentDate);
      const cdEmployeeIds = new Set(cdEmps.map(employee => employee.id));
      const cdProjectIds = new Set<string>();
      const cdClients = new Set<string>();
      data.allocations
        .filter(allocation => allocation.status === 'Active' && cdEmployeeIds.has(allocation.employeeId) && overlapsDateRange(allocation.startDate, allocation.endDate, currentDate, currentDate))
        .forEach(allocation => {
          const project = projectsById.get(allocation.projectId);
          if (!project || !isProjectAvailableForPlanning(project, currentDate, currentDate)) return;
          cdProjectIds.add(project.id);
          cdClients.add(project.client);
        });
      const avgPlanned = cdEmps.length > 0 ? cdEmps.reduce((s, e) => s + e.plannedUtilization, 0) / cdEmps.length : 0;
      const avgActual = cdEmps.length > 0 ? cdEmps.reduce((s, e) => s + (e.actualUtilization || 0), 0) / cdEmps.length : 0;
      return {
        id: cd.id,
        name: cd.name,
        region: cd.region,
        teamSize: cdEmps.length,
        totalPeople: cdPeople.length,
        governanceUsers: cdPeople.length - cdEmps.length,
        avgUtil: Math.round(avgPlanned),
        avgActual: Math.round(avgActual),
        overCount: cdEmps.filter(e => e.plannedUtilization > data.settings.utilizationThresholdHigh).length,
        underCount: cdEmps.filter(e => e.plannedUtilization < data.settings.utilizationThresholdLow).length,
        projectCount: cdProjectIds.size,
        clientCount: cdClients.size,
      };
    });

    // FILTERED VIEW: Row 3, 4, 5
    let filteredEmployees = utilizationEmps;
    if (selectedCDId !== 'all') {
      filteredEmployees = filteredEmployees.filter(e => 
        e.primaryCountryDirectorId === selectedCDId || 
        e.mappedCountryDirectorIds.includes(selectedCDId)
      );
    }

    const filteredOverloaded = filteredEmployees.filter(e => e.plannedUtilization > data.settings.utilizationThresholdHigh);
    const filteredUnderutilized = filteredEmployees.filter(e => e.plannedUtilization < data.settings.utilizationThresholdLow && e.plannedUtilization > data.settings.benchThreshold);
    const filteredBench = filteredEmployees.filter(e => e.plannedUtilization <= data.settings.benchThreshold);
    const filteredMissingTimesheets = filteredEmployees.filter(e => e.status === 'Active' && !data.timesheets.some(t => t.employeeId === e.id));

    // Project Health (Row 5)
    let filteredProjects = data.projects;
    if (selectedCDId !== 'all') {
      const filteredEmpIds = new Set(filteredEmployees.map(e => e.id));
      const filteredAllocations = data.allocations.filter(a =>
        filteredEmpIds.has(a.employeeId) &&
        a.status === 'Active' &&
        overlapsDateRange(a.startDate, a.endDate, currentDate, currentDate)
      );
      const activeProjIds = new Set(filteredAllocations.map(a => a.projectId));
      filteredProjects = data.projects.filter(p => activeProjIds.has(p.id) && isProjectAvailableForPlanning(p, currentDate, currentDate));
    }

    const avgPlanned = filteredEmployees.length > 0 
      ? filteredEmployees.reduce((sum, e) => sum + e.plannedUtilization, 0) / filteredEmployees.length 
      : 0;

    // Chart Data
    const distribution = [
      { name: 'Underutilized', value: filteredUnderutilized.length + filteredBench.length },
      { name: 'Balanced', value: filteredEmployees.length - filteredOverloaded.length - filteredUnderutilized.length - filteredBench.length },
      { name: 'Overloaded', value: filteredOverloaded.length }
    ];

    const filteredEmployeeIds = new Set(filteredEmployees.map(employee => employee.id));
    const filteredProjectIds = new Set(filteredProjects.map(project => project.id));
    const clientMap = new Map<string, {
      client: string;
      peopleIds: Set<string>;
      projectIds: Set<string>;
      allocatedFte: number;
      billableFte: number;
    }>();

    data.allocations
      .filter(allocation => allocation.status === 'Active' && filteredEmployeeIds.has(allocation.employeeId) && filteredProjectIds.has(allocation.projectId))
      .forEach(allocation => {
        const project = projectsById.get(allocation.projectId);
        if (!project || !isProjectAvailableForPlanning(project, currentDate, currentDate)) return;
        const current = clientMap.get(project.client) || {
          client: project.client,
          peopleIds: new Set<string>(),
          projectIds: new Set<string>(),
          allocatedFte: 0,
          billableFte: 0,
        };
        current.peopleIds.add(allocation.employeeId);
        current.projectIds.add(project.id);
        current.allocatedFte += allocation.percentage / 100;
        if (allocation.billable && project.billable) {
          current.billableFte += allocation.percentage / 100;
        }
        clientMap.set(project.client, current);
      });

    const clientDistribution = Array.from(clientMap.values())
      .map(client => ({
        client: client.client,
        people: client.peopleIds.size,
        projects: client.projectIds.size,
        allocatedFte: Number(client.allocatedFte.toFixed(1)),
        billableFte: Number(client.billableFte.toFixed(1)),
        peopleShare: filteredEmployees.length > 0 ? Math.round((client.peopleIds.size / filteredEmployees.length) * 100) : 0,
      }))
      .sort((a, b) => b.allocatedFte - a.allocatedFte || b.people - a.people);

    const totalClientFte = clientDistribution.reduce((sum, client) => sum + client.allocatedFte, 0);
    const topThreeClientShare = totalClientFte > 0
      ? Math.round((clientDistribution.slice(0, 3).reduce((sum, client) => sum + client.allocatedFte, 0) / totalClientFte) * 100)
      : 0;

    return {
      globalStats,
      regionStats,
      filteredEmployees,
      filteredOverloaded,
      filteredUnderutilized,
      filteredBench,
      filteredMissingTimesheets,
      filteredProjects,
      distribution,
      clientDistribution,
      totalClientFte,
      topThreeClientShare,
      avgPlanned,
      activeProjectsCount: filteredProjects.length
    };
  }, [data, selectedCDId]);

  const selectedCD = useMemo(() => {
    if (selectedCDId === 'all') return null;
    return data?.directors.find(d => d.id === selectedCDId);
  }, [data, selectedCDId]);

  const logNotification = (employee: Employee) => {
    adminService.logAction('Notify', 'Dashboard', `Reminder queued for ${employee.name} to submit missing timesheet`);
    setNotice(`Reminder queued for ${employee.name}.`);
  };

  if (loading || !data || !stats) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  const PIE_COLORS = ['#94A3B8', '#1E293B', '#EF4444'];
  const sortedRegionStats = [...stats.regionStats].sort((a, b) => {
    const aRisk = a.overCount * 3 + a.underCount;
    const bRisk = b.overCount * 3 + b.underCount;
    return bRisk - aRisk || b.projectCount - a.projectCount || b.avgUtil - a.avgUtil;
  });
  const selectedRegionStats = selectedCDId === 'all'
    ? null
    : stats.regionStats.find(region => region.id === selectedCDId);
  const selectedScopeName = selectedRegionStats?.name || 'Consolidated View';
  const selectedScopeRegion = selectedRegionStats?.region || 'Global Portfolio';
  const selectedScopeUtil = selectedRegionStats?.avgUtil ?? Math.round(stats.globalStats.avgPlanned);
  const selectedScopeActual = selectedRegionStats?.avgActual ?? Math.round(
    stats.filteredEmployees.length
      ? stats.filteredEmployees.reduce((sum, employee) => sum + employee.actualUtilization, 0) / stats.filteredEmployees.length
      : 0
  );
  const selectedScopeRisk = selectedRegionStats?.overCount ?? stats.globalStats.overloadedCount;
  const selectedScopeTeam = selectedRegionStats?.teamSize ?? stats.globalStats.totalEmployees;
  const selectedScopeProjects = selectedRegionStats?.projectCount ?? stats.filteredProjects.filter(project => project.status !== 'Completed').length;
  const selectedScopeHealth = selectedScopeRisk > 3
    ? 'Needs Action'
    : selectedScopeRisk > 0 || selectedScopeUtil < data.settings.utilizationThresholdLow
      ? 'Watch'
      : 'Healthy';
  const maxClientFte = Math.max(...stats.clientDistribution.map(client => client.allocatedFte), 1);
  const utilizationDistributionTotal = stats.distribution.reduce((sum, item) => sum + item.value, 0);
  const dashboardDate = new Date().toISOString().split('T')[0];
  const dashboardEmployeesById = new Map(data.employees.map(employee => [employee.id, employee]));
  const getProjectResourceRows = (project: Project) => {
    if (!isProjectAvailableForPlanning(project, dashboardDate, dashboardDate)) return [];

    return data.allocations
      .filter(allocation =>
        allocation.projectId === project.id &&
        allocation.status === 'Active' &&
        overlapsDateRange(allocation.startDate, allocation.endDate, dashboardDate, dashboardDate)
      )
      .map(allocation => {
        const employee = dashboardEmployeesById.get(allocation.employeeId);
        return employee ? { allocation, employee } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b!.allocation.percentage - a!.allocation.percentage || a!.employee.name.localeCompare(b!.employee.name)) as {
        allocation: Allocation;
        employee: Employee;
      }[];
  };
  const staffingGapProjects = stats.filteredProjects.filter(project => getProjectResourceRows(project).length === 0);

  return (
    <div className="space-y-8 pb-20">
      {/* HEADER SECTION */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-heading">Operations Dashboard</h1>
          <p className="text-xs text-body opacity-60">Connected as {currentUser?.name} • {currentUser?.role}</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={fetchData}
            className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-heading hover:bg-slate-50 transition-all"
          >
            <RefreshCcw size={14} /> Refresh Dashboard
          </button>
        </div>
      </div>

      {notice && (
        <NoticeBanner
          type="success"
          title="Reminder"
          message={notice}
          onClose={() => setNotice('')}
        />
      )}

      {/* ROW 1 — GLOBAL COMPANY METRICS */}
      <section>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          {[
            { label: 'Total People', value: stats.globalStats.totalEmployees, sub: `${stats.globalStats.governanceUsers} governance`, color: 'slate' },
            { label: 'Util FTE', value: stats.globalStats.utilizationEligibleEmployees, sub: 'Delivery capacity', color: 'slate' },
            { label: 'Avg Util %', value: `${stats.globalStats.avgPlanned.toFixed(1)}%`, sub: 'Delivery load', color: 'slate' },
            { label: 'Overloaded', value: stats.globalStats.overloadedCount, sub: `>${data.settings.utilizationThresholdHigh}% capacity`, color: 'rose' },
            { label: 'Underutilized', value: stats.globalStats.underutilizedCount, sub: `<${data.settings.utilizationThresholdLow}% capacity`, color: 'orange' },
            { label: 'Pending Logs', value: stats.globalStats.pendingTimesheets, sub: 'Timesheets', color: 'slate' },
            { label: 'Risk Projects', value: stats.globalStats.projectsAtRisk, sub: 'Staffing gaps', color: 'rose' }
          ].map((kpi, i) => (
            <div key={i} className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-2">{kpi.label}</p>
              <h3 className={cn(
                "text-2xl font-black tabular-nums",
                kpi.color === 'rose' && kpi.value > 0 ? "text-rose-600" : "text-heading"
              )}>{kpi.value}</h3>
              <p className="text-[9px] font-medium text-slate-400 mt-1">{kpi.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ROW 2 - REGION / COUNTRY DIRECTOR VIEW */}
      <section className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
        <div className="grid grid-cols-1 xl:grid-cols-12">
          <div className="xl:col-span-3 bg-slate-dark text-white p-5 flex flex-col justify-between min-h-[260px]">
            <div>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-primary">
                  <MapPin size={15} />
                  <span className="text-[9px] font-bold uppercase tracking-[0.18em]">Regional Command Center</span>
                </div>
                <button
                  onClick={() => setSelectedCDId('all')}
                  className={cn(
                    "text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-lg border transition-all",
                    selectedCDId === 'all' ? "bg-white text-slate-dark border-white" : "border-white/15 text-white/60 hover:text-white"
                  )}
                >
                  Global
                </button>
              </div>

              <div className="mt-5">
                <p className="text-[9px] font-bold uppercase tracking-widest text-white/35">{selectedScopeRegion}</p>
                <h2 className="text-xl font-black tracking-tight mt-1.5">{selectedScopeName}</h2>
                <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                  <span className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    selectedScopeHealth === 'Healthy' ? "bg-success" : selectedScopeHealth === 'Watch' ? "bg-primary" : "bg-danger"
                  )}></span>
                  <span className="text-[9px] font-bold uppercase tracking-widest text-white/70">{selectedScopeHealth}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-5">
                {[
                  { label: 'Planned', value: `${selectedScopeUtil}%`, href: null },
                  { label: 'Actual', value: `${selectedScopeActual}%`, href: null },
                  { label: 'FTE', value: selectedScopeTeam, href: selectedCDId === 'all' ? '/employees' : `/employees?countryDirectorId=${selectedCDId}` },
                  { label: 'Projects', value: selectedScopeProjects, href: selectedCDId === 'all' ? '/projects' : `/projects?countryDirectorId=${selectedCDId}` },
                ].map(metric => {
                  const content = (
                    <>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-white/35">{metric.label}</p>
                      <p className={cn(
                        "text-xl font-black mt-0.5 tabular-nums",
                        metric.href && "underline decoration-primary/40 underline-offset-4"
                      )}>{metric.value}</p>
                    </>
                  );
                  return metric.href ? (
                    <Link
                      key={metric.label}
                      to={metric.href}
                      className="rounded-xl border border-white/10 bg-white/[0.04] p-3 transition-all hover:border-primary/50 hover:bg-white/[0.08] focus:outline-none focus:ring-2 focus:ring-primary/30"
                      title={`Open ${metric.label.toLowerCase()} for ${selectedScopeName}`}
                    >
                      {content}
                    </Link>
                  ) : (
                    <div key={metric.label} className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                      {content}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2">
              <Link
                to={selectedCDId === 'all' ? '/employees' : `/employees?countryDirectorId=${selectedCDId}`}
                className="rounded-lg bg-white text-slate-dark px-2 py-2 text-[9px] font-bold uppercase tracking-widest flex items-center justify-center gap-1.5"
              >
                <Users size={12} /> People
              </Link>
              <Link to="/allocations" className="rounded-lg bg-primary text-white px-2 py-2 text-[9px] font-bold uppercase tracking-widest flex items-center justify-center gap-1.5">
                <Target size={12} /> Load
              </Link>
              <Link to="/projects" className="rounded-lg border border-white/15 px-2 py-2 text-[9px] font-bold uppercase tracking-widest text-white/75 hover:text-white flex items-center justify-center gap-1.5">
                <Briefcase size={12} /> Work
              </Link>
            </div>
          </div>

          <div className="xl:col-span-9 p-4 lg:p-5">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-3 mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black text-heading uppercase tracking-widest">Country Director Portfolio</h3>
                  <div className="group relative z-50">
                    <Info size={14} className="text-slate-300 cursor-help" />
                    <div className="absolute left-0 top-full mt-2 w-72 p-3 bg-slate-800 text-white text-[10px] rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 font-medium leading-relaxed">
                      Employees mapped to multiple Country Directors may appear in more than one CD view. Global totals count each employee once.
                    </div>
                  </div>
                </div>
                <p className="hidden md:block text-[10px] text-body/55 mt-1">Ranked by load health, delivery footprint, and utilization.</p>
              </div>
              <div className="flex items-center gap-1.5 rounded-2xl bg-slate-50 border border-slate-100 p-1">
                <button
                  onClick={() => setSelectedCDId('all')}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-[9px] font-bold uppercase tracking-widest transition-all",
                    selectedCDId === 'all' ? "bg-white text-primary shadow-sm" : "text-slate-400 hover:text-heading"
                  )}
                >
                  All Regions
                </button>
                <Link to="/employees" className="px-3 py-1.5 rounded-xl text-[9px] font-bold uppercase tracking-widest text-slate-400 hover:text-heading">
                  Directory
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
              {sortedRegionStats.map(region => {
                const isSelected = selectedCDId === region.id;
                const health = region.overCount > 2 ? 'Needs Action' : region.overCount > 0 || region.avgUtil < data.settings.utilizationThresholdLow ? 'Watch' : 'Healthy';
                return (
                  <div
                    key={region.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedCDId(region.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setSelectedCDId(region.id);
                      }
                    }}
                    className={cn(
                      "group text-left rounded-xl border p-3 transition-all min-h-[118px] cursor-pointer",
                      isSelected
                        ? "border-primary bg-orange-50/70 shadow-sm"
                        : "border-slate-200 bg-white hover:border-primary/40 hover:bg-slate-50"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">{region.region}</p>
                        <h4 className="text-sm font-black text-heading mt-0.5">{region.name}</h4>
                      </div>
                      <div className={cn(
                        "rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-widest",
                        health === 'Healthy' ? "bg-green-50 text-success" : health === 'Watch' ? "bg-orange-50 text-primary" : "bg-rose-50 text-danger"
                      )}>
                        {health}
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-4 gap-2">
                      <div>
                        <p className="text-[8px] font-bold uppercase tracking-widest text-slate-400">Plan</p>
                        <p className="text-sm font-black text-heading tabular-nums">{region.avgUtil}%</p>
                      </div>
                      <div>
                        <p className="text-[8px] font-bold uppercase tracking-widest text-slate-400">Actual</p>
                        <p className="text-sm font-black text-heading tabular-nums">{region.avgActual}%</p>
                      </div>
                      <Link
                        to={`/employees?countryDirectorId=${region.id}`}
                        onClick={(event) => event.stopPropagation()}
                        className="rounded-lg -m-1 p-1 hover:bg-white hover:shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary/20"
                        title={`Open employees mapped to ${region.name}`}
                      >
                        <p className="text-[8px] font-bold uppercase tracking-widest text-slate-400 group-hover:text-primary">FTE</p>
                        <p className="text-sm font-black text-heading tabular-nums underline decoration-primary/30 underline-offset-2">{region.teamSize}</p>
                      </Link>
                      <Link
                        to={`/projects?countryDirectorId=${region.id}`}
                        onClick={(event) => event.stopPropagation()}
                        className="rounded-lg -m-1 p-1 hover:bg-white hover:shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary/20"
                        title={`Open projects associated with ${region.name}`}
                      >
                        <p className="text-[8px] font-bold uppercase tracking-widest text-slate-400 group-hover:text-primary">Projects</p>
                        <p className="text-sm font-black text-heading tabular-nums underline decoration-primary/30 underline-offset-2">{region.projectCount}</p>
                      </Link>
                    </div>

                    <div className="mt-3 space-y-1.5">
                      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className={cn("h-full rounded-full", region.avgUtil > data.settings.utilizationThresholdHigh ? "bg-danger" : "bg-primary")}
                          style={{ width: `${Math.min(region.avgUtil, 100)}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[8px] font-bold uppercase tracking-widest text-slate-400">
                        <Link
                          to={`/clients?countryDirectorId=${region.id}`}
                          onClick={(event) => event.stopPropagation()}
                          className="inline-flex items-center gap-1 rounded-lg -mx-1 px-1.5 py-1 text-primary hover:bg-white hover:shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary/20"
                          title={`Open clients associated with ${region.name}`}
                        >
                          {region.clientCount} client{region.clientCount === 1 ? '' : 's'} in scope
                          <ArrowUpRight size={11} />
                        </Link>
                        <span className="text-slate-300 group-hover:text-slate-400 transition-colors">Current active</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* ROW 3 — IMMEDIATE ATTENTION PANEL */}
        <div className="lg:col-span-12">
          <Card 
            title="Immediate Attention Queue" 
            subtitle={selectedCD ? `Actionable alerts for ${selectedCD.region}` : "Actionable alerts for All Regions"}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-4">
              {/* Overloaded */}
              <div className="space-y-3">
                <p className="text-[10px] font-extrabold text-rose-500 uppercase tracking-widest flex items-center gap-1.5 border-b border-rose-100 pb-2">
                  <AlertCircle size={12} /> Overloaded
                </p>
                {stats.filteredOverloaded.slice(0, 3).map(e => (
                  <div key={e.id} className="p-3 bg-white border border-slate-100 rounded-xl flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-heading truncate">{e.name}</p>
                      <p className="text-[9px] font-bold text-rose-600">{e.plannedUtilization}% Load</p>
                    </div>
                    <Link to={`/employees/${e.id}`} className="text-[9px] font-bold text-rose-600 hover:underline">REASSIGN</Link>
                  </div>
                ))}
                {stats.filteredOverloaded.length === 0 && <p className="text-[10px] italic text-slate-300">Clear.</p>}
              </div>

              {/* Underutilized */}
              <div className="space-y-3">
                <p className="text-[10px] font-extrabold text-orange-500 uppercase tracking-widest flex items-center gap-1.5 border-b border-orange-100 pb-2">
                  <TrendingUp size={12} /> Underutilized
                </p>
                {[...stats.filteredUnderutilized, ...stats.filteredBench].slice(0, 3).map(e => (
                  <div key={e.id} className="p-3 bg-white border border-slate-100 rounded-xl flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-heading truncate">{e.name}</p>
                      <p className="text-[9px] font-bold text-orange-600">{e.plannedUtilization}% Util</p>
                    </div>
                    <Link to={`/allocations`} className="text-[9px] font-bold text-orange-600 hover:underline">ALLOCATE</Link>
                  </div>
                ))}
              </div>

              {/* Staffing Gaps */}
              <div className="space-y-3">
                <p className="text-[10px] font-extrabold text-blue-500 uppercase tracking-widest flex items-center gap-1.5 border-b border-blue-100 pb-2">
                  <Briefcase size={12} /> Staffing Gaps
                </p>
                {staffingGapProjects.slice(0, 3).map(p => (
                  <div key={p.id} className="p-3 bg-white border border-slate-100 rounded-xl flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-heading truncate">{p.name}</p>
                      <p className="text-[9px] font-bold text-blue-600">No resources</p>
                    </div>
                    <Link to={`/projects/${p.id}`} className="text-[9px] font-bold text-blue-600 hover:underline">VIEW</Link>
                  </div>
                ))}
              </div>

                {/* Pending Timesheets */}
                <div className="space-y-3">
                  <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-100 pb-2">
                    <Clock size={12} /> Missing Timesheets
                  </p>
                  {stats.filteredMissingTimesheets.slice(0, 3).map(e => (
                    <div key={e.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-heading truncate">{e.name}</p>
                        <p className="text-[9px] font-bold text-slate-400">Week 16</p>
                      </div>
                      <button onClick={() => logNotification(e)} className="text-[9px] font-bold text-slate-600 hover:underline">NOTIFY</button>
                    </div>
                  ))}
                  {stats.filteredMissingTimesheets.length === 0 && <p className="text-[10px] italic text-slate-300">Clean Logs.</p>}
                </div>
            </div>
          </Card>
        </div>

        {/* ROW 4 — VISUAL SUMMARY */}
        <div className="lg:col-span-6">
          <Card 
            title="Capacity Risk Mix"
            subtitle="How the selected workforce is distributed across utilization bands"
          >
            <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-6 items-center mt-4">
              <div className="h-[210px] flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                  <PieChart>
                    <Pie
                      data={stats.distribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={58}
                      outerRadius={78}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {stats.distribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3">
                {stats.distribution.map((item, index) => {
                  const percentage = utilizationDistributionTotal > 0 ? Math.round((item.value / utilizationDistributionTotal) * 100) : 0;
                  return (
                    <div key={item.name} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />
                          <p className="text-[10px] font-bold uppercase tracking-widest text-heading">{item.name}</p>
                        </div>
                        <p className="text-sm font-black text-heading tabular-nums">{item.value}</p>
                      </div>
                      <div className="mt-2 h-1.5 rounded-full bg-white overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${percentage}%`, backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                        />
                      </div>
                      <p className="mt-1 text-[9px] font-bold uppercase tracking-widest text-slate-400">{percentage}% of selected people</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-6">
          <Card 
            title="Client Deployment"
            subtitle="Where active allocation capacity is concentrated"
          >
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Clients</p>
                  <p className="text-xl font-black text-heading mt-1">{stats.clientDistribution.length}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Alloc FTE</p>
                  <p className="text-xl font-black text-heading mt-1 tabular-nums">{stats.totalClientFte.toFixed(1)}</p>
                </div>
                <div className="rounded-2xl bg-orange-50 border border-primary/20 p-3">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-primary">Top 3 Share</p>
                  <p className="text-xl font-black text-heading mt-1 tabular-nums">{stats.topThreeClientShare}%</p>
                </div>
              </div>

              <div className="space-y-2 max-h-[190px] overflow-y-auto pr-1">
                {stats.clientDistribution.slice(0, 8).map((client, index) => (
                  <Link
                    key={client.client}
                    to={`/projects?client=${encodeURIComponent(client.client)}`}
                    className="block rounded-2xl border border-slate-100 bg-white p-3 hover:border-primary/40 hover:bg-orange-50/40 transition-all"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-black text-primary tabular-nums">#{index + 1}</span>
                          <p className="text-xs font-black text-heading truncate">{client.client}</p>
                        </div>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-1">
                          {client.people} people | {client.projects} process{client.projects === 1 ? '' : 'es'} | {client.peopleShare}% people share
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-black text-heading tabular-nums">{client.allocatedFte.toFixed(1)} FTE</p>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">{client.billableFte.toFixed(1)} billable</p>
                      </div>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.max(6, Math.round((client.allocatedFte / maxClientFte) * 100))}%` }}
                      />
                    </div>
                  </Link>
                ))}
                {stats.clientDistribution.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center">
                    <p className="text-xs font-bold text-slate-400">No active client allocations in this scope.</p>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* ROW 5 — PROJECT HEALTH TABLE */}
        <div className="lg:col-span-12">
          <Card title="Project Health Overview">
             <div className="overflow-x-auto -mx-6 mt-4">
                <table className="w-full text-left text-xs whitespace-nowrap">
                   <thead className="bg-slate-50 border-y border-border-light">
                      <tr>
                         <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-widest">Project Name</th>
                         <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-widest">Manager</th>
                         <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-widest">Resource Allocation</th>
                         <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-widest">Status</th>
                         <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-widest text-center">Staffing Gap</th>
                         <th className="px-6 py-4"></th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-border-light">
                      {stats.filteredProjects.slice(0, 10).map((proj) => {
                         const resourceRows = getProjectResourceRows(proj);
                         const visibleResources = resourceRows.slice(0, 3);

                         return (
                         <tr key={proj.id} className="hover:bg-slate-50 transition-all group">
                            <td className="px-6 py-4">
                               <div className="font-bold text-heading truncate max-w-[200px]">{proj.name}</div>
                               <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{proj.projectCode}</div>
                            </td>
                            <td className="px-6 py-4 font-medium text-heading">{proj.managerName}</td>
                            <td className="px-6 py-4">
                               {visibleResources.length > 0 ? (
                                  <div className="flex flex-wrap gap-1.5 max-w-[360px]">
                                    {visibleResources.map(({ allocation, employee }) => (
                                      <Link
                                        key={allocation.id}
                                        to={`/employees/${employee.id}`}
                                        className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold text-heading hover:border-primary/40 hover:bg-orange-50 transition-all"
                                      >
                                        <span className="max-w-[130px] truncate">{employee.name}</span>
                                        <span className="text-primary tabular-nums">{allocation.percentage}%</span>
                                      </Link>
                                    ))}
                                    {resourceRows.length > visibleResources.length && (
                                      <Link
                                        to={`/projects/${proj.id}`}
                                        className="inline-flex items-center rounded-full border border-primary/20 bg-orange-50 px-2.5 py-1 text-[10px] font-bold text-primary hover:bg-primary hover:text-white transition-all"
                                      >
                                        +{resourceRows.length - visibleResources.length} more
                                      </Link>
                                    )}
                                  </div>
                               ) : (
                                  <span className="inline-flex items-center rounded-full border border-dashed border-slate-200 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                    No current resources
                                  </span>
                               )}
                            </td>
                            <td className="px-6 py-4">
                               <div className="flex items-center gap-1.5">
                                  {resourceRows.length === 0 ? (
                                    <Badge variant="danger">Critical Gap</Badge>
                                  ) : (
                                    <Badge variant="success">Staffed</Badge>
                                  )}
                               </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                               {resourceRows.length === 0 ? (
                                  <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-100 uppercase">Gap Detected</span>
                               ) : (
                                  <span className="text-[10px] font-bold text-slate-400">—</span>
                               )}
                            </td>
                            <td className="px-6 py-4 text-right">
                               <Link to={`/projects/${proj.id}`} className="p-2 text-slate-300 hover:text-primary transition-all inline-block">
                                  <ChevronRight size={18} />
                                </Link>
                            </td>
                         </tr>
                         );
                      })}
                   </tbody>
                </table>
             </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
