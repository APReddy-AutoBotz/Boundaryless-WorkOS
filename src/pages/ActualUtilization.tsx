import { useState, useMemo, useEffect } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { KPIStrip } from '../components/ui/KPIStrip';
import { Badge } from '../components/ui/Badge';
import { timesheetService, employeeService, adminService } from '../services/api';
import { Employee, TimesheetSummary, KPIData } from '../types';
import { 
  Download, 
  Filter, 
  Calendar, 
  Search, 
  Clock, 
  CheckCircle2, 
  ArrowUpRight,
  BarChart3,
  Loader2
} from 'lucide-react';
import { cn } from '../lib/utils';

export const ActualUtilization = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [timesheets, setTimesheets] = useState<TimesheetSummary[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [statusFilter, setStatusFilter] = useState<'Consolidated' | 'Approved Only' | 'Pending Review'>('Consolidated');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [empData, tsData, setts] = await Promise.all([
          employeeService.getAll(),
          timesheetService.getAll(),
          adminService.getSettings(),
        ]);
        setEmployees(empData);
        setTimesheets(tsData);
        setSettings(setts);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const monthOptions = useMemo(() => {
    return Array.from(new Set<string>(timesheets.map(timesheet => timesheet.weekEnding.slice(0, 7))))
      .sort((a, b) => b.localeCompare(a))
      .map(value => ({
        value,
        label: new Date(`${value}-01T00:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
      }));
  }, [timesheets]);

  useEffect(() => {
    if (monthOptions.length > 0 && selectedMonth !== 'all' && !monthOptions.some(option => option.value === selectedMonth)) {
      setSelectedMonth(monthOptions[0].value);
    }
  }, [monthOptions, selectedMonth]);

  const scopedTimesheets = useMemo(() => {
    return timesheets.filter(timesheet => {
      const matchesMonth = selectedMonth === 'all' || timesheet.weekEnding.startsWith(selectedMonth);
      const matchesStatus = statusFilter === 'Consolidated'
        || (statusFilter === 'Approved Only' && timesheet.status === 'Approved')
        || (statusFilter === 'Pending Review' && timesheet.status === 'Submitted');
      return matchesMonth && matchesStatus;
    });
  }, [timesheets, selectedMonth, statusFilter]);

  const filteredLogs = useMemo(() => {
    return scopedTimesheets.filter(ts => ts.employeeName.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [scopedTimesheets, searchQuery]);

  const kpis = useMemo<KPIData[]>(() => {
    if (employees.length === 0) return [];
    
    const active = employees.filter(e => e.status === 'Active');
    
    // Average actual utilization across approved timesheets in the current scope
    const approvedTimesheets = scopedTimesheets.filter(timesheet => timesheet.status === 'Approved');
    const totalBillableHours = approvedTimesheets.reduce((sum, ts) => sum + ts.billableHours, 0);
    const avgActual = approvedTimesheets.length > 0 && settings
      ? ((totalBillableHours / (approvedTimesheets.length * settings.expectedWeeklyHours)) * 100).toFixed(1)
      : 0;

    const pendingReview = scopedTimesheets.filter(t => t.status === 'Submitted').length;
    const approved = scopedTimesheets.filter(t => t.status === 'Approved').length;
    const total = scopedTimesheets.length;
    const submissionRate = total > 0 ? ((approved + pendingReview) / total * 100).toFixed(1) : 0;
    const missingLogs = active.filter(e => !scopedTimesheets.some(t => t.employeeId === e.id)).length;
    const loggingVariance = active.length > 0
      ? active.reduce((sum, employee) => sum + Math.abs(employee.plannedUtilization - employee.actualUtilization), 0) / active.length
      : 0;

    return [
      { title: 'Avg. Actual Util.', value: `${avgActual}%`, change: -0.5, changeType: 'decrease', icon: 'Zap' },
      { title: 'Submission Rate', value: `${submissionRate}%`, icon: 'CheckCircle2' },
      { title: 'Pending Review', value: pendingReview, icon: 'Timer' },
      { title: 'Approved Logs', value: approved, icon: 'FileCheck' },
      { title: 'Logging Variance', value: `${loggingVariance.toFixed(1)}%`, icon: 'AlertTriangle' },
      { title: 'Missing Logs', value: missingLogs, icon: 'Clock' }
    ];
  }, [employees, scopedTimesheets, settings]);

  const weeklyReconciliation = useMemo(() => {
    const active = employees.filter(employee => employee.status === 'Active');
    const activeById = new Map(active.map(employee => [employee.id, employee]));
    const weeks = Array.from(new Set<string>(scopedTimesheets.map(timesheet => timesheet.weekEnding)))
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
      .slice(0, 6);

    return weeks.map(weekEnding => {
      const weekSheets = scopedTimesheets.filter(timesheet => timesheet.weekEnding === weekEnding);
      const submittedSheets = weekSheets.filter(timesheet => timesheet.status !== 'Draft');
      const approvedSheets = weekSheets.filter(timesheet => timesheet.status === 'Approved');
      const submittedEmployeeIds = new Set(submittedSheets.map(timesheet => timesheet.employeeId));
      const approvedEmployeeIds = new Set(approvedSheets.map(timesheet => timesheet.employeeId));
      const plannedEmployees = Array.from(approvedEmployeeIds)
        .map(employeeId => activeById.get(employeeId))
        .filter(Boolean) as Employee[];
      const planned = plannedEmployees.length
        ? plannedEmployees.reduce((sum, employee) => sum + employee.plannedUtilization, 0) / plannedEmployees.length
        : 0;
      const actualHours = approvedSheets.reduce((sum, timesheet) => sum + timesheet.billableHours, 0);
      const actual = approvedEmployeeIds.size > 0 && settings
        ? (actualHours / (approvedEmployeeIds.size * settings.expectedWeeklyHours)) * 100
        : 0;

      return {
        weekEnding,
        weekLabel: new Date(`${weekEnding}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
        planned: Math.round(planned),
        actual: Math.round(actual),
        gap: Math.round(actual - planned),
        coverage: active.length ? Math.round((submittedEmployeeIds.size / active.length) * 100) : 0,
        pending: weekSheets.filter(timesheet => timesheet.status === 'Submitted').length,
      };
    });
  }, [employees, scopedTimesheets, settings]);

  const varianceWatchlist = useMemo(() => {
    const expectedWeeklyHours = settings?.expectedWeeklyHours || 40;
    return employees
      .filter(employee => employee.status === 'Active')
      .map(employee => {
        const latestApproved = scopedTimesheets
          .filter(timesheet => timesheet.employeeId === employee.id && timesheet.status === 'Approved')
          .sort((a, b) => new Date(a.weekEnding).getTime() - new Date(b.weekEnding).getTime())
          .at(-1);
        if (!latestApproved) return null;
        const actual = Math.round((latestApproved.billableHours / expectedWeeklyHours) * 100);
        const planned = Math.round(employee.plannedUtilization);
        return {
          employee,
          planned,
          actual,
          gap: actual - planned,
          weekEnding: latestApproved.weekEnding,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))
      .slice(0, 5);
  }, [employees, scopedTimesheets, settings]);

  const currentPeriodLabel = selectedMonth === 'all'
    ? 'All Periods'
    : monthOptions.find(option => option.value === selectedMonth)?.label || 'Selected Period';
  const submittedTimesheets = scopedTimesheets.filter(timesheet => timesheet.status !== 'Draft');
  const approvalRate = submittedTimesheets.length > 0
    ? (scopedTimesheets.filter(timesheet => timesheet.status === 'Approved').length / submittedTimesheets.length) * 100
    : 0;

  const toCsv = (rows: object[]) => {
    if (rows.length === 0) return '';
    const headers = Array.from(rows.reduce<Set<string>>((set, row) => {
      Object.keys(row as Record<string, unknown>).forEach(key => set.add(key));
      return set;
    }, new Set<string>()));
    return [headers, ...rows.map(row => {
      const record = row as Record<string, unknown>;
      return headers.map(header => record[header] ?? '');
    })]
      .map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');
  };

  const downloadCsv = (fileName: string, rows: object[], auditDetails: string) => {
    const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
    adminService.logAction('Export', 'Actual Utilization', auditDetails);
  };

  const handleGlobalReport = () => {
    downloadCsv(
      'actual-utilization-global-report.csv',
      scopedTimesheets.map(timesheet => ({
        employeeId: timesheet.employeeId,
        employeeName: timesheet.employeeName,
        weekEnding: timesheet.weekEnding,
        totalHours: timesheet.totalHours,
        billableHours: timesheet.billableHours,
        actualUtilization: timesheet.status === 'Approved' ? `${((timesheet.billableHours / (settings?.expectedWeeklyHours || 40)) * 100).toFixed(1)}%` : '0%',
        status: timesheet.status,
        submittedAt: timesheet.submittedAt || '',
        approvedAt: timesheet.approvedAt || '',
        rejectedAt: timesheet.rejectedAt || '',
        rejectionReason: timesheet.rejectionReason || '',
      })),
      `Exported actual utilization report for ${currentPeriodLabel} / ${statusFilter}`
    );
  };

  const handleAuditExport = () => {
    downloadCsv(
      'actual-utilization-visible-logs.csv',
      filteredLogs.map(timesheet => ({
        employeeId: timesheet.employeeId,
        employeeName: timesheet.employeeName,
        weekEnding: timesheet.weekEnding,
        totalHours: timesheet.totalHours,
        billableHours: timesheet.billableHours,
        status: timesheet.status,
        entries: JSON.stringify(timesheet.entries),
      })),
      `Exported visible service delivery logs for ${currentPeriodLabel} / ${statusFilter}`
    );
  };

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
        title="Actual Utilization" 
        subtitle="Historical reporting based on submitted timesheet effort and service delivery logs."
        breadcrumb={['Analysis', 'Utilization']}
        actions={
          <div className="flex items-center gap-3">
             <div className="flex items-center bg-white border border-border-light rounded-xl p-1 shadow-sm mr-2 font-bold uppercase tracking-widest text-[10px]">
                <label className="px-4 flex items-center gap-2 border-r border-gray-100 h-full py-1.5 cursor-pointer hover:bg-slate-50 transition-colors rounded-l-lg">
                   <Calendar size={14} className="text-primary" />
                   <select
                     value={selectedMonth}
                     onChange={(event) => setSelectedMonth(event.target.value)}
                     className="bg-transparent text-heading outline-none cursor-pointer uppercase tracking-widest font-bold"
                     aria-label="Select actual utilization period"
                   >
                     <option value="all">All Periods</option>
                     {monthOptions.map(option => (
                       <option key={option.value} value={option.value}>{option.label}</option>
                     ))}
                   </select>
                </label>
                <label className="px-4 flex items-center gap-2 h-full py-1.5 cursor-pointer hover:bg-slate-50 transition-colors rounded-r-lg">
                   <Filter size={14} className="text-primary" />
                   <select
                     value={statusFilter}
                     onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
                     className="bg-transparent text-heading outline-none cursor-pointer uppercase tracking-widest font-bold"
                     aria-label="Filter actual utilization logs"
                   >
                     <option>Consolidated</option>
                     <option>Approved Only</option>
                     <option>Pending Review</option>
                   </select>
                </label>
             </div>
             <button
               onClick={handleGlobalReport}
               className="btn-secondary py-2.5 px-5 flex items-center gap-2 shadow-sm font-bold text-xs uppercase tracking-wider"
             >
                <Download size={14} /> Global Report
             </button>
          </div>
        }
      />

      <KPIStrip kpis={kpis} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 bg-white border border-border-light rounded-3xl p-6 shadow-sm">
          <div className="flex items-start justify-between gap-6 mb-6">
            <div>
              <h3 className="text-sm font-bold text-heading">Actual vs Planned Reconciliation</h3>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Approved effort compared with allocation plan by week</p>
            </div>
            <div className="hidden sm:flex items-center gap-4 text-[9px] font-bold uppercase tracking-widest text-gray-400">
               <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  <span>Actual</span>
               </div>
               <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-slate-300" />
                  <span>Planned</span>
               </div>
            </div>
          </div>

          <div className="space-y-4">
            {weeklyReconciliation.map(row => {
              const varianceTone = Math.abs(row.gap) >= 20 ? 'text-danger' : Math.abs(row.gap) >= 10 ? 'text-primary' : 'text-success';
              return (
                <div key={row.weekEnding} className="grid grid-cols-1 xl:grid-cols-[92px_1fr_220px] gap-4 items-center p-4 bg-slate-50/60 rounded-2xl border border-slate-100">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Week Ending</p>
                    <p className="text-sm font-bold text-heading mt-1">{row.weekLabel}</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <span className="w-14 text-[10px] font-bold uppercase tracking-widest text-gray-400">Actual</span>
                      <div className="flex-1 h-3 bg-white border border-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(row.actual, 100)}%` }} />
                      </div>
                      <span className="w-12 text-right text-xs font-bold text-heading">{row.actual}%</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="w-14 text-[10px] font-bold uppercase tracking-widest text-gray-400">Planned</span>
                      <div className="flex-1 h-3 bg-white border border-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-slate-300 rounded-full" style={{ width: `${Math.min(row.planned, 100)}%` }} />
                      </div>
                      <span className="w-12 text-right text-xs font-bold text-heading">{row.planned}%</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-white rounded-xl border border-slate-100 p-3">
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Gap</p>
                      <p className={cn("text-sm font-bold mt-1", varianceTone)}>{row.gap > 0 ? '+' : ''}{row.gap}%</p>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-100 p-3">
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Coverage</p>
                      <p className="text-sm font-bold text-heading mt-1">{row.coverage}%</p>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-100 p-3">
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Review</p>
                      <p className="text-sm font-bold text-heading mt-1">{row.pending}</p>
                    </div>
                  </div>
                </div>
              );
            })}
            {weeklyReconciliation.length === 0 && (
              <div className="h-[260px] flex items-center justify-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">No weekly utilization logs available</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border border-border-light rounded-3xl p-6 shadow-sm flex flex-col">
          <div className="mb-6">
            <h3 className="text-sm font-bold text-heading">Variance Watchlist</h3>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Largest actual vs planned gaps</p>
          </div>

          <div className="space-y-3">
            {varianceWatchlist.map(item => (
              <div key={item.employee.id} className="p-4 bg-slate-50/60 rounded-2xl border border-slate-100">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-heading truncate">{item.employee.name}</p>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mt-1">{item.employee.department}</p>
                  </div>
                  <Badge variant={Math.abs(item.gap) >= 20 ? 'danger' : 'warning'}>
                    {item.gap > 0 ? '+' : ''}{item.gap}%
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <div className="bg-white border border-slate-100 rounded-xl p-3">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Planned</p>
                    <p className="text-sm font-bold text-heading mt-1">{item.planned}%</p>
                  </div>
                  <div className="bg-white border border-slate-100 rounded-xl p-3">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Actual</p>
                    <p className="text-sm font-bold text-primary mt-1">{item.actual}%</p>
                  </div>
                </div>
              </div>
            ))}
            {varianceWatchlist.length === 0 && (
              <div className="h-full min-h-[260px] flex items-center justify-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest text-center">No approved variance data yet</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white border border-border-light rounded-2xl p-5 shadow-sm hover:shadow-md transition-all group">
           <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                 <span className="w-8 h-8 rounded-xl bg-bg-secondary text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
                   <Clock size={16} />
                 </span>
                 <h4 className="text-[10px] font-bold text-heading uppercase tracking-widest">Pending Logs</h4>
              </div>
              <ArrowUpRight size={14} className="text-gray-400" />
           </div>
           <div className="space-y-3">
              <div className="flex items-center justify-between">
                 <span className="text-xs font-bold text-heading">Current Cycle</span>
                 <Badge variant="neutral">{scopedTimesheets.filter(t => t.status === 'Submitted').length} Pending</Badge>
              </div>
              <p className="text-[10px] text-gray-500 font-medium leading-relaxed">System audit flags variations in submission rate for distributed units.</p>
           </div>
        </div>

        <div className="bg-white border border-border-light rounded-2xl p-5 shadow-sm hover:shadow-md transition-all group">
           <div className="flex items-center gap-2 mb-4">
              <span className="w-8 h-8 rounded-xl bg-bg-secondary text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
                <CheckCircle2 size={16} />
              </span>
              <h4 className="text-[10px] font-bold text-heading uppercase tracking-widest">Approval Health</h4>
           </div>
           <p className="text-xs text-body/70 font-medium mb-3 leading-relaxed">Most submitted effort has been vetted and processed for the current cycle.</p>
           <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden mt-auto">
              <div className="h-full bg-success" style={{ width: `${Math.min(approvalRate, 100)}%` }}></div>
           </div>
        </div>

        <div className="lg:col-span-2 bg-slate-dark text-white rounded-2xl p-6 flex flex-col justify-between shadow-xl">
           <div className="flex items-center gap-3">
              <BarChart3 size={18} className="text-primary" />
              <h4 className="text-sm font-bold tracking-tight">Timesheet Integrity Metric</h4>
           </div>
           <p className="text-xs text-white/50 mt-3 leading-relaxed font-medium line-clamp-2">
             Actual utilization calculations rely on 'Approved' timesheet signatures. Variances between logged and planned 
             effort are audited for invoicing integrity.
           </p>
        </div>
      </div>

      {/* Drill Down Table */}
      <div className="bg-white border border-border-light rounded-3xl overflow-hidden shadow-sm">
        <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-slate-50/50">
           <div className="flex items-center gap-4">
              <h3 className="text-sm font-bold text-heading">Service Delivery Logs</h3>
              <div className="relative">
                 <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={12} />
                 <input 
                   type="text" 
                   placeholder="Search consultant..."
                   value={searchQuery}
                   onChange={(e) => setSearchQuery(e.target.value)}
                   className="bg-white border border-border-light rounded-lg py-1.5 pl-8 pr-3 text-[10px] outline-none focus:border-primary w-48 font-bold shadow-sm"
                 />
              </div>
           </div>
           <div className="flex items-center gap-2">
              <button
                onClick={handleAuditExport}
                className="btn-secondary py-1.5 px-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider font-bold"
              >
                 <Download size={12} /> Audit Trail
              </button>
           </div>
        </div>
        
        <div className="table-container shadow-none border-none">
          <table className="w-full text-left">
            <thead className="bg-white/50 border-b border-border-light">
              <tr>
                <th className="py-4 px-8 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Consultant</th>
                <th className="py-4 px-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Week Ending</th>
                <th className="py-4 px-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Total Hours</th>
                <th className="py-4 px-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Billable %</th>
                <th className="py-4 px-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Actual Util.</th>
                <th className="py-4 px-8 text-[10px] font-bold text-right uppercase tracking-widest">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light font-bold">
              {filteredLogs.map((ts, idx) => {
                const util = ts.status === 'Approved' ? (ts.billableHours / (settings?.expectedWeeklyHours || 40)) * 100 : 0;
                const billableP = ts.totalHours > 0 ? (ts.billableHours / ts.totalHours) * 100 : 0;
                
                return (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="py-5 px-8">
                       <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded bg-bg-secondary flex items-center justify-center font-bold text-xs text-primary shadow-sm border border-border-light/40">
                             {ts.employeeName.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-heading group-hover:text-primary transition-colors">{ts.employeeName}</p>
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Consultant Log</p>
                          </div>
                       </div>
                    </td>
                    <td className="py-5 px-6 font-mono text-xs text-gray-500 font-bold">{ts.weekEnding}</td>
                    <td className="py-5 px-6 text-center">
                       <span className="text-sm font-bold text-heading">{ts.totalHours}h</span>
                    </td>
                    <td className="py-5 px-6 text-center">
                       <span className={cn(
                         "text-[10px] font-bold px-2 py-1 rounded-md",
                         billableP > 80 ? "text-success bg-green-50" : "text-gray-500 bg-gray-50"
                       )}>{billableP.toFixed(0)}%</span>
                    </td>
                    <td className="py-5 px-6 text-center">
                       <div className="flex flex-col items-center">
                          <span className={cn(
                             "text-sm font-bold",
                             util > 100 ? "text-danger" : util >= 80 ? "text-heading" : "text-primary"
                          )}>{util.toFixed(1)}%</span>
                          <div className="w-20 h-1 bg-gray-100 rounded-full mt-1 overflow-hidden">
                             <div className={cn("h-full transition-all duration-500", util > 100 ? "bg-danger" : "bg-primary")} style={{ width: `${Math.min(util, 100)}%` }} />
                          </div>
                       </div>
                    </td>
                    <td className="py-5 px-8 text-right">
                       <Badge variant={ts.status === 'Approved' ? 'success' : ts.status === 'Submitted' ? 'warning' : 'neutral'}>
                          {ts.status}
                       </Badge>
                    </td>
                  </tr>
                );
              })}
              {filteredLogs.length === 0 && (
                <tr>
                   <td colSpan={6} className="py-12 text-center text-gray-400 font-bold uppercase tracking-widest text-xs">No service delivery logs recorded</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
