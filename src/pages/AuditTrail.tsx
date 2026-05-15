import { useState, useMemo, useEffect } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { Badge } from '../components/ui/Badge';
import { 
  Search, 
  Filter, 
  Download, 
  History, 
  ShieldCheck, 
  User, 
  Calendar,
  ExternalLink,
  MoreVertical,
  ChevronRight,
  Eye,
  FileText
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { adminService } from '../services/api';
import { AuditLog } from '../types';
import { downloadCsv } from '../lib/csv';
import { NoticeBanner } from '../components/ui/NoticeBanner';
import { Link } from 'react-router-dom';

const renderAuditValue = (value: unknown, fallback: string) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const formatLog = (log: AuditLog) => ({
  id: log.id,
  rawTimestamp: log.timestamp,
  timestamp: new Date(log.timestamp).toLocaleString('en-GB', { hour12: false }),
  user: log.userName,
  role: log.userRole,
  module: log.module,
  action: log.action,
  target: log.entityId || log.details,
  oldVal: renderAuditValue(log.oldValue, 'N/A'),
  newVal: renderAuditValue(log.newValue, log.action),
  status: 'Success',
  details: log.reason || log.details
});

export const AuditTrail = () => {
  const [auditLogs, setAuditLogs] = useState<ReturnType<typeof formatLog>[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLog, setSelectedLog] = useState<ReturnType<typeof formatLog> | null>(null);
  const [moduleFilter, setModuleFilter] = useState('All Modules');
  const [todayOnly, setTodayOnly] = useState(false);
  const [criticalOnly, setCriticalOnly] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    adminService.getAuditLogs().then(logs => setAuditLogs(logs.map(formatLog)));
  }, []);

  const exportLogs = () => {
    downloadCsv(`audit-logs-${new Date().toISOString().split('T')[0]}.csv`, filteredLogs.map(log => ({
      timestamp: log.timestamp,
      user: log.user,
      role: log.role,
      module: log.module,
      action: log.action,
      target: log.target,
      oldValue: log.oldVal,
      newValue: log.newVal,
      details: log.details,
    })));
    adminService.logAction('Export', 'Audit Trail', `Exported ${filteredLogs.length} filtered audit log rows`).then(() => {});
    setNotice(`Exported ${filteredLogs.length} audit rows from the current filter scope.`);
  };

  const filteredLogs = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const criticalActions = new Set(['Create', 'Update', 'Delete', 'Close', 'Reset', 'Approve', 'Reject']);
    return auditLogs.filter(log => {
      const matchesSearch = log.user.toLowerCase().includes(searchQuery.toLowerCase()) || 
                             log.target.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesModule = moduleFilter === 'All Modules' || log.module === moduleFilter;
      const matchesDate = !todayOnly || log.rawTimestamp.startsWith(today);
      const matchesCritical = !criticalOnly || criticalActions.has(log.action);
      return matchesSearch && matchesModule && matchesDate && matchesCritical;
    });
  }, [auditLogs, searchQuery, moduleFilter, todayOnly, criticalOnly]);

  const modules = useMemo(() => ['All Modules', ...Array.from(new Set(auditLogs.map(log => log.module))).sort()], [auditLogs]);

  const getEntityPath = (log: ReturnType<typeof formatLog>) => {
    if (!log.target || log.target.includes(' ')) return '';
    if (log.module.toLowerCase().includes('employee')) return `/employees/${log.target}`;
    if (log.module.toLowerCase().includes('project')) return `/projects/${log.target}`;
    if (log.module.toLowerCase().includes('allocation')) return `/allocations?allocationId=${log.target}`;
    return '';
  };

  const exportSelectedLog = () => {
    if (!selectedLog) return;
    downloadCsv(`audit-log-${selectedLog.id}.csv`, [{
      timestamp: selectedLog.timestamp,
      user: selectedLog.user,
      role: selectedLog.role,
      module: selectedLog.module,
      action: selectedLog.action,
      target: selectedLog.target,
      oldValue: selectedLog.oldVal,
      newValue: selectedLog.newVal,
      details: selectedLog.details,
    }]);
    adminService.logAction('Export', 'Audit Trail', `Exported single audit entry ${selectedLog.id}`).then(() => {});
    setNotice(`Exported audit entry ${selectedLog.id}.`);
  };

  return (
    <div className="animate-in fade-in duration-500 pb-12 relative h-full">
      <PageHeader 
        title="Audit Trail" 
        subtitle="End-to-end operational traceability for enterprise data integrity."
        breadcrumb={['System', 'Traceability']}
        actions={
           <button onClick={exportLogs} className="btn-secondary py-2.5 px-6 flex items-center gap-2 shadow-sm uppercase tracking-widest text-[10px] font-bold">
              <Download size={14} /> Export Logs
           </button>
        }
      />

      {/* Filter Section */}
      <div className="bg-white border border-border-light rounded-2xl p-6 mb-8 flex flex-wrap items-center gap-4 shadow-sm">
         <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <input 
              type="text" 
              placeholder="Filter by user or target action..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-100 rounded-xl py-2.5 pl-10 pr-4 text-xs font-bold outline-none focus:border-primary transition-all shadow-inner"
            />
         </div>
         <div className="flex items-center gap-3">
             <select 
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value)}
              className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:border-primary shadow-sm"
            >
               {modules.map(module => <option key={module}>{module}</option>)}
            </select>
             <button
                onClick={() => setTodayOnly(value => !value)}
                className={cn(
                  "p-2.5 border rounded-xl text-heading transition-colors",
                  todayOnly ? "bg-orange-50 border-primary/20 text-primary" : "bg-slate-50 hover:bg-slate-100 border-slate-100"
                )}
                title="Toggle today's audit events"
             >
                <Calendar size={16} />
             </button>
             <button
                onClick={() => setCriticalOnly(value => !value)}
                className={cn(
                  "p-2.5 border rounded-xl text-heading transition-colors",
                  criticalOnly ? "bg-orange-50 border-primary/20 text-primary" : "bg-slate-50 hover:bg-slate-100 border-slate-100"
                )}
                title="Toggle critical governance events"
             >
                <ShieldCheck size={16} />
             </button>
          </div>
       </div>

      {notice && (
        <NoticeBanner
          type="success"
          title="Audit Trail"
          message={notice}
          onClose={() => setNotice('')}
          className="mb-8"
        />
      )}

      {/* Audit Table */}
      <div className="bg-white border border-border-light rounded-3xl overflow-hidden shadow-sm">
         <div className="table-container">
            <table className="w-full text-left">
               <thead className="bg-slate-50/50 border-b border-border-light">
                  <tr>
                     <th className="py-4 px-8 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Event Timeline</th>
                     <th className="py-4 px-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Operational Lead</th>
                     <th className="py-4 px-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Scope</th>
                     <th className="py-4 px-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Action Details</th>
                     <th className="py-4 px-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</th>
                     <th className="py-4 px-8"></th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-border-light">
                  {filteredLogs.map(log => (
                    <tr 
                      key={log.id} 
                      onClick={() => setSelectedLog(log)}
                      className={cn(
                        "hover:bg-slate-50/50 transition-all group cursor-pointer",
                        selectedLog?.id === log.id && "bg-orange-50/30"
                      )}
                    >
                       <td className="py-5 px-8">
                             <p className="text-xs font-bold text-heading">{log.timestamp.split(' ')[0]}</p>
                          <p className="text-[10px] font-bold text-gray-400 uppercase mt-1">{log.timestamp.split(' ')[1] || ''}</p>
                       </td>
                       <td className="py-5 px-6">
                          <div className="flex items-center gap-3">
                             <div className="w-8 h-8 rounded-lg bg-slate-dark flex items-center justify-center text-white text-[10px] font-bold shadow-md">
                                {log.user.split(' ').map(n => n[0]).join('')}
                             </div>
                             <div>
                                <p className="text-xs font-bold text-heading">{log.user}</p>
                                <p className="text-[9px] font-bold text-gray-400 uppercase">{log.role}</p>
                             </div>
                          </div>
                       </td>
                       <td className="py-5 px-6">
                          <Badge variant="neutral" className="bg-slate-100 text-slate- dark border-slate-200 text-[10px]">{log.module}</Badge>
                       </td>
                       <td className="py-5 px-6">
                          <p className="text-xs font-bold text-heading">
                            <span className={cn(
                              "mr-1.5",
                              log.action === 'Modified' ? "text-primary" : 
                              log.action === 'Deleted' ? "text-danger" : "text-success"
                            )}>{log.action}:</span>
                            {log.target}
                          </p>
                       </td>
                       <td className="py-5 px-6">
                          <div className="flex items-center gap-2">
                             <div className={cn(
                               "w-1.5 h-1.5 rounded-full",
                               log.status === 'Success' ? "bg-success shadow-[0_0_8px_rgba(34,197,94,0.4)]" : "bg-warning shadow-[0_0_8px_rgba(234,179,8,0.4)]"
                             )} />
                             <span className="text-xs font-bold text-heading">{log.status}</span>
                          </div>
                       </td>
                       <td className="py-5 px-8 text-right">
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedLog(log);
                            }}
                            className="p-2 text-gray-300 hover:text-primary transition-colors"
                          >
                             <ChevronRight size={18} />
                          </button>
                       </td>
                    </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>

      {/* Detail Panel Placeholder (Simplified for prompt context) */}
      <AnimatePresence>
        {selectedLog && (
          <>
            <motion.div 
               initial={{ opacity: 0 }} 
               animate={{ opacity: 1 }} 
               exit={{ opacity: 0 }}
               onClick={() => setSelectedLog(null)}
               className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-30" 
            />
            <motion.div 
              initial={{ x: '100%' }} 
              animate={{ x: 0 }} 
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 h-full w-[400px] bg-white shadow-2xl z-40 border-l border-border-light flex flex-col"
            >
               <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-dark text-white">
                  <div>
                    <h3 className="text-lg font-bold tracking-tight">Governance Review</h3>
                    <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest mt-1">Audit Entry #{selectedLog.id}</p>
                  </div>
                  <button 
                    onClick={() => setSelectedLog(null)}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <ChevronRight size={20} />
                  </button>
               </div>

               <div className="flex-1 overflow-y-auto p-8 space-y-8">
                  <section>
                     <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Origin & Identity</h4>
                     <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-4">
                         <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-white font-bold shadow-lg shadow-primary/20">
                            {selectedLog.user.split(' ').map(n => n[0]).join('')}
                         </div>
                         <div>
                            <p className="text-sm font-bold text-heading">{selectedLog.user}</p>
                            <p className="text-xs text-body/60 font-medium">{selectedLog.role}</p>
                            <div className="flex items-center gap-2 mt-2">
                               <Badge variant="neutral" className="text-[9px] font-mono">{selectedLog.timestamp}</Badge>
                            </div>
                         </div>
                     </div>
                  </section>

                  <section>
                     <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Functional Context</h4>
                     <div className="space-y-4">
                        <div className="flex justify-between p-1">
                           <span className="text-xs font-medium text-body/60">System Module</span>
                           <span className="text-xs font-bold text-heading">{selectedLog.module}</span>
                        </div>
                        <div className="flex justify-between p-1">
                           <span className="text-xs font-medium text-body/60">Action Type</span>
                           <Badge variant={selectedLog.action === 'Modified' ? 'warning' : 'neutral'}>{selectedLog.action}</Badge>
                        </div>
                        <div className="flex justify-between p-1">
                           <span className="text-xs font-medium text-body/60">Target Entity</span>
                           <div className="text-right">
                              <p className="text-xs font-bold text-heading">{selectedLog.target}</p>
                           </div>
                        </div>
                     </div>
                  </section>

                  <section>
                     <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Structural Change</h4>
                     <div className="grid grid-cols-1 gap-3">
                        <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl relative overflow-hidden group hover:border-primary/20 transition-colors">
                           <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Old Matrix Value</p>
                           <p className="text-sm font-bold text-heading mt-1">{selectedLog.oldVal}</p>
                        </div>
                        <div className="p-4 bg-orange-50 border border-primary/10 rounded-xl relative overflow-hidden group border-dashed hover:border-primary/40 transition-colors">
                           <p className="text-[9px] font-bold text-primary uppercase tracking-widest">New Committed Value</p>
                           <p className="text-sm font-bold text-heading mt-1">{selectedLog.newVal}</p>
                        </div>
                     </div>
                  </section>

                  <section>
                      <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 text-center border-t border-slate-50 pt-8">Event Narrative</h4>
                      <div className="p-5 bg-slate-50/50 italic border border-slate-100 rounded-2xl text-xs text-body/80 leading-relaxed font-medium">
                         "{selectedLog.details}"
                      </div>
                  </section>
               </div>

               <div className="p-8 border-t border-slate-50 bg-slate-50/30 grid grid-cols-2 gap-4">
                  <button
                    onClick={exportSelectedLog}
                    className="py-3 bg-white border border-slate-200 rounded-xl text-[10px] font-bold uppercase tracking-widest text-heading hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
                  >
                      <FileText size={14} /> Report
                  </button>
                  {getEntityPath(selectedLog) ? (
                    <Link
                      to={getEntityPath(selectedLog)}
                      className="py-3 bg-slate-dark text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-black transition-colors flex items-center justify-center gap-2"
                    >
                       <ExternalLink size={14} /> Open Entity
                    </Link>
                  ) : (
                    <button
                      onClick={() => setNotice('This audit entry does not contain a direct entity route.')}
                      className="py-3 bg-slate-dark text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-black transition-colors flex items-center justify-center gap-2"
                    >
                       <ExternalLink size={14} /> Open Entity
                    </button>
                  )}
               </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
