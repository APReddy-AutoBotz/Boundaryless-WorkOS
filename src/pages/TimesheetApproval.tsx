import { useState, useEffect, useMemo } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { Badge } from '../components/ui/Badge';
import { timesheetService, employeeService, projectService } from '../services/api';
import { authService } from '../services/authService';
import { TimesheetSummary, Employee, Project } from '../types';
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Search, 
  Download, 
  AlertTriangle,
  ArrowUpRight,
  ChevronRight,
  Info,
  Layers,
  LayoutGrid,
  FileText,
  ShieldCheck,
  Send
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { formatHours } from '../lib/format';

export const TimesheetApproval = () => {
  const [timesheets, setTimesheets] = useState<TimesheetSummary[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rejectionTarget, setRejectionTarget] = useState<TimesheetSummary | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectionError, setRejectionError] = useState('');
  const [actionNotice, setActionNotice] = useState('');
  const user = authService.getCurrentUser();

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [projectQuery, setProjectQuery] = useState('');
  const [weekFilter, setWeekFilter] = useState('All Weeks');
  const [statusFilter, setStatusFilter] = useState('Submitted');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [tsData, empData, projData] = await Promise.all([
          timesheetService.getAll(),
          employeeService.getAll(),
          projectService.getAll(),
        ]);
        setTimesheets(tsData);
        setEmployees(empData);
        setProjects(projData);
      } catch (error) {
        console.error('Failed to fetch data', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredTimesheets = useMemo(() => {
    return timesheets.filter(ts => {
      // Role-based visibility
      if (user?.role === 'CountryDirector') {
        const emp = employees.find(e => e.employeeId === ts.employeeId || e.id === ts.employeeId);
        const cdId = user.cdId;
        const isMapped = emp?.mappedCountryDirectorIds.includes(cdId!) || emp?.primaryCountryDirectorId === cdId;
        if (!isMapped) return false;
      }

      if (user?.role === 'ProjectManager') {
        const managedProjects = projects.filter(p => 
          p.managerId === user.id || p.managerId === user.employeeId || p.managerName === user.name
        );
        const managedProjectIds = new Set(managedProjects.map(p => p.id));
        
        const hasManagedProject = ts.entries.some(entry => {
          if (entry.workType !== 'Project Work' || !entry.projectId) return false;
          return managedProjectIds.has(entry.projectId);
        });
        if (!hasManagedProject) return false;
      }
      
      const matchesSearch = ts.employeeName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesProject = !projectQuery || ts.entries.some(entry => 
        (entry.projectName || entry.clientName || '').toLowerCase().includes(projectQuery.toLowerCase())
      );
      const matchesWeek = weekFilter === 'All Weeks' || ts.weekEnding === weekFilter;
      const matchesStatus = statusFilter === 'All' || ts.status === statusFilter;
      return matchesSearch && matchesProject && matchesWeek && matchesStatus;
    });
  }, [timesheets, employees, projects, searchQuery, projectQuery, weekFilter, statusFilter, user]);

  const selectedTimesheet = timesheets.find(t => `${t.employeeId}:${t.weekEnding}` === selectedId);
  const weekOptions = Array.from(new Set(timesheets.map(t => t.weekEnding))).sort().reverse();
  const submittedFilteredTimesheets = filteredTimesheets.filter(ts => ts.status === 'Submitted');

  const refreshTimesheets = async () => {
    const tsData = await timesheetService.getAll();
    setTimesheets(tsData);
  };

  const handleApprove = async (ts: TimesheetSummary) => {
    await timesheetService.approve(
      ts.id || `${ts.employeeId}:${ts.weekEnding}`,
      undefined
    );
    await refreshTimesheets();
    setActionNotice(`Approved ${ts.employeeName}'s timesheet for ${ts.weekEnding}.`);
    if (selectedId === `${ts.employeeId}:${ts.weekEnding}`) setSelectedId(null);
  };

  const openRejectModal = (ts: TimesheetSummary) => {
    setRejectionTarget(ts);
    setRejectionReason(ts.rejectionReason || ts.rejectionNote || '');
    setRejectionError('');
  };

  const closeRejectModal = () => {
    setRejectionTarget(null);
    setRejectionReason('');
    setRejectionError('');
  };

  const confirmReject = async () => {
    if (!rejectionTarget) return;
    const remark = rejectionReason.trim();
    if (!remark) {
      setRejectionError('A rejection reason is required before sending this timesheet back.');
      return;
    }
    await timesheetService.reject(rejectionTarget.id || `${rejectionTarget.employeeId}:${rejectionTarget.weekEnding}`, remark);
    await refreshTimesheets();
    setActionNotice(`Rejected ${rejectionTarget.employeeName}'s timesheet for ${rejectionTarget.weekEnding}.`);
    if (selectedId === `${rejectionTarget.employeeId}:${rejectionTarget.weekEnding}`) setSelectedId(null);
    closeRejectModal();
  };

  const handleBulkApprove = async () => {
    if (!submittedFilteredTimesheets.length) {
      setActionNotice('No submitted timesheets are available in the current filter scope.');
      return;
    }
    await Promise.all(
      submittedFilteredTimesheets.map(ts =>
        timesheetService.approve(ts.id || `${ts.employeeId}:${ts.weekEnding}`)
      )
    );
    await refreshTimesheets();
    setSelectedId(null);
    setActionNotice(`Bulk approved ${submittedFilteredTimesheets.length} timesheets.`);
  };

  const handleExport = () => {
    const rows = filteredTimesheets.flatMap(ts => ts.entries.map(entry => ({
      Employee: ts.employeeName,
      EmployeeId: ts.employeeId,
      WeekEnding: ts.weekEnding,
      Status: ts.status,
      ProjectOrClient: entry.projectName || entry.clientName || '',
      WorkType: entry.workType,
      Category: entry.category || '',
      Date: entry.date,
      Hours: entry.hours,
      Remark: entry.remark || '',
      ApprovedBy: ts.approvedBy || '',
      RejectedBy: ts.rejectedBy || '',
      RejectionReason: ts.rejectionReason || ts.rejectionNote || '',
    })));
    const fallback = {
      Employee: '',
      EmployeeId: '',
      WeekEnding: '',
      Status: '',
      ProjectOrClient: '',
      WorkType: '',
      Category: '',
      Date: '',
      Hours: '',
      Remark: '',
      ApprovedBy: '',
      RejectedBy: '',
      RejectionReason: '',
    };
    const headers = Object.keys(rows[0] || fallback);
    const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const csv = [headers.join(','), ...rows.map(row => headers.map(header => escape(row[header as keyof typeof row])).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `timesheet-approval-export-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setActionNotice(`Exported ${rows.length} timesheet entr${rows.length === 1 ? 'y' : 'ies'} from the current filter scope.`);
  };

  if (loading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <Clock className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  const roleTitle = user?.role === 'Admin' ? 'Timesheet Governance' : 'Timesheet Approval Desk';
  const roleSubtitle = user?.role === 'CountryDirector' 
    ? 'Reviewing timesheets for resources mapped to your region/projects.' 
    : user?.role === 'Admin' 
      ? 'Full oversight of practice-wide effort compliance and audit trail.'
      : 'Review and approve consultant contributions for the current period.';

  return (
    <div className="animate-in fade-in duration-500 pb-12 relative">
      <PageHeader 
        title={roleTitle}
        subtitle={roleSubtitle}
        breadcrumb={['Operations', 'Allocations & Timesheets']}
        actions={
          <div className="flex items-center gap-3">
             <button
                onClick={handleExport}
                className="btn-secondary py-2.5 px-5 flex items-center gap-2"
             >
                <Download size={14} /> Ops Export
             </button>
             {user?.role === 'Admin' && (
               <button
                  onClick={handleBulkApprove}
                  className="btn-primary py-2.5 px-5 flex items-center gap-2 shadow-lg shadow-primary/20"
               >
                  <CheckCircle2 size={14} /> Bulk Approve
               </button>
             )}
          </div>
        }
      />

      {actionNotice && (
        <div className="mt-4 flex items-start justify-between gap-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-800 shadow-sm">
          <span>{actionNotice}</span>
          <button onClick={() => setActionNotice('')} className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 hover:text-emerald-950">
            Dismiss
          </button>
        </div>
      )}

      <div className="mt-8 flex flex-col lg:flex-row gap-8">
        {/* Main List */}
        <div className="flex-1 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-border-light shadow-sm">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input 
                type="text" 
                placeholder="Search by consultant name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Project or client..."
                value={projectQuery}
                onChange={(e) => setProjectQuery(e.target.value)}
                className="bg-white border border-border-light rounded-xl px-4 py-2.5 text-xs font-bold text-heading outline-none focus:ring-2 focus:ring-primary/20"
              />
              <select 
                value={weekFilter}
                onChange={(e) => setWeekFilter(e.target.value)}
                className="bg-white border border-border-light rounded-xl px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-heading outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="All Weeks">All Weeks</option>
                {weekOptions.map(week => <option key={week} value={week}>{week}</option>)}
              </select>
              <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-white border border-border-light rounded-xl px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-heading outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="All">All Statuses</option>
                <option value="Submitted">Pending Review</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Flagged</option>
              </select>
            </div>
          </div>

          <div className="bg-white border border-border-light rounded-3xl overflow-hidden shadow-sm">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-border-light">
                <tr>
                  <th className="py-5 px-8 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Consultant</th>
                  <th className="py-5 px-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Week Ending</th>
                  <th className="py-5 px-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Hours</th>
                  <th className="py-5 px-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</th>
                  <th className="py-5 px-8 text-[10px] font-bold text-right uppercase tracking-widest">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light">
                {filteredTimesheets.map((ts) => (
                  <tr 
                    key={`${ts.employeeId}:${ts.weekEnding}`} 
                    className={cn(
                      "hover:bg-slate-50/50 transition-colors cursor-pointer group",
                      selectedId === `${ts.employeeId}:${ts.weekEnding}` && "bg-orange-50/30"
                    )}
                    onClick={() => {
                      const key = `${ts.employeeId}:${ts.weekEnding}`;
                      setSelectedId(selectedId === key ? null : key);
                    }}
                  >
                    <td className="py-5 px-8">
                       <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center font-bold text-xs text-primary">
                             {ts.employeeName.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-heading group-hover:text-primary transition-colors">{ts.employeeName}</p>
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Practice Unit</p>
                          </div>
                       </div>
                    </td>
                    <td className="py-5 px-6">
                      <p className="text-xs font-mono font-medium text-body">{ts.weekEnding}</p>
                    </td>
                    <td className="py-5 px-6 text-center">
                      <div className="flex flex-col items-center">
                        <span className="text-sm font-bold text-heading">{formatHours(ts.totalHours)}</span>
                        <span className="text-[10px] text-success font-bold">{formatHours(ts.billableHours)} Billable</span>
                      </div>
                    </td>
                    <td className="py-5 px-6">
                      <Badge variant={ts.status === 'Submitted' ? 'neutral' : ts.status === 'Approved' ? 'success' : 'danger'}>
                        {ts.status === 'Submitted' ? 'Pending Approval' : ts.status}
                      </Badge>
                    </td>
                    <td className="py-5 px-8 text-right">
                       <button className="p-2 text-gray-300 group-hover:text-primary hover:bg-orange-50 rounded-lg transition-all">
                          <ChevronRight size={18} />
                       </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Review Panel */}
        <AnimatePresence>
          {selectedId && selectedTimesheet && (
            <motion.div 
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 50 }}
              className="w-full lg:w-[450px] bg-white border border-border-light rounded-3xl shadow-2xl p-8 sticky top-24 self-start h-[calc(100vh-160px)] flex flex-col"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-lg font-bold text-heading">Submission Audit</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Country Director Review</p>
                </div>
                <button 
                  onClick={() => setSelectedId(null)}
                  className="p-2 hover:bg-slate-50 rounded-xl transition-colors text-gray-400"
                >
                  <ArrowUpRight size={18} />
                </button>
              </div>

              <div className="space-y-8 overflow-y-auto pr-2 flex-1">
                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-border-light">
                   <div className="w-12 h-12 rounded-xl bg-white border border-border-light flex items-center justify-center font-bold text-primary shadow-sm text-lg">
                      {selectedTimesheet.employeeName.split(' ').map(n => n[0]).join('')}
                   </div>
                   <div>
                     <h4 className="font-bold text-heading">{selectedTimesheet.employeeName}</h4>
                     <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Period: {selectedTimesheet.weekEnding}</p>
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl border border-gray-100 space-y-1">
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Planned Capacity</p>
                    <p className="text-xl font-bold text-heading">40.0h</p>
                  </div>
                  <div className="p-4 rounded-2xl border border-gray-100 space-y-1">
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Logged Effort</p>
                    <p className="text-xl font-bold text-primary">{formatHours(selectedTimesheet.totalHours)}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <Layers size={14} /> Effort Breakdown
                  </h5>
                  <div className="space-y-3">
                    {selectedTimesheet.entries.map((entry, idx) => (
                      <div key={idx} className="p-4 border border-slate-50 rounded-xl hover:border-border-light transition-all">
                        <div className="flex justify-between items-start mb-2">
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-heading truncate">
                                {entry.workType === 'Project Work' ? entry.projectName : (entry as any).clientName || entry.workType}
                            </p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">
                              {entry.workType} {entry.category && `• ${entry.category}`}
                            </p>
                          </div>
                          <span className="text-xs font-bold text-primary tabular-nums">{formatHours(entry.hours)}</span>
                        </div>
                        {entry.remark && (
                          <div className="mt-2 bg-slate-50 p-3 rounded-lg border border-slate-100 italic">
                             <p className="text-[10px] text-slate-600 leading-relaxed font-medium">"{entry.remark}"</p>
                          </div>
                        )}
                        <div className="mt-3 pt-3 border-t border-slate-50 flex items-center justify-between">
                           <Badge variant="success" className="text-[9px] py-0.5">
                              Client Effort
                           </Badge>
                           <span className="text-[9px] text-gray-400 font-mono italic">{entry.date}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-8 border-t border-gray-100 mt-auto grid grid-cols-2 gap-4">
                <button 
                  onClick={() => openRejectModal(selectedTimesheet)}
                  className="btn-secondary py-3 flex items-center justify-center gap-2 text-danger hover:bg-red-50 hover:border-red-100"
                >
                  <XCircle size={16} /> Flag Review
                </button>
                <button 
                  onClick={() => handleApprove(selectedTimesheet)}
                  className="btn-primary py-3 flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
                >
                  <CheckCircle2 size={16} /> Approve
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {!selectedId && (
        <div className="mt-12 bg-slate-dark text-white rounded-2xl p-8 flex items-center gap-6 shadow-xl relative overflow-hidden">
           <div className="absolute top-0 right-0 p-4 opacity-5">
              <ShieldCheck size={120} />
           </div>
           <div className="p-4 bg-primary text-white rounded-2xl shadow-lg relative z-10">
              <Info size={24} />
           </div>
           <div className="relative z-10">
             <h4 className="text-lg font-bold text-white">Director Approval Governance</h4>
             <p className="text-sm text-white/60 mt-1 leading-relaxed max-w-2xl font-medium">
               Country Directors must review project hours and client miscellaneous tasks. Actual utilization calculations 
               are strictly derived from these approved client efforts. Internal company activities are not tracked in this module.
             </p>
           </div>
        </div>
      )}

      <AnimatePresence>
        {rejectionTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-6 backdrop-blur-sm"
            onClick={closeRejectModal}
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.98 }}
              className="w-full max-w-xl rounded-3xl border border-border-light bg-white p-7 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start gap-4">
                <div className="rounded-2xl bg-red-50 p-3 text-danger">
                  <AlertTriangle size={22} />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400">Send Back For Correction</p>
                  <h3 className="mt-1 text-xl font-bold text-heading">{rejectionTarget.employeeName}</h3>
                  <p className="mt-1 text-sm font-medium text-body">Week ending {rejectionTarget.weekEnding}. The employee will see this reason when correcting the timesheet.</p>
                </div>
              </div>

              <label className="mt-6 block text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Rejection reason
              </label>
              <textarea
                value={rejectionReason}
                onChange={(event) => {
                  setRejectionReason(event.target.value);
                  setRejectionError('');
                }}
                rows={5}
                autoFocus
                className="mt-2 w-full resize-none rounded-2xl border border-border-light bg-slate-50 p-4 text-sm font-medium text-heading outline-none transition-all focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10"
                placeholder="Example: Please split the client workshop hours by project and add remarks for the client misc task."
              />
              {rejectionError && (
                <p className="mt-2 text-xs font-semibold text-danger">{rejectionError}</p>
              )}

              <div className="mt-7 flex items-center justify-end gap-3">
                <button onClick={closeRejectModal} className="btn-secondary px-5 py-3">
                  Cancel
                </button>
                <button onClick={confirmReject} className="btn-primary px-5 py-3 shadow-lg shadow-primary/20">
                  Send Back
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
