import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { projectService, allocationService, employeeService, timesheetService, adminService } from '../services/api';
import { Project, Allocation, Employee, TimesheetSummary } from '../types';
import { 
  Briefcase, 
  Target, 
  Calendar, 
  Users, 
  Clock, 
  FileText, 
  ExternalLink,
  ChevronRight,
  Edit2,
  Plus,
  Loader2,
  ArrowLeft,
  Layers,
  BarChart3,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { ProjectForm } from '../components/forms/ProjectForm';
import { overlapsDateRange } from '../services/calculations';
import { authService } from '../services/authService';
import {
  canAccessProjectDetail,
  canEditProjectData,
  canManageAllocations,
  canOpenImportExport,
} from '../services/accessControl';

export const ProjectDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [timesheets, setTimesheets] = useState<TimesheetSummary[]>([]);
  const [isProjectFormOpen, setIsProjectFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<any>({ expectedWeeklyHours: 40 });
  const currentUser = authService.getCurrentUser();

  const fetchProjectData = async () => {
    if (!id) return;
    try {
      const [projData, allAllocations, empData, tsData, setts] = await Promise.all([
        projectService.getById(id),
        allocationService.getAll(),
        employeeService.getAll(),
        timesheetService.getAll(),
        adminService.getSettings(),
      ]);
      const alcData = allAllocations.filter(a => a.projectId === id);
      if (projData) setProject(projData);
      setAllocations(alcData);
      setEmployees(empData);
      setTimesheets(tsData);
      setSettings(setts);
    } catch (error) {
      console.error('Failed to fetch project details', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjectData();
  }, [id]);

  if (loading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={40} />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-20">
        <div className="text-gray-400 mb-4">
          <Layers size={48} className="mx-auto opacity-20" />
        </div>
        <h2 className="text-xl font-bold text-heading">Project Not Found</h2>
        <p className="text-sm text-body/60 mt-2 mb-8">The project engagement you are looking for does not exist.</p>
        <Link to="/projects" className="btn-primary py-2 px-6">Back to Registry</Link>
      </div>
    );
  }

  if (!canAccessProjectDetail({ user: currentUser, project, projectId: project.id, allocations, employees })) {
    return (
      <div className="text-center py-20">
        <div className="text-gray-400 mb-4">
          <Layers size={48} className="mx-auto opacity-20" />
        </div>
        <h2 className="text-xl font-bold text-heading">Project Not Found</h2>
        <p className="text-sm text-body/60 mt-2 mb-8">The project engagement you are looking for is not available in your workspace scope.</p>
        <Link to="/" className="btn-primary py-2 px-6">Back to Dashboard</Link>
      </div>
    );
  }

  const getEmpInfo = (empId: string) => employees.find(e => e.id === empId);
  const canEditProject = canEditProjectData(currentUser);
  const canUseImportExport = canOpenImportExport(currentUser);
  const canUseAllocationControl = canManageAllocations(currentUser);
  const currentDate = new Date().toISOString().split('T')[0];

  const visibleAllocations = allocations
    .filter(allocation => {
      if (project.status === 'Completed') return allocation.status === 'Completed';
      if (project.status === 'On Hold') return allocation.status !== 'Completed';
      if (project.status === 'Proposed') return allocation.status === 'Active';
      return allocation.status === 'Active' && overlapsDateRange(allocation.startDate, allocation.endDate, currentDate, currentDate);
    })
    .sort((a, b) => b.percentage - a.percentage || a.projectName.localeCompare(b.projectName));

  const latestProjectWeek = timesheets
    .filter(timesheet => timesheet.status === 'Approved' && timesheet.entries.some(entry => entry.projectId === project.id))
    .sort((a, b) => new Date(a.weekEnding).getTime() - new Date(b.weekEnding).getTime())
    .at(-1)?.weekEnding;

  const getProjectActualForEmployee = (employeeId: string) => {
    const latest = timesheets
      .filter(timesheet =>
        timesheet.employeeId === employeeId &&
        timesheet.status === 'Approved' &&
        timesheet.entries.some(entry => entry.projectId === project.id)
      )
      .sort((a, b) => new Date(a.weekEnding).getTime() - new Date(b.weekEnding).getTime())
      .at(-1);
    if (!latest) return 0;

    const projectHours = latest.entries
      .filter(entry => entry.projectId === project.id && entry.status === 'Approved')
      .reduce((sum, entry) => sum + entry.hours, 0);
    return Math.round((projectHours / settings.expectedWeeklyHours) * 1000) / 10;
  };

  const assignedHeadcount = visibleAllocations.length;
  const plannedFte = visibleAllocations.reduce((sum, allocation) => sum + allocation.percentage / 100, 0);
  const latestProjectHours = latestProjectWeek
    ? timesheets
      .filter(timesheet => timesheet.status === 'Approved' && timesheet.weekEnding === latestProjectWeek)
      .flatMap(timesheet => timesheet.entries)
      .filter(entry => entry.projectId === project.id && entry.status === 'Approved')
      .reduce((sum, entry) => sum + entry.hours, 0)
    : 0;
  const projectActual = assignedHeadcount > 0
    ? Math.round((latestProjectHours / (settings.expectedWeeklyHours * assignedHeadcount)) * 1000) / 10
    : 0;

  return (
    <div className="animate-in fade-in duration-500 pb-20">
      {isProjectFormOpen && (
        <div className="fixed inset-0 bg-slate-dark/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl animate-in zoom-in-95 duration-200">
            <ProjectForm
              project={project}
              onClose={() => setIsProjectFormOpen(false)}
              onSave={fetchProjectData}
            />
          </div>
        </div>
      )}

      <div className="mb-6">
        <Link to="/projects" className="flex items-center gap-2 text-xs font-bold text-primary hover:underline group">
           <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" /> Back to Registry
        </Link>
      </div>

      <PageHeader 
        title={project.name}
        subtitle={`${project.projectCode} • ${project.client} • Lead: ${project.managerName}`}
        breadcrumb={['Operations', 'Project Registry', project.name]}
        actions={
          <div className="flex items-center gap-3">
             {canUseImportExport && (
             <Link to="/import-export" className="btn-secondary py-2 px-4 flex items-center gap-2">
                <FileText size={14} /> Governance Export
             </Link>
             )}
             {canEditProject && (
             <button onClick={() => setIsProjectFormOpen(true)} className="btn-primary py-2 px-4 flex items-center gap-2">
                <Edit2 size={14} /> Update Project
             </button>
             )}
          </div>
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 mt-8">
        {/* Left Column: Summary & KPIs */}
        <div className="xl:col-span-4 space-y-8">
          <Card title="Engagement Blueprint" headerVariant="secondary">
            <div className="space-y-6">
               <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-bold text-heading">{project.name}</h3>
                    <p className="text-[10px] font-bold text-primary uppercase tracking-widest mt-0.5">{project.client}</p>
                  </div>
                  <Badge variant={project.status === 'Active' ? 'success' : 'warning'}>{project.status}</Badge>
               </div>

               <div className="grid grid-cols-2 gap-4 py-4 border-y border-gray-50">
                  <div className="space-y-1">
                     <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Project Lead</p>
                     <p className="text-xs font-bold text-heading">{project.managerName}</p>
                  </div>
                  <div className="space-y-1 text-right">
                     <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Type</p>
                     <p className="text-xs font-bold text-heading">{project.billable ? 'Billable Delivery' : 'Internal Ops'}</p>
                  </div>
               </div>

               <div className="space-y-4">
                  <div className="flex items-center justify-between">
                     <div className="flex items-center gap-3 text-gray-400">
                        <Calendar size={16} />
                        <span className="text-[11px] font-bold uppercase tracking-wider">Timeline</span>
                     </div>
                     <span className="text-xs font-bold text-heading">{project.startDate} — {project.endDate}</span>
                  </div>
                  <div className="flex items-center justify-between">
                     <div className="flex items-center gap-3 text-gray-400">
                        <Target size={16} />
                        <span className="text-[11px] font-bold uppercase tracking-wider">Planned FTE</span>
                     </div>
                     <span className="text-xs font-bold text-heading">{plannedFte.toFixed(1)} FTE</span>
                  </div>
                  <div className="flex items-center justify-between">
                     <div className="flex items-center gap-3 text-gray-400">
                        <Users size={16} />
                        <span className="text-[11px] font-bold uppercase tracking-wider">Resource Headcount</span>
                     </div>
                     <span className="text-xs font-bold text-heading">{assignedHeadcount} Assigned</span>
                  </div>
               </div>

               <div className="pt-6 border-t border-gray-50">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Real-time Load Indicator</p>
                  <div className="bg-bg-secondary p-5 rounded-2xl border border-border-light relative overflow-hidden group">
                     <div className="relative z-10">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Latest Approved Project Actual</p>
                        <div className="flex items-end gap-2">
                           <p className="text-3xl font-bold text-primary">{projectActual}%</p>
                           <span className="text-[10px] text-success font-bold mb-1.5 flex items-center">
                              <TrendingUp size={10} className="mr-0.5" /> {latestProjectHours}h
                           </span>
                        </div>
                     </div>
                     <BarChart3 size={60} className="absolute -right-2 -bottom-2 text-primary opacity-[0.03] group-hover:opacity-10 transition-opacity" />
                  </div>
               </div>
            </div>
          </Card>

          <Card title="Allocation Analytics">
             <div className="space-y-8">
                <div>
                   <div className="flex justify-between items-end mb-2">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Seniority Mix</p>
                      <p className="text-xs font-bold text-heading">Balanced</p>
                   </div>
                   <div className="flex h-2.5 rounded-full overflow-hidden">
                      <div className="w-[40%] bg-heading" title="Principal/Senior"></div>
                      <div className="w-[40%] bg-primary" title="Consultant"></div>
                      <div className="w-[20%] bg-slate-200" title="Junior"></div>
                   </div>
                   <div className="flex justify-between mt-2">
                      <div className="flex items-center gap-1.5">
                         <div className="w-1.5 h-1.5 rounded-full bg-heading"></div>
                         <span className="text-[9px] font-bold text-gray-400">SR 40%</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                         <div className="w-1.5 h-1.5 rounded-full bg-primary"></div>
                         <span className="text-[9px] font-bold text-gray-400">MID 40%</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                         <div className="w-1.5 h-1.5 rounded-full bg-slate-200"></div>
                         <span className="text-[9px] font-bold text-gray-400">JR 20%</span>
                      </div>
                   </div>
                </div>

                <div className="p-4 bg-orange-50 rounded-2xl border border-orange-100">
                   <div className="flex gap-3">
                      <div className="p-2 bg-white rounded-xl text-primary shadow-sm h-fit">
                         <Clock size={16} />
                      </div>
                      <div>
                         <p className="text-xs font-bold text-heading">Staffing Forecast</p>
                         <p className="text-[10px] text-body opacity-70 mt-1 leading-relaxed">
                            Based on project pipeline, this module will require 2 additional Full Stack resources starting June 2026.
                         </p>
                      </div>
                   </div>
                </div>
             </div>
          </Card>
        </div>

        {/* Right Column: Resource List & Detail */}
        <div className="xl:col-span-8 space-y-8">
          <Card 
            title="Assigned Consultants" 
            subtitle="Active resource stack and individual allocation integrity."
            headerAction={
              canUseAllocationControl ? (
               <Link
                to={`/allocations?projectId=${project.id}&returnTo=${encodeURIComponent(`/projects/${project.id}`)}`}
                className="btn-primary py-1.5 px-3 flex items-center gap-2 text-[10px]"
               >
                  <Plus size={12} /> Add Resource
               </Link>
              ) : undefined
            }
          >
            <div className="overflow-x-auto -mx-6">
               <table className="w-full text-left text-xs">
                  <thead className="bg-bg-secondary/30 border-y border-border-light">
                     <tr>
                        <th className="px-6 py-4 font-bold text-gray-500 uppercase tracking-widest">Consultant</th>
                        <th className="px-6 py-4 font-bold text-gray-500 uppercase tracking-widest">Assignment / Home Role</th>
                        <th className="px-6 py-4 font-bold text-gray-500 uppercase tracking-widest text-center">Alloc %</th>
                        <th className="px-6 py-4 font-bold text-gray-500 uppercase tracking-widest text-center">Project Actual</th>
                        <th className="px-6 py-4 font-bold text-gray-500 uppercase tracking-widest">Director</th>
                        <th className="px-6 py-4"></th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-border-light">
                     {visibleAllocations.length > 0 ? visibleAllocations.map((alc) => {
                       const emp = getEmpInfo(alc.employeeId);
                       const projectActualForEmployee = getProjectActualForEmployee(alc.employeeId);
                       return (
                         <tr key={alc.id} className="hover:bg-gray-50 transition-colors group">
                            <td className="px-6 py-4.5">
                               <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center font-bold text-slate-dark text-[10px]">
                                     {emp?.name.split(' ').map(n => n[0]).join('')}
                                  </div>
                                  <div>
                                     <Link to={`/employees/${alc.employeeId}`} className="font-bold text-heading hover:text-primary transition-colors block">
                                        {emp?.name}
                                     </Link>
                                     <span className="text-[9px] font-mono text-gray-400">{emp?.employeeId}</span>
                                  </div>
                               </div>
                            </td>
                            <td className="px-6 py-4.5">
                               <div className="space-y-1.5">
                                 <div>
                                   <div className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Project role</div>
                                   <div className="text-heading font-semibold leading-snug">{alc.roleOnProject || emp?.designation || 'Unassigned role'}</div>
                                 </div>
                                 {alc.roleOnProject && alc.roleOnProject !== emp?.designation && (
                                   <div>
                                     <div className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Home role</div>
                                     <div className="text-[10px] text-primary font-bold leading-snug">{emp?.designation}</div>
                                   </div>
                                 )}
                                 <div className="text-[10px] text-body/60 uppercase font-bold">Practice: {emp?.department}</div>
                               </div>
                            </td>
                            <td className="px-6 py-4.5 text-center">
                               <span className="px-2 py-1 bg-slate-100 rounded text-[10px] font-bold text-slate-700">{alc.percentage}%</span>
                            </td>
                            <td className="px-6 py-4.5">
                               <div className="flex flex-col items-center gap-1">
                                  <span className="font-bold text-primary">{projectActualForEmployee}%</span>
                                  <div className="w-16 bg-gray-100 h-1 rounded-full overflow-hidden">
                                     <div className="h-full bg-primary" style={{ width: `${Math.min(projectActualForEmployee, 100)}%` }}></div>
                                  </div>
                               </div>
                            </td>
                            <td className="px-6 py-4.5">
                               <span className="text-[10px] font-bold text-gray-500 bg-bg-secondary px-2 py-1 rounded border border-border-light">
                                  {emp?.primaryCountryDirectorId}
                               </span>
                            </td>
                            <td className="px-6 py-4.5 text-right">
                              {canUseAllocationControl && (
                               <Link
                                to={`/allocations?allocationId=${alc.id}&returnTo=${encodeURIComponent(`/projects/${project.id}`)}`}
                                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:bg-orange-50 hover:text-primary transition-colors"
                                title="Manage this planned allocation in Allocation Control"
                               >
                                  <Edit2 size={14} /> Plan
                                </Link>
                              )}
                            </td>
                         </tr>
                       );
                     }) : (
                        <tr>
                           <td colSpan={6} className="px-6 py-12 text-center text-gray-400 italic">No resources allocated to this project registry.</td>
                        </tr>
                     )}
                  </tbody>
               </table>
            </div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             <Card title="Activity & Effort (LTM)">
                <div className="h-32 flex items-end gap-1 px-1">
                   {[20, 35, 45, 90, 85, 80, 75, 88, 92, 100, 95, 80].map((val, i) => (
                     <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                        <div 
                           className={cn(
                             "w-full rounded-t-sm transition-all group-hover:bg-primary",
                             i > 8 ? "bg-primary/80" : "bg-primary/10"
                           )}
                           style={{ height: `${val}%` }}
                        ></div>
                        <span className="text-[7px] font-bold text-gray-300">WK{i+14}</span>
                     </div>
                   ))}
                </div>
                <div className="mt-6 flex items-center justify-between text-[10px] font-bold text-gray-400 uppercase">
                   <span>Project Effort Trend</span>
                   <span className="text-primary hover:underline cursor-pointer">Export Logs</span>
                </div>
             </Card>

             <Card title="Project Governance">
                <div className="space-y-4">
                   {[
                      { label: 'Resource Plan Approved', status: true },
                      { label: 'Standard Master Agreement', status: true },
                      { label: 'Weekly Sync Scheduled', status: true },
                      { label: 'Budget/Billing Verified', status: false }
                   ].map((item, i) => (
                      <div key={i} className="flex items-center justify-between p-2.5 rounded-xl border border-gray-50 bg-bg-secondary/30">
                         <span className="text-xs font-semibold text-heading">{item.label}</span>
                         {item.status ? (
                            <CheckCircle2 size={16} className="text-success" />
                         ) : (
                            <div className="w-4 h-4 rounded-full border-2 border-gray-200"></div>
                         )}
                      </div>
                   ))}
                </div>
             </Card>
          </div>
          
          <Card title="Governance Audit Trail" headerVariant="secondary">
             <div className="space-y-4">
                {[
                   { user: 'Elena Rodriguez', action: 'Increased allocation for Sarah Anderson to 60%', time: 'Yesterday, 4:15 PM' },
                   { user: 'System Bot', action: 'Daily utilization sync completed (80% Avg)', time: 'Today, 8:00 AM' }
                ].map((audit, i) => (
                   <div key={i} className="flex gap-3 text-xs">
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-300 mt-1.5 shrink-0"></div>
                      <div>
                         <p className="text-heading font-medium">{audit.action}</p>
                         <p className="text-[10px] text-gray-400 font-bold uppercase mt-0.5">{audit.user} • {audit.time}</p>
                      </div>
                   </div>
                ))}
             </div>
          </Card>
        </div>
      </div>

    </div>
  );
};

const TrendingUp = ({ size, className }: { size?: number, className?: string }) => (
  <svg 
    width={size || 24} 
    height={size || 24} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
);
