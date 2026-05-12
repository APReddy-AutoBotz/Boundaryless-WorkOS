import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { employeeService, allocationService, adminService, timesheetService, projectService } from '../services/api';
import { Employee, Allocation, CountryDirector, TimesheetSummary, Project } from '../types';
import { 
  Building2, 
  Mail, 
  MapPin, 
  Briefcase, 
  Target, 
  Calendar, 
  User, 
  Clock, 
  CheckCircle2, 
  ExternalLink,
  ChevronRight,
  Edit2,
  Plus,
  FileText,
  Loader2,
  ArrowLeft,
  KeyRound,
  X
} from 'lucide-react';
import { cn } from '../lib/utils';
import { EmployeeForm } from '../components/forms/EmployeeForm';
import { isUtilizationEligibleEmployee } from '../services/calculations';
import { authService } from '../services/authService';
import {
  canAccessEmployeeDetail,
  canEditEmployeeData,
  canManageAllocations,
  canOpenImportExport,
  canOpenTimesheetApproval,
  canResetEmployeePassword,
} from '../services/accessControl';

export const EmployeeDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [timesheets, setTimesheets] = useState<TimesheetSummary[]>([]);
  const [cds, setCds] = useState<CountryDirector[]>([]);
  const [isEmployeeFormOpen, setIsEmployeeFormOpen] = useState(false);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [customPassword, setCustomPassword] = useState('');
  const [resetNotice, setResetNotice] = useState<{ type: 'success' | 'danger'; message: string; temporaryPassword?: string } | null>(null);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const currentUser = authService.getCurrentUser();

  const fetchEmployeeData = async () => {
    if (!id) return;
    try {
      const [empData, allAllocations, tsAll, cdData] = await Promise.all([
        employeeService.getById(id),
        allocationService.getAll(),
        timesheetService.getAll(),
        adminService.getCountryDirectors(),
      ]);
      const projectData = await projectService.getAll();
      const alcData = allAllocations.filter(a => a.employeeId === id);
      const tsData = tsAll.filter(t => t.employeeId === id);
      setEmployee(empData ?? null);
      setAllocations(alcData);
      setProjects(projectData);
      setTimesheets(tsData);
      setCds(cdData);
    } catch (error) {
      console.error('Failed to fetch employee details', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployeeData();
  }, [id]);

  if (loading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={40} />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="text-center py-20">
        <div className="text-gray-400 mb-4">
          <User size={48} className="mx-auto opacity-20" />
        </div>
        <h2 className="text-xl font-bold text-heading">Employee Not Found</h2>
        <p className="text-sm text-body/60 mt-2 mb-8">The consultant you are looking for does not exist in our database.</p>
        <Link to="/employees" className="btn-primary py-2 px-6">Back to Employee Master</Link>
      </div>
    );
  }

  if (!canAccessEmployeeDetail({ user: currentUser, employeeId: employee.id, employees: [employee], allocations, projects })) {
    return (
      <div className="text-center py-20">
        <div className="text-gray-400 mb-4">
          <User size={48} className="mx-auto opacity-20" />
        </div>
        <h2 className="text-xl font-bold text-heading">Employee Not Found</h2>
        <p className="text-sm text-body/60 mt-2 mb-8">The consultant you are looking for is not available in your workspace scope.</p>
        <Link to="/" className="btn-primary py-2 px-6">Back to Dashboard</Link>
      </div>
    );
  }

  const getCDName = (cdId: string) => cds.find(c => c.id === cdId)?.name || cdId;
  const canEditEmployee = canEditEmployeeData(currentUser);
  const canResetPassword = canResetEmployeePassword(currentUser);
  const canUseImportExport = canOpenImportExport(currentUser);
  const canUseAllocationControl = canManageAllocations(currentUser);
  const canUseTimesheetApproval = canOpenTimesheetApproval(currentUser);
  const utilizationEligible = isUtilizationEligibleEmployee(employee, allocations);
  const submittedTimesheets = timesheets.filter(timesheet => timesheet.status !== 'Draft');
  const approvedTimesheets = timesheets.filter(timesheet => timesheet.status === 'Approved');
  const pendingTimesheets = timesheets.filter(timesheet => timesheet.status === 'Submitted');
  const rejectedTimesheets = timesheets.filter(timesheet => timesheet.status === 'Rejected');
  const complianceRate = timesheets.length > 0 ? Math.round((submittedTimesheets.length / timesheets.length) * 100) : 0;
  const approvedBillableHours = approvedTimesheets.reduce((sum, timesheet) => sum + timesheet.billableHours, 0);
  const approvedInternalHours = approvedTimesheets.reduce((sum, timesheet) => sum + (timesheet.totalHours - timesheet.billableHours), 0);
  const timesheetHeadline = rejectedTimesheets.length > 0
    ? 'Correction Required'
    : pendingTimesheets.length > 0
      ? 'Pending Approval'
      : approvedTimesheets.length > 0
        ? 'Approved Logs Current'
        : 'No Timesheets Yet';
  const timesheetSubtitle = timesheets.length > 0
    ? `${submittedTimesheets.length} of ${timesheets.length} recorded weeks submitted or reviewed.`
    : 'No weekly timesheets have been recorded for this consultant.';

  const handlePasswordReset = async () => {
    setIsResettingPassword(true);
    const result = await adminService.resetUserPassword(employee.employeeId, customPassword.trim() || undefined);
    setIsResettingPassword(false);
    if (!result) {
      setResetNotice({ type: 'danger', message: 'Password reset failed. Confirm the employee has a linked active user account.' });
      return;
    }
    setResetNotice({
      type: 'success',
      message: result.temporaryPassword
        ? 'Temporary password generated. Share it securely and ask the user to change it on next login.'
        : 'Password reset successfully. The user will be asked to change it.',
      temporaryPassword: result.temporaryPassword,
    });
    setCustomPassword('');
  };

  const allocationHistory = (() => {
    const now = new Date();
    return Array.from({ length: 12 }, (_, index) => {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - (11 - index), 1);
      const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
      const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
      const value = allocations
        .filter(allocation => {
          const start = new Date(allocation.startDate);
          const end = new Date(allocation.endDate);
          return start <= monthEnd && end >= monthStart;
        })
        .reduce((sum, allocation) => sum + allocation.percentage, 0);

      return {
        label: monthDate.toLocaleDateString('en-GB', { month: 'short' }).charAt(0),
        value,
      };
    });
  })();
  const maxAllocationHistory = Math.max(100, ...allocationHistory.map(month => month.value));

  return (
    <div className="animate-in fade-in duration-500 pb-20">
      {isEmployeeFormOpen && (
        <div className="fixed inset-0 bg-slate-dark/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl animate-in zoom-in-95 duration-200">
            <EmployeeForm
              employee={employee}
              onClose={() => setIsEmployeeFormOpen(false)}
              onSave={fetchEmployeeData}
            />
          </div>
        </div>
      )}

      {isResetPasswordOpen && (
        <div className="fixed inset-0 bg-slate-dark/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md overflow-hidden rounded-3xl border border-border-light bg-white shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-primary">
                  <KeyRound size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-heading">Reset Password</h3>
                  <p className="mt-2 text-xs font-medium leading-relaxed text-slate-500">Reset login access for {employee.name}. Leave the field blank to generate a temporary password.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsResetPasswordOpen(false)}
                className="rounded-xl p-2 text-slate-300 transition-colors hover:bg-slate-50 hover:text-heading"
                aria-label="Close reset password"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4 p-6">
              {resetNotice && (
                <div className={cn(
                  'rounded-2xl border px-4 py-3 text-xs font-bold',
                  resetNotice.type === 'success' ? 'border-green-100 bg-green-50 text-green-800' : 'border-red-100 bg-red-50 text-red-800'
                )}>
                  <p>{resetNotice.message}</p>
                  {resetNotice.temporaryPassword && (
                    <div className="mt-3 rounded-xl border border-green-200 bg-white px-3 py-2 font-mono text-sm text-heading">
                      {resetNotice.temporaryPassword}
                    </div>
                  )}
                </div>
              )}
              <label className="block">
                <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">Custom Password Optional</span>
                <input
                  type="text"
                  value={customPassword}
                  onChange={(event) => setCustomPassword(event.target.value)}
                  placeholder="Leave blank to generate"
                  className="w-full rounded-xl border border-border-light px-4 py-3 text-sm font-medium text-heading outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10"
                  autoComplete="off"
                />
              </label>
              <p className="text-[10px] font-medium leading-relaxed text-slate-500">
                Reset marks the account for password change. Share generated credentials only through an approved internal channel.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 bg-slate-50 px-6 py-4">
              <button
                type="button"
                onClick={() => setIsResetPasswordOpen(false)}
                className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-heading transition-colors hover:bg-slate-100"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handlePasswordReset}
                disabled={isResettingPassword}
                className="rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-orange-200 transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isResettingPassword ? 'Resetting...' : 'Reset Password'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-6">
        <Link to="/employees" className="flex items-center gap-2 text-xs font-bold text-primary hover:underline group">
           <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" /> Back to Directory
        </Link>
      </div>

      <PageHeader 
        title={employee.name}
        subtitle={`${employee.designation} • ${employee.department} • ${employee.country}`}
        breadcrumb={['Operations', 'Employee Master', employee.name]}
        actions={
          <div className="flex items-center gap-3">
             {canUseImportExport && (
             <Link to="/import-export" className="btn-secondary py-2 px-4 flex items-center gap-2">
                <FileText size={14} /> Export Profile
             </Link>
             )}
             {canEditEmployee && (
             <button onClick={() => setIsEmployeeFormOpen(true)} className="btn-primary py-2 px-4 flex items-center gap-2">
                <Edit2 size={14} /> Edit Consultant
             </button>
             )}
             {canResetPassword && (
               <button
                 onClick={() => {
                   setResetNotice(null);
                   setCustomPassword('');
                   setIsResetPasswordOpen(true);
                 }}
                 className="btn-secondary py-2 px-4 flex items-center gap-2"
               >
                 <KeyRound size={14} /> Reset Password
               </button>
             )}
          </div>
        }
      />

      {/* ── Employee 360 View ────────────────────────────────────────── */}
      {(() => {
        const plannedUtil = employee.plannedUtilization;
        const actualUtil = employee.actualUtilization;

        // Status
        const isOverloaded = plannedUtil > 100;
        const isUnder = plannedUtil > 0 && plannedUtil < 60;
        const isBench = plannedUtil === 0;
        const statusLabel = !utilizationEligible ? 'Not in Utilization' : isOverloaded ? 'Overloaded' : isBench ? 'Bench' : isUnder ? 'Underutilized' : 'Balanced';
        const statusBg = !utilizationEligible ? 'bg-slate-100 border-slate-200 text-slate-500'
          : isOverloaded ? 'bg-danger-bg border-danger/20 text-danger'
          : isBench ? 'bg-gray-100 border-gray-200 text-gray-400'
          : isUnder ? 'bg-warning-bg border-warning/20 text-warning'
          : 'bg-success-bg border-success/20 text-success';
        const ringColor = !utilizationEligible ? '#CBD5E1' : isOverloaded ? '#EF4444' : isBench ? '#9CA3AF' : isUnder ? '#D97706' : '#059669';

        // Timesheet health
        const totalTs = timesheets.length;
        const approvedTs = timesheets.filter(t => t.status === 'Approved').length;
        const submittedTs = timesheets.filter(t => t.status === 'Submitted').length;
        const compRate = totalTs > 0 ? Math.round(((approvedTs + submittedTs) / totalTs) * 100) : 0;

        // Billable vs Internal split from approved timesheets
        const approved = timesheets.filter(t => t.status === 'Approved');
        const totalBillable = approved.reduce((s, t) => s + t.billableHours, 0);
        const totalHrsAll = approved.reduce((s, t) => s + t.totalHours, 0);
        const billablePct = totalHrsAll > 0 ? Math.round((totalBillable / totalHrsAll) * 100) : 0;

        // 1M/2M/3M forecast — allocation % in next 1, 2, 3 months
        const now = new Date();
        const forecast = [1, 2, 3].map(months => {
          const end = new Date(now.getFullYear(), now.getMonth() + months, 0);
          const total = allocations
            .filter(a => a.status === 'Active' && new Date(a.startDate) <= end && new Date(a.endDate) >= now)
            .reduce((s, a) => s + a.percentage, 0);
          return { label: `${months}M`, value: total };
        });

        // SVG ring
        const size = 64; const r = (size - 8) / 2;
        const circ = 2 * Math.PI * r;
        const filled = Math.min(plannedUtil / 100, 1) * circ;

        return (
          <div className="mt-6 bg-white border border-border-light rounded-2xl p-5 shadow-sm">
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-4">Employee 360 View</p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-5 items-center">

              {/* Utilization Ring */}
              <div className="flex flex-col items-center gap-2 col-span-1">
                <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                  <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#F3F4F6" strokeWidth={7} />
                  <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={ringColor} strokeWidth={7}
                    strokeDasharray={`${filled} ${circ}`} strokeLinecap="round"
                    transform={`rotate(-90 ${size/2} ${size/2})`}
                    style={{ transition: 'stroke-dasharray 0.5s ease' }}
                  />
                  <text x={size/2} y={size/2+4} textAnchor="middle" fontSize={11} fontWeight={700} fill="#003761">{utilizationEligible ? `${plannedUtil}%` : 'N/A'}</text>
                </svg>
                <span className={cn('px-2 py-0.5 rounded-full text-[9px] font-bold border', statusBg)}>{statusLabel}</span>
                <p className="text-[9px] text-gray-400 text-center">Planned Util.</p>
              </div>

              {/* Planned vs Actual */}
              <div className="col-span-1 space-y-3">
                <div>
                  <div className="flex justify-between text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                    <span>Planned</span><span>{utilizationEligible ? `${plannedUtil}%` : 'Excluded'}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-heading/70 transition-all" style={{ width: utilizationEligible ? `${Math.min(plannedUtil, 100)}%` : '0%' }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                    <span>Actual</span><span>{utilizationEligible ? `${actualUtil}%` : 'Excluded'}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: utilizationEligible ? `${Math.min(actualUtil, 100)}%` : '0%' }} />
                  </div>
                </div>
              </div>

              {/* Billable split */}
              <div className="col-span-1">
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-2">Billable Split</p>
                <div className="h-4 bg-gray-100 rounded-full overflow-hidden flex">
                  <div className="h-full bg-success transition-all" style={{ width: `${billablePct}%` }} title={`Billable: ${billablePct}%`} />
                  <div className="h-full bg-slate-300 transition-all" style={{ width: `${100 - billablePct}%` }} title={`Internal: ${100 - billablePct}%`} />
                </div>
                <div className="flex justify-between mt-1.5">
                  <span className="text-[9px] text-success font-bold">{billablePct}% Billable</span>
                  <span className="text-[9px] text-gray-400 font-bold">{100 - billablePct}% Internal</span>
                </div>
              </div>

              {/* 1M/2M/3M Forecast */}
              <div className="col-span-1">
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-2">Forecast Load</p>
                <div className="flex items-end gap-2 h-10">
                  {forecast.map(f => (
                    <div key={f.label} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className={cn('w-full rounded-t', f.value > 100 ? 'bg-danger' : f.value > 0 ? 'bg-heading/60' : 'bg-gray-100')}
                        style={{ height: `${Math.max(4, Math.min(f.value, 100) / 100 * 32)}px`, transition: 'height 0.4s ease' }}
                        title={`${f.label}: ${f.value}%`}
                      />
                      <span className="text-[8px] text-gray-400 font-bold">{f.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Timesheet health */}
              <div className="col-span-1">
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-2">Timesheet Health</p>
                <div className="flex items-center gap-3">
                  <div className="relative w-12 h-12 shrink-0">
                    <svg viewBox="0 0 44 44" className="w-full h-full -rotate-90">
                      <circle cx={22} cy={22} r={18} fill="none" stroke="#F3F4F6" strokeWidth={5} />
                      <circle cx={22} cy={22} r={18} fill="none" stroke="#059669" strokeWidth={5}
                        strokeDasharray={`${(compRate / 100) * (2 * Math.PI * 18)} ${2 * Math.PI * 18}`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-heading">{compRate}%</span>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-heading">{compRate >= 80 ? 'Healthy' : compRate > 0 ? 'Partial' : 'No Data'}</p>
                    <p className="text-[9px] text-gray-400">{approvedTs} approved / {totalTs} weeks</p>
                  </div>
                </div>
              </div>

            </div>
          </div>
        );
      })()}
      {/* ────────────────────────────────────────────────────────────── */}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 mt-8">
        {/* Left Column: Summary & Metadata */}
        <div className="xl:col-span-4 space-y-8">
          <Card title="Consultant Summary" headerVariant="secondary">
            <div className="flex flex-col items-center text-center pb-6 border-b border-gray-50 mb-6">
              <div className="w-24 h-24 rounded-3xl bg-slate-50 text-slate-dark text-3xl font-bold flex items-center justify-center border border-slate-100 shadow-sm mb-4">
                 {employee.name.split(' ').map(n => n[0]).join('')}
              </div>

              <h2 className="text-xl font-bold text-heading">{employee.name}</h2>
              <p className="text-xs font-bold text-primary uppercase tracking-widest mt-1">{employee.designation}</p>
              <div className="flex items-center gap-2 mt-4">
                 <Badge variant={employee.status === 'Active' ? 'success' : 'warning'}>{employee.status}</Badge>
                 {!utilizationEligible && <Badge variant="neutral">Excluded from Utilization</Badge>}
                 <span className="text-[10px] font-mono text-gray-400">{employee.employeeId}</span>
              </div>
            </div>

            <div className="space-y-4">
               <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-gray-400">
                     <Building2 size={16} />
                     <span className="text-[11px] font-bold uppercase tracking-wider">Department</span>
                  </div>
                  <span className="text-xs font-bold text-heading">{employee.department}</span>
               </div>
               <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-gray-400">
                     <MapPin size={16} />
                     <span className="text-[11px] font-bold uppercase tracking-wider">Base Country</span>
                  </div>
                  <span className="text-xs font-bold text-heading">{employee.country}</span>
               </div>
               <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-gray-400">
                     <Mail size={16} />
                     <span className="text-[11px] font-bold uppercase tracking-wider">Work Email</span>
                  </div>
                  <span className="text-xs font-bold text-heading">{employee.email}</span>
               </div>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-50">
               <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Current Utilization</p>
               {utilizationEligible ? (
                 <div className="grid grid-cols-2 gap-4">
                    <div className="bg-bg-secondary p-4 rounded-2xl border border-border-light">
                       <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Planned</p>
                       <p className={cn(
                         "text-xl font-bold",
                         employee.plannedUtilization > 100 ? "text-danger" : "text-heading"
                       )}>{employee.plannedUtilization}%</p>
                    </div>
                    <div className="bg-bg-secondary p-4 rounded-2xl border border-border-light text-right">
                       <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Actual (avg)</p>
                       <p className="text-xl font-bold text-primary">{employee.actualUtilization}%</p>
                    </div>
                 </div>
               ) : (
                 <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                   <p className="text-xs font-bold text-heading">Excluded from utilization capacity</p>
                   <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                     Governance users remain searchable in Employee Master but are not counted in planned, actual, or forecast utilization denominators.
                   </p>
                 </div>
               )}
            </div>
          </Card>

          <Card title="Management Hierarchy">
             <div className="space-y-6">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Primary Country Director</p>
                  <div className="flex items-center gap-3 p-3 bg-bg-secondary rounded-xl border border-border-light">
                     <div className="w-8 h-8 rounded-lg bg-white border border-border-light flex items-center justify-center text-primary font-bold">
                        {getCDName(employee.primaryCountryDirectorId)[0]}
                     </div>
                     <span className="text-xs font-bold text-heading">{getCDName(employee.primaryCountryDirectorId)}</span>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Supporting Mappings (Multi-CD)</p>
                  <div className="flex flex-wrap gap-2">
                     {employee.mappedCountryDirectorIds.map(id => (
                       <div key={id} className="px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-bold text-slate-dark flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary"></div>
                          {getCDName(id)}
                       </div>
                     ))}
                  </div>
                  <p className="text-[9px] text-body/50 mt-3 italic leading-relaxed">
                    Note: Employee is visible in reports for all mapped directors listed above.
                  </p>
                </div>
             </div>
          </Card>

          <Card title="Quick Resources">
             <div className="space-y-2">
                {canUseAllocationControl && (
                <Link to={`/allocations?employeeId=${employee.id}&returnTo=${encodeURIComponent(`/employees/${employee.id}`)}`} className="w-full flex items-center justify-between p-3 rounded-xl border border-border-light hover:bg-orange-50 hover:border-primary/20 transition-all group text-left">
                   <div className="flex items-center gap-3">
                      <div className="p-2 bg-bg-secondary group-hover:bg-white rounded-lg text-slate-dark group-hover:text-primary transition-colors">
                        <Calendar size={16} />
                      </div>
                      <span className="text-xs font-bold text-heading">Full Schedule</span>
                   </div>
                   <ChevronRight size={14} className="text-gray-300 group-hover:text-primary" />
                </Link>
                )}
                {canUseTimesheetApproval && (
                <Link to="/timesheets/approval" className="w-full flex items-center justify-between p-3 rounded-xl border border-border-light hover:bg-orange-50 hover:border-primary/20 transition-all group text-left">
                   <div className="flex items-center gap-3">
                      <div className="p-2 bg-bg-secondary group-hover:bg-white rounded-lg text-slate-dark group-hover:text-primary transition-colors">
                        <Clock size={16} />
                      </div>
                      <span className="text-xs font-bold text-heading">Timesheet History</span>
                   </div>
                   <ChevronRight size={14} className="text-gray-300 group-hover:text-primary" />
                </Link>
                )}
             </div>
          </Card>
        </div>

        {/* Right Column: Projects & Active Load */}
        <div className="xl:col-span-8 space-y-8">
          <Card 
            title="Portfolio Assignments" 
            subtitle="Detailed view of all active and proposed project allocations."
            headerAction={
              canUseAllocationControl ? (
               <Link to={`/allocations?employeeId=${employee.id}&returnTo=${encodeURIComponent(`/employees/${employee.id}`)}`} className="btn-primary py-1.5 px-3 flex items-center gap-2 text-[10px]">
                  <Plus size={12} /> Assign Project
               </Link>
              ) : undefined
            }
          >
            <div className="overflow-x-auto -mx-6">
               <table className="w-full text-left text-xs">
                  <thead className="bg-bg-secondary/30 border-y border-border-light">
                     <tr>
                        <th className="px-6 py-4 font-bold text-gray-500 uppercase tracking-widest">Project Details</th>
                        <th className="px-6 py-4 font-bold text-gray-500 uppercase tracking-widest">Allocation</th>
                        <th className="px-6 py-4 font-bold text-gray-500 uppercase tracking-widest">Period</th>
                        <th className="px-6 py-4 font-bold text-gray-500 uppercase tracking-widest">Type</th>
                        <th className="px-6 py-4 font-bold text-gray-500 uppercase tracking-widest text-right">Actions</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-border-light">
                     {allocations.length > 0 ? allocations.map((alc) => (
                       <tr key={alc.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-5">
                             <div className="font-bold text-heading">{alc.projectName}</div>
                             <div className="text-[10px] text-body/60 mt-1">Lead: {alc.projectManager}</div>
                             {alc.roleOnProject && (
                               <div className="text-[10px] text-primary font-bold mt-1">
                                 Project role: {alc.roleOnProject}
                               </div>
                             )}
                          </td>
                          <td className="px-6 py-5">
                             <div className="flex flex-col gap-1.5">
                                <span className="font-bold text-heading">{alc.percentage}%</span>
                                <div className="w-20 bg-gray-100 h-1.5 rounded-full overflow-hidden">
                                   <div className="h-full bg-primary rounded-full" style={{ width: `${alc.percentage}%` }}></div>
                                </div>
                             </div>
                          </td>
                          <td className="px-6 py-5">
                             <div className="text-heading font-medium">{alc.startDate}</div>
                             <div className="text-[10px] text-gray-400">to {alc.endDate}</div>
                          </td>
                          <td className="px-6 py-5">
                             <div className="flex flex-col gap-1">
                                <Badge variant={alc.billable ? 'success' : 'neutral'}>
                                   {alc.billable ? 'Billable' : 'Internal'}
                                </Badge>
                                <Badge variant={alc.status === 'Active' ? 'neutral' : 'warning'} className="bg-transparent border-none text-[9px] -ml-2">
                                   {alc.status}
                                </Badge>
                             </div>
                          </td>
                          <td className="px-6 py-5 text-right">
                             <Link 
                                to={`/projects/${alc.projectId}`}
                                className="p-2 text-gray-400 hover:text-primary transition-colors inline-block"
                             >
                                <ExternalLink size={16} />
                             </Link>
                          </td>
                       </tr>
                     )) : (
                       <tr>
                         <td colSpan={5} className="px-6 py-12 text-center text-gray-400 italic">No active projects found for this consultant.</td>
                       </tr>
                     )}
                  </tbody>
               </table>
            </div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             <Card title="Timesheet Health">
                <div className="flex items-center gap-6 mb-8">
                   <div className="w-16 h-16 rounded-full border-[6px] border-primary flex items-center justify-center">
                      <span className="text-sm font-bold text-heading">{complianceRate}%</span>
                   </div>
                   <div>
                      <p className="text-base font-bold text-heading">{timesheetHeadline}</p>
                      <p className="text-xs text-body opacity-60">{timesheetSubtitle}</p>
                   </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                   <div className="p-3 bg-bg-secondary rounded-xl border border-border-light">
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Billable Hours</p>
                      <p className="text-lg font-bold text-heading">{approvedBillableHours}h</p>
                   </div>
                   <div className="p-3 bg-bg-secondary rounded-xl border border-border-light">
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Internal Ops</p>
                      <p className="text-lg font-bold text-heading">{approvedInternalHours}h</p>
                   </div>
                </div>
             </Card>

             <Card title="Compliance & Audit">
                <div className="space-y-4">
                   <div className="flex items-start gap-3">
                      <div className="p-1.5 rounded-full bg-success/10 text-success">
                         <CheckCircle2 size={14} />
                      </div>
                      <div>
                         <p className="text-xs font-bold text-heading">Profile Verified</p>
                         <p className="text-[10px] text-body/60 italic">Last audited on 20 Apr 2026</p>
                      </div>
                   </div>
                   <div className="flex items-start gap-3">
                      <div className="p-1.5 rounded-full bg-success/10 text-success">
                         <CheckCircle2 size={14} />
                      </div>
                      <div>
                         <p className="text-xs font-bold text-heading">Skills Matrix Updated</p>
                         <p className="text-[10px] text-body/60 italic">Expiring in 90 days</p>
                      </div>
                   </div>
                   <div className="flex items-start gap-3 opacity-50">
                      <div className="p-1.5 rounded-full bg-gray-100 text-gray-400">
                         <CheckCircle2 size={14} />
                      </div>
                      <div>
                         <p className="text-xs font-bold text-heading">Policy Agreement</p>
                         <p className="text-[10px] text-body/60 italic">Standard corporate terms</p>
                      </div>
                   </div>
                </div>
             </Card>
          </div>
          
          <Card title="Allocation History (LTM)" headerVariant="secondary">
             <div className="h-24 flex items-end gap-1.5 px-2">
                {allocationHistory.map((month, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                     <div 
                        className={cn(
                          "w-full rounded-t-sm transition-all group-hover:opacity-80",
                          month.value > 100 ? "bg-danger" : "bg-primary/20",
                          i === allocationHistory.length - 1 && "bg-primary"
                        )}
                        style={{ height: `${Math.max(4, (month.value / maxAllocationHistory) * 100)}%` }}
                        title={`${month.value}% allocated`}
                     ></div>
                     <span className="text-[8px] font-bold text-gray-300 group-hover:text-heading transition-colors">{month.label}</span>
                  </div>
                ))}
             </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
