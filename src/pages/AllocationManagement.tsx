import { useState, useEffect, useMemo, useRef } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { Badge } from '../components/ui/Badge';
import { allocationService, employeeService, projectService, adminService } from '../services/api';
import { authService } from '../services/authService';
import { Allocation, Employee, Project, CountryDirector } from '../types';
import { 
  User, 
  Briefcase, 
  Edit, 
  Trash2, 
  Loader2, 
  Search, 
  Filter, 
  Download, 
  Plus,
  ArrowUpRight,
  AlertCircle,
  Target
} from 'lucide-react';
import { cn } from '../lib/utils';
import { downloadCsv } from '../lib/csv';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { AllocationForm } from '../components/forms/AllocationForm';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

export const AllocationManagement = () => {
  const [view, setView] = useState<'employee' | 'project'>('employee');
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [cds, setCds] = useState<CountryDirector[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedAllocation, setSelectedAllocation] = useState<Allocation | undefined>(undefined);
  const [showFilters, setShowFilters] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [returnToPath, setReturnToPath] = useState<string | null>(null);
  const [allocationToEnd, setAllocationToEnd] = useState<Allocation | null>(null);
  const returnToRef = useRef<string | null>(null);
  const navigate = useNavigate();

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('All Departments');
  const [cdFilter, setCdFilter] = useState('All Directors');
  const [utilFilter, setUtilFilter] = useState('Any');

  const loadScopedData = async () => {
    try {
      const user = authService.getCurrentUser();
      let [alcData, empData, prjData, cdData] = await Promise.all([
        allocationService.getAll(),
        employeeService.getAll(),
        projectService.getAll(),
        adminService.getCountryDirectors(),
      ]);

      if (user?.role === 'ProjectManager') {
        const managedProjectIds = new Set(prjData
          .filter(project => project.managerId === user.id || project.managerId === user.employeeId || project.managerName === user.name)
          .map(project => project.id));
        alcData = alcData.filter(allocation => managedProjectIds.has(allocation.projectId));
        prjData = prjData.filter(project => managedProjectIds.has(project.id));
        const visibleEmployeeIds = new Set(alcData.map(allocation => allocation.employeeId));
        empData = empData.filter(employee => visibleEmployeeIds.has(employee.id));
      }

      if (user?.role === 'CountryDirector' && user.cdId) {
        const scopedEmployeeIds = new Set(empData
          .filter(employee =>
            employee.primaryCountryDirectorId === user.cdId ||
            employee.mappedCountryDirectorIds.includes(user.cdId!)
          )
          .map(employee => employee.id));
        alcData = alcData.filter(allocation => scopedEmployeeIds.has(allocation.employeeId));
        empData = empData.filter(employee => scopedEmployeeIds.has(employee.id));
        const visibleProjectIds = new Set(alcData.map(allocation => allocation.projectId));
        prjData = prjData.filter(project => visibleProjectIds.has(project.id) || project.status !== 'Completed');
      }

      setAllocations(alcData);
      setEmployees(empData);
      setProjects(prjData);
      setCds(cdData);
    } catch (error) {
      console.error('Failed to fetch allocations', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadScopedData();
  }, []);

  useEffect(() => {
    if (loading) return;
    const allocationId = searchParams.get('allocationId');
    const employeeId = searchParams.get('employeeId');
    const projectId = searchParams.get('projectId');
    const returnTo = searchParams.get('returnTo');

    if (returnTo?.startsWith('/')) {
      setReturnToPath(returnTo);
      returnToRef.current = returnTo;
    }

    if (allocationId) {
      const allocation = allocations.find(item => item.id === allocationId);
      if (allocation) {
        setSelectedAllocation(allocation);
        setIsFormOpen(true);
        setSearchParams({}, { replace: true });
      }
      return;
    }

    if (employeeId || projectId) {
      setSelectedAllocation({
        id: '',
        employeeId: employeeId || '',
        projectId: projectId || '',
        projectName: '',
        projectManager: '',
        roleOnProject: '',
        percentage: 60,
        startDate: new Date().toISOString().split('T')[0],
        endDate: `${new Date().getFullYear()}-12-31`,
        billable: true,
        status: 'Active',
      });
      setIsFormOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [loading, allocations, searchParams, setSearchParams]);

  const closeAllocationForm = () => {
    setIsFormOpen(false);
    setSelectedAllocation(undefined);
    refreshData();
    const target = returnToRef.current || returnToPath;
    if (target) {
      setReturnToPath(null);
      returnToRef.current = null;
      navigate(target);
    }
  };

  const filteredAllocations = useMemo(() => {
    return allocations.filter(alc => {
      const emp = employees.find(e => e.id === alc.employeeId);
      const prj = projects.find(p => p.id === alc.projectId);
      
      if (!emp || !prj) return false;

      const matchesSearch = 
        emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        prj.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        prj.client.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesDept = deptFilter === 'All Departments' || emp.department === deptFilter;
      
      const matchesCd = cdFilter === 'All Directors' || 
        emp.primaryCountryDirectorId === cdFilter || 
        emp.mappedCountryDirectorIds.includes(cdFilter);

      let matchesUtil = true;
      if (utilFilter === 'Over 100%') matchesUtil = emp.plannedUtilization > 100;
      else if (utilFilter === '80-100%') matchesUtil = emp.plannedUtilization >= 80 && emp.plannedUtilization <= 100;
      else if (utilFilter === 'Under 80%') matchesUtil = emp.plannedUtilization < 80;

      return matchesSearch && matchesDept && matchesCd && matchesUtil;
    });
  }, [allocations, employees, projects, searchQuery, deptFilter, cdFilter, utilFilter]);

  // Aggregate by View
  const viewData = useMemo(() => {
    if (view === 'employee') {
      const map = new Map<string, { employee: Employee, allocations: Allocation[] }>();
      filteredAllocations.forEach(alc => {
        const emp = employees.find(e => e.id === alc.employeeId);
        if (emp) {
          if (!map.has(emp.id)) map.set(emp.id, { employee: emp, allocations: [] });
          map.get(emp.id)?.allocations.push(alc);
        }
      });
      return Array.from(map.values());
    } else {
      const map = new Map<string, { project: Project, allocations: Allocation[] }>();
      filteredAllocations.forEach(alc => {
        const prj = projects.find(p => p.id === alc.projectId);
        if (prj) {
          if (!map.has(prj.id)) map.set(prj.id, { project: prj, allocations: [] });
          map.get(prj.id)?.allocations.push(alc);
        }
      });
      return Array.from(map.values());
    }
  }, [view, filteredAllocations, employees, projects]);

  const getCDName = (id: string) => cds.find(c => c.id === id)?.name || id;

  const [settings, setSettings] = useState({ utilizationThresholdHigh: 100 });
  useEffect(() => { adminService.getSettings().then(s => setSettings(s)); }, []);
  const activeEmployees = employees.filter(employee => employee.status === 'Active');
  const activeAllocationRows = filteredAllocations.filter(allocation => allocation.status === 'Active');
  const aggregatePlanned = activeEmployees.length
    ? activeEmployees.reduce((sum, employee) => sum + employee.plannedUtilization, 0) / activeEmployees.length
    : 0;
  const overAllocatedCount = activeEmployees.filter(employee => employee.plannedUtilization > settings.utilizationThresholdHigh).length;
  const mostLoadedDepartment = activeEmployees.reduce<Record<string, number>>((map, employee) => {
    map[employee.department] = (map[employee.department] || 0) + employee.plannedUtilization;
    return map;
  }, {});
  const departmentLoads = Object.entries(mostLoadedDepartment) as [string, number][];
  const focusDepartment = departmentLoads.sort((a, b) => b[1] - a[1])[0]?.[0] || 'No active department';
  const allocationSummary = [
    { label: 'Visible Resources', value: new Set(activeAllocationRows.map(allocation => allocation.employeeId)).size, sub: 'With active plans', icon: User },
    { label: 'Staffed Projects', value: new Set(activeAllocationRows.map(allocation => allocation.projectId)).size, sub: 'In current scope', icon: Briefcase },
    { label: 'Allocated FTE', value: activeAllocationRows.reduce((sum, allocation) => sum + allocation.percentage / 100, 0).toFixed(1), sub: 'Planned capacity', icon: Target },
    { label: 'Overloaded', value: overAllocatedCount, sub: `>${settings.utilizationThresholdHigh}% planned`, icon: AlertCircle },
  ];

  const refreshData = () => {
    loadScopedData();
  };

  const handleDelete = (allocation: Allocation) => {
    setAllocationToEnd(allocation);
  };

  const confirmEndAllocation = async () => {
    if (!allocationToEnd) return;
    await allocationService.delete(allocationToEnd.id);
    setAllocationToEnd(null);
    refreshData();
  };

  const handleExport = () => {
    downloadCsv('allocation-control-export.csv', filteredAllocations.map(allocation => {
      const employee = employees.find(item => item.id === allocation.employeeId);
      const project = projects.find(item => item.id === allocation.projectId);
      return {
        employeeId: employee?.employeeId || allocation.employeeId,
        employeeName: employee?.name || allocation.employeeId,
        department: employee?.department || '',
        primaryCountryDirector: employee ? getCDName(employee.primaryCountryDirectorId) : '',
        projectCode: project?.projectCode || allocation.projectId,
        projectName: allocation.projectName,
        client: project?.client || '',
        projectManager: allocation.projectManager,
        roleOnProject: allocation.roleOnProject || '',
        percentage: allocation.percentage,
        startDate: allocation.startDate,
        endDate: allocation.endDate,
        billable: allocation.billable ? 'Yes' : 'No',
        status: allocation.status,
      };
    }));
    adminService.logAction('Export', 'Allocation Control', `Exported ${filteredAllocations.length} allocation rows from current filter scope`);
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
        title="Allocation Control" 
        subtitle="Create and edit planned project percentages. Timesheets drive actual utilization and gap tracking."
        breadcrumb={['Operations', 'Resource Management']}
        actions={
          <div className="flex bg-white border border-border-light rounded-lg p-1 shadow-sm">
            <button 
              onClick={() => setView('employee')}
              className={cn(
                "flex items-center gap-2 px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all",
                view === 'employee' ? "bg-primary text-white shadow-md shadow-primary/20" : "text-gray-400 hover:text-heading"
              )}
            >
              <User size={12} /> By Resource
            </button>
            <button 
              onClick={() => setView('project')}
              className={cn(
                "flex items-center gap-2 px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all",
                view === 'project' ? "bg-primary text-white shadow-md shadow-primary/20" : "text-gray-400 hover:text-heading"
              )}
            >
              <Briefcase size={12} /> By Project
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {allocationSummary.map(item => (
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

      <div className="flex flex-col gap-4 mb-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text" 
              placeholder={`Find by ${view === 'employee' ? 'resource' : 'project'} or client...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-border-light rounded-xl py-2.5 pl-10 pr-4 text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all shadow-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "btn-secondary py-2.5 px-4 flex items-center gap-2",
                showFilters && "bg-slate-50 border-primary/20 text-primary"
              )}
            >
              <Filter size={14} /> Filters
            </button>
            <button onClick={handleExport} className="btn-secondary py-2.5 px-4 flex items-center gap-2">
               <Download size={14} /> Export Plan
            </button>
            <button 
              onClick={() => {
                setSelectedAllocation(undefined);
                setIsFormOpen(true);
              }}
              className="btn-primary py-2.5 px-4 flex items-center gap-2 shadow-lg shadow-primary/20"
            >
              <Plus size={14} /> New Allocation
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-5 bg-white border border-border-light rounded-2xl animate-in slide-in-from-top-2 duration-200 shadow-sm">
            <div className="space-y-1.5 font-bold">
              <label className="text-[10px] text-gray-400 uppercase tracking-widest">Practice Unit</label>
              <select 
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="w-full bg-bg-secondary border border-border-light rounded-lg px-3 py-2 text-xs outline-none focus:border-primary"
              >
                <option>All Departments</option>
                <option>Digital Transformation</option>
                <option>Cloud Solutions</option>
                <option>Software Engineering</option>
              </select>
            </div>
            <div className="space-y-1.5 font-bold">
              <label className="text-[10px] text-gray-400 uppercase tracking-widest">Country Director</label>
              <select 
                value={cdFilter}
                onChange={(e) => setCdFilter(e.target.value)}
                className="w-full bg-bg-secondary border border-border-light rounded-lg px-3 py-2 text-xs outline-none focus:border-primary"
              >
                <option>All Directors</option>
                {cds.map(cd => <option key={cd.id} value={cd.id}>{cd.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5 font-bold">
              <label className="text-[10px] text-gray-400 uppercase tracking-widest">Util Load Band</label>
              <select 
                value={utilFilter}
                onChange={(e) => setUtilFilter(e.target.value)}
                className="w-full bg-bg-secondary border border-border-light rounded-lg px-3 py-2 text-xs outline-none focus:border-primary"
              >
                <option>Any</option>
                <option>Over 100%</option>
                <option>80-100%</option>
                <option>Under 80%</option>
              </select>
            </div>
             <div className="flex items-end">
               <button 
                 onClick={() => {
                   setSearchQuery('');
                   setDeptFilter('All Departments');
                   setCdFilter('All Directors');
                   setUtilFilter('Any');
                 }}
                 className="w-full bg-heading text-white py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-slate-800 transition-colors"
                >
                  Reset Parameters
                </button>
             </div>
          </div>
        )}
      </div>

      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-dark/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl animate-in zoom-in-95 duration-200">
            <AllocationForm 
              allocation={selectedAllocation}
              onClose={closeAllocationForm} 
            />
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!allocationToEnd}
        title="End Allocation"
        description={`End the active allocation for ${allocationToEnd?.projectName || 'this project'}? The record will be completed for audit history instead of being removed.`}
        confirmLabel="End Allocation"
        variant="danger"
        onConfirm={confirmEndAllocation}
        onCancel={() => setAllocationToEnd(null)}
      />

      <div className="space-y-6">
        {viewData.map((item: any, idx) => {
          const isEmployeeView = view === 'employee';
          const header = isEmployeeView ? item.employee : item.project;
          
          return (
            <div key={idx} className="bg-white border border-border-light rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow group">
              <div className="bg-slate-50 border-b border-gray-100 p-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {isEmployeeView ? (
                    <div className="w-10 h-10 rounded-xl bg-white border border-border-light flex items-center justify-center text-primary font-bold shadow-sm">
                      {header.name.split(' ').map((n: string) => n[0]).join('')}
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-orange-50 border border-primary/20 flex items-center justify-center text-primary shadow-sm">
                      <Briefcase size={18} />
                    </div>
                  )}
                  <div>
                    <h3 className="text-sm font-bold text-heading flex items-center gap-2">
                       {header.name} 
                       <span className="text-[10px] text-body opacity-50 font-mono font-normal">
                         {isEmployeeView ? header.employeeId : header.projectCode}
                       </span>
                    </h3>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                       {isEmployeeView ? `${header.designation} • ${header.department}` : `${header.client} • Lead: ${header.managerName}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-8">
                  <div className="text-center hidden sm:block">
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                      {isEmployeeView ? 'Planned Load' : 'Current Team'}
                    </p>
                    <div className="flex items-center gap-2">
                       <span className={cn(
                         "text-sm font-bold",
                         (isEmployeeView ? header.plannedUtilization : item.allocations.length) > (isEmployeeView ? 100 : 10) ? "text-danger" : "text-heading"
                       )}>
                         {isEmployeeView ? `${header.plannedUtilization}%` : item.allocations.length}
                       </span>
                       <div className="w-16 h-1 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className={cn("h-full", (isEmployeeView && header.plannedUtilization > 100) ? "bg-danger" : "bg-primary")} 
                            style={{ width: `${Math.min(isEmployeeView ? header.plannedUtilization : (item.allocations.length * 10), 100)}%` }}
                          />
                       </div>
                    </div>
                  </div>
                  <div className="w-px h-8 bg-gray-200 hidden sm:block"></div>
                  <Link
                    to={isEmployeeView ? `/employees/${header.id}` : `/projects/${header.id}`}
                    className="p-2 text-gray-400 hover:text-primary hover:bg-orange-50 rounded-lg transition-all active:scale-95"
                    title={isEmployeeView ? 'Open employee profile' : 'Open project profile'}
                  >
                    <ArrowUpRight size={18} />
                  </Link>
                </div>
              </div>

              <div className="p-5">
                <table className="w-full text-left text-xs">
                  <thead className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    <tr>
                      <th className="pb-4 font-bold w-1/3">{isEmployeeView ? 'Project / Process' : 'Resource / Project Role'}</th>
                      <th className="pb-4 font-bold w-1/4">Planned Load</th>
                      <th className="pb-4 font-bold">Planned Timeline</th>
                      <th className="pb-4 font-bold">Billing Status</th>
                      <th className="pb-4 font-bold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 uppercase font-bold text-[10px] tracking-tight">
                    {item.allocations.map((alc: Allocation) => {
                      const relatedEmp = isEmployeeView ? null : employees.find(e => e.id === alc.employeeId);
                      const relatedPrj = isEmployeeView ? projects.find(p => p.id === alc.projectId) : null;
                      
                      const nowStr = new Date().toISOString().split('T')[0];
                      const isPast = alc.endDate < nowStr;
                      const isFuture = alc.startDate > nowStr;
                      
                      return (
                        <tr key={alc.id} className={cn("hover:bg-slate-50/50 transition-colors", isPast ? "opacity-40" : "")}>
                          <td className="py-4">
                             <div className="flex items-center gap-3">
                               <Link
                                to={isEmployeeView ? `/projects/${alc.projectId}` : `/employees/${alc.employeeId}`}
                                className="text-heading hover:text-primary transition-colors"
                               >
                                  {isEmployeeView ? alc.projectName : relatedEmp?.name}
                               </Link>
                               {isEmployeeView && <span className="text-[9px] text-gray-400">{relatedPrj?.client}</span>}
                             </div>
                             {alc.roleOnProject && (
                               <div className="text-[9px] text-primary mt-1 tracking-normal normal-case">
                                 Project role: {alc.roleOnProject}
                               </div>
                             )}
                          </td>
                          <td className="py-4 pr-6">
                            <div className={cn("flex items-center gap-4", isPast ? "grayscale" : "")}>
                              <span className="bg-orange-50 border border-primary/10 px-2.5 py-1 rounded-md text-primary font-bold min-w-[50px] text-center shadow-sm">
                                {alc.percentage}%
                              </span>
                              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden hidden sm:block">
                                <div 
                                  className={cn(
                                    "h-full rounded-full transition-all", 
                                    alc.percentage > 100 ? "bg-danger" : 
                                    alc.percentage >= 80 ? "bg-success" : 
                                    alc.percentage < 40 ? "bg-warning" : "bg-primary"
                                  )} 
                                  style={{ width: `${Math.min(alc.percentage, 100)}%` }} 
                                />
                              </div>
                            </div>
                          </td>
                          <td className="py-4 font-mono text-gray-500">
                            <div className="flex items-center gap-2">
                              <span>{alc.startDate} <span className="mx-1 opacity-30">→</span> {alc.endDate}</span>
                              {isPast && <span className="bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest">Past</span>}
                              {isFuture && <span className="bg-blue-50 text-blue-500 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest">Future</span>}
                            </div>
                          </td>
                          <td className="py-4">
                             <Badge variant={alc.billable ? 'success' : 'neutral'}>
                                {alc.billable ? 'Billable' : 'Internal'}
                             </Badge>
                          </td>
                          <td className="py-4 text-right">
                             <div className="flex items-center justify-end gap-2">
                                <button 
                                  onClick={() => {
                                    setSelectedAllocation(alc);
                                    setIsFormOpen(true);
                                  }}
                                  className="p-1.5 text-gray-300 hover:text-primary transition-colors"
                                >
                                   <Edit size={14} />
                                </button>
                                <button 
                                  onClick={() => handleDelete(alc)}
                                  className="p-1.5 text-gray-300 hover:text-danger transition-colors"
                                >
                                   <Trash2 size={14} />
                                </button>
                             </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="mt-12 bg-slate-dark text-white rounded-2xl p-8 flex flex-col md:flex-row items-center justify-between gap-8 shadow-xl">
        <div className="flex gap-5">
           <div className="p-4 bg-primary text-white rounded-2xl h-fit">
              <Target size={32} />
           </div>
           <div>
              <h3 className="text-xl font-bold tracking-tight">Planning Governance Summary</h3>
              <p className="text-white/50 text-sm mt-2 leading-relaxed max-w-xl">
                 Current planned aggregate utilization is at <span className="text-primary font-bold">{aggregatePlanned.toFixed(1)}%</span>. 
                 Recommended corrective action for <span className="text-primary font-bold">{overAllocatedCount}</span> over-allocated 
                 resources, with the highest current load concentrated in <span className="text-white font-bold">{focusDepartment}</span>.
              </p>
           </div>
        </div>
        <button
          onClick={() => {
            setUtilFilter('Over 100%');
            setShowFilters(true);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="whitespace-nowrap px-8 py-3 bg-white text-slate-dark rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-100 transition-all shadow-lg shadow-black/20"
        >
           Review Exceptions
        </button>
      </div>
    </div>
  );
};
