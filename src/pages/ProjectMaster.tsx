import { useState, useEffect, useMemo } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { Badge } from '../components/ui/Badge';
import { projectService, adminService, employeeService, allocationService, clientService } from '../services/api';
import { authService } from '../services/authService';
import { Allocation, Client, CountryDirector, Employee, Project } from '../types';
import { 
  Briefcase, 
  Calendar, 
  Loader2, 
  Plus, 
  ArrowUpRight, 
  Users, 
  Search, 
  Filter, 
  Download,
  Layers,
  LayoutGrid,
  List,
  Eye,
  Edit2,
  CheckCircle2
} from 'lucide-react';
import { cn } from '../lib/utils';
import { downloadCsv } from '../lib/csv';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { SortableHeader } from '../components/ui/SortableHeader';
import { DataTable } from '../components/ui/DataTable';
import { motion } from 'motion/react';
import { Link, useSearchParams } from 'react-router-dom';
import { ProjectForm } from '../components/forms/ProjectForm';
import { isProjectAvailableForPlanning, overlapsDateRange } from '../services/calculations';
import { nextSortConfig, SortConfig, sortByConfig } from '../lib/sorting';
import { PROJECT_STATUSES } from '../constants/statuses';

type ProjectSortKey = 'project' | 'manager' | 'resources' | 'status';

export const ProjectMaster = () => {
  const [view, setView] = useState<'table' | 'card'>('table');
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | undefined>(undefined);
  const [searchParams, setSearchParams] = useSearchParams();
  const [cds, setCds] = useState<CountryDirector[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [projectToClose, setProjectToClose] = useState<Project | null>(null);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [clientFilter, setClientFilter] = useState('All Clients');
  const [statusFilter, setStatusFilter] = useState('All Statuses');
  const [billingFilter, setBillingFilter] = useState('Any');
  const [countryDirectorScopeId, setCountryDirectorScopeId] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig<ProjectSortKey> | null>({ key: 'project', direction: 'asc' });
  const currentDate = new Date().toISOString().split('T')[0];

  const fetchData = async () => {
    setLoading(true);
    try {
      let [data, cdsData, clientsData, empsData, allocsData] = await Promise.all([
        projectService.getAll(),
        adminService.getCountryDirectors(),
        clientService.getAll(),
        employeeService.getAll(),
        allocationService.getAll(),
      ]);
      const user = authService.getCurrentUser();
      if (user?.role === 'ProjectManager') {
        data = data.filter(p => p.managerId === user.id || p.managerId === user.employeeId || p.managerName === user.name);
      }
      setProjects(data);
      setCds(cdsData);
      setClients(clientsData);
      setEmployees(empsData);
      setAllocations(allocsData);
    } catch (error) {
      console.error('Failed to fetch projects', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const client = searchParams.get('client');
    if (!client) return;
    setClientFilter(client);
    setShowFilters(true);
  }, [searchParams]);

  useEffect(() => {
    const directorId = searchParams.get('countryDirectorId');
    if (!directorId || cds.length === 0) return;
    const directorExists = cds.some(director => director.id === directorId);
    if (!directorExists) return;
    setCountryDirectorScopeId(directorId);
    setShowFilters(true);
  }, [cds, searchParams]);

  const directorProjectIds = useMemo(() => {
    if (!countryDirectorScopeId) return null;
    const projectById = new Map<string, Project>(projects.map(project => [project.id, project]));
    const scopedEmployeeIds = new Set(employees
      .filter(employee =>
        employee.primaryCountryDirectorId === countryDirectorScopeId ||
        employee.mappedCountryDirectorIds.includes(countryDirectorScopeId)
      )
      .map(employee => employee.id));
    return new Set(allocations
      .filter(allocation => {
        const project = projectById.get(allocation.projectId);
        return allocation.status === 'Active' &&
          scopedEmployeeIds.has(allocation.employeeId) &&
          !!project &&
          isProjectAvailableForPlanning(project, currentDate, currentDate) &&
          overlapsDateRange(allocation.startDate, allocation.endDate, currentDate, currentDate);
      })
      .map(allocation => allocation.projectId));
  }, [countryDirectorScopeId, projects, employees, allocations, currentDate]);

  useEffect(() => {
    const editId = searchParams.get('edit');
    if (!editId || projects.length === 0) return;
    const project = projects.find(item => item.id === editId);
    if (project) {
      setSelectedProject(project);
      setIsFormOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [projects, searchParams, setSearchParams]);

  const filteredProjects = useMemo(() => {
    const filtered = projects.filter(proj => {
      const projectResources = allocations
        .filter(allocation => allocation.projectId === proj.id && allocation.status === 'Active')
        .map(allocation => employees.find(employee => employee.id === allocation.employeeId))
        .filter(Boolean) as Employee[];
      const matchesSearch = 
        proj.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        proj.projectCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        proj.client.toLowerCase().includes(searchQuery.toLowerCase()) ||
        projectResources.some(employee =>
          employee.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          employee.employeeId.toLowerCase().includes(searchQuery.toLowerCase())
        );

      const matchesClient = clientFilter === 'All Clients' || proj.client === clientFilter;
      const matchesStatus = statusFilter === 'All Statuses' || proj.status === statusFilter;
      const matchesDirector = !directorProjectIds || directorProjectIds.has(proj.id);
      
      let matchesBilling = true;
      if (billingFilter === 'Billable') matchesBilling = proj.billable === true;
      else if (billingFilter === 'Non-Billable') matchesBilling = proj.billable === false;

      return matchesSearch && matchesClient && matchesStatus && matchesDirector && matchesBilling;
    });
    return sortByConfig<Project, ProjectSortKey>(filtered, sortConfig, {
      project: project => `${project.name} ${project.projectCode} ${project.client}`,
      manager: project => project.managerName,
      resources: project => allocations.filter(allocation =>
        allocation.projectId === project.id &&
        allocation.status === 'Active' &&
        isProjectAvailableForPlanning(project, currentDate, currentDate) &&
        overlapsDateRange(allocation.startDate, allocation.endDate, currentDate, currentDate)
      ).length,
      status: project => project.status,
    });
  }, [projects, searchQuery, clientFilter, statusFilter, billingFilter, directorProjectIds, allocations, employees, sortConfig, currentDate]);

  const selectedDirector = cds.find(director => director.id === countryDirectorScopeId);

  const employeesById = useMemo(() => new Map<string, Employee>(employees.map(employee => [employee.id, employee])), [employees]);

  const getProjectResourceRows = (project: Project) => {
    if (!isProjectAvailableForPlanning(project, currentDate, currentDate)) return [];
    return allocations
      .filter(allocation =>
        allocation.projectId === project.id &&
        allocation.status === 'Active' &&
        overlapsDateRange(allocation.startDate, allocation.endDate, currentDate, currentDate)
      )
      .map(allocation => {
        const employee = employeesById.get(allocation.employeeId);
        return employee ? { allocation, employee } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b!.allocation.percentage - a!.allocation.percentage || a!.employee.name.localeCompare(b!.employee.name)) as {
        allocation: Allocation;
        employee: Employee;
      }[];
  };

  const stats = useMemo(() => {
    const active = filteredProjects.filter(p => p.status === 'Active');
    const currentProjectIds = new Set(active
      .filter(project => isProjectAvailableForPlanning(project, currentDate, currentDate))
      .map(project => project.id));
    const currentAllocations = allocations.filter(allocation =>
      allocation.status === 'Active' &&
      currentProjectIds.has(allocation.projectId) &&
      overlapsDateRange(allocation.startDate, allocation.endDate, currentDate, currentDate)
    );
    const staffedProjects = new Set(currentAllocations.map(allocation => allocation.projectId)).size;
    const allocatedFte = currentAllocations.reduce((sum, allocation) => sum + allocation.percentage / 100, 0);

    return [
      { label: 'Active Projects', value: active.length, icon: Briefcase, color: 'text-primary' },
      { label: 'Staffed Projects', value: staffedProjects, icon: Users, color: 'text-heading' },
      { label: 'Allocated FTE', value: allocatedFte.toFixed(1), icon: Users, color: 'text-heading' },
      { label: 'Pipeline', value: filteredProjects.filter(p => p.status === 'Proposed').length, icon: Layers, color: 'text-blue-600' }
    ];
  }, [filteredProjects, allocations, currentDate]);

  const handleAdd = () => {
    setSelectedProject(undefined);
    setIsFormOpen(true);
  };

  const handleEdit = (proj: Project) => {
    setSelectedProject(proj);
    setIsFormOpen(true);
  };

  const handleCloseProject = (proj: Project) => {
    if (proj.status === 'Completed') return;
    setProjectToClose(proj);
  };

  const confirmCloseProject = async () => {
    if (!projectToClose) return;
    await projectService.close(projectToClose.id);
    setProjectToClose(null);
    fetchData();
  };

  const handleExport = () => {
    downloadCsv('project-registry-export.csv', filteredProjects.map(project => {
      const resources = getProjectResourceRows(project);
      return {
        projectCode: project.projectCode,
        name: project.name,
        client: project.client,
        manager: project.managerName,
        startDate: project.startDate,
        endDate: project.endDate,
        status: project.status,
        billable: project.billable ? 'Yes' : 'No',
        assignedResources: resources.length,
        resourceNames: resources.map(row => `${row.employee.name} (${row.allocation.percentage}%)`).join(' | '),
      };
    }));
    adminService.logAction('Export', 'Project Registry', `Exported ${filteredProjects.length} project rows from current filter scope`);
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
        title="Project Registry" 
        subtitle="Full lifecycle oversight of client engagements, delivery milestones, and resource density."
        breadcrumb={['Operations', 'Master Data']}
        actions={
          <div className="flex bg-white border border-border-light rounded-lg p-1 shadow-sm">
            <button 
              onClick={() => setView('table')}
              className={cn(
                "p-2 rounded-md transition-all",
                view === 'table' ? "bg-bg-secondary text-primary shadow-inner" : "text-gray-400 hover:text-heading"
              )}
            >
              <List size={18} />
            </button>
            <button 
              onClick={() => setView('card')}
              className={cn(
                "p-2 rounded-md transition-all",
                view === 'card' ? "bg-bg-secondary text-primary shadow-inner" : "text-gray-400 hover:text-heading"
              )}
            >
              <LayoutGrid size={18} />
            </button>
          </div>
        }
      />

      {/* Quick KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
         {stats.map((stat, i) => (
           <div key={i} className="bg-white border border-border-light rounded-2xl p-4 flex items-center gap-4 shadow-sm">
              <div className={cn("p-2.5 rounded-xl bg-bg-secondary", stat.color)}>
                 <stat.icon size={20} />
              </div>
              <div>
                 <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">{stat.label}</p>
                 <p className="text-xl font-bold text-heading leading-none">{stat.value}</p>
              </div>
           </div>
         ))}
      </div>

      <div className="flex flex-col gap-4 mb-8">
        {selectedDirector && (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-orange-50 border border-primary/20 rounded-2xl px-5 py-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Country Director Project Scope</p>
              <p className="text-sm font-black text-heading mt-1">
                {selectedDirector.name} | {selectedDirector.region} | {filteredProjects.length} associated project{filteredProjects.length === 1 ? '' : 's'}
              </p>
              <p className="text-[10px] font-medium text-slate-500 mt-1">
                Includes projects where at least one active allocation belongs to an employee mapped to this director.
              </p>
            </div>
            <button
              onClick={() => {
                setCountryDirectorScopeId('');
                const nextParams = new URLSearchParams(searchParams);
                nextParams.delete('countryDirectorId');
                setSearchParams(nextParams, { replace: true });
              }}
              className="btn-secondary py-2 px-4 text-[10px] font-bold uppercase tracking-widest"
            >
              Clear Scope
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text" 
              placeholder="Search project code, name or client..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-border-light rounded-xl py-2.5 pl-10 pr-4 text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all shadow-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "btn-secondary py-2 px-4 flex items-center gap-2 font-bold text-[11px]",
                showFilters && "bg-slate-50 border-primary/20 text-primary"
              )}
            >
              <Filter size={14} /> Filters
            </button>
            <button onClick={handleExport} className="btn-secondary py-2 px-4 flex items-center gap-2 font-bold text-[11px]">
               <Download size={14} /> Export
            </button>
            <button 
              onClick={handleAdd}
              className="btn-primary py-2 px-4 flex items-center gap-2 font-bold text-[11px]"
            >
              <Plus size={14} /> Register Project
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-4 p-5 bg-white border border-border-light rounded-2xl animate-in slide-in-from-top-2 duration-200">
            <div className="space-y-1.5 font-bold">
              <label className="text-[10px] text-gray-400 uppercase tracking-widest">Client</label>
              <select 
                value={clientFilter}
                onChange={(e) => setClientFilter(e.target.value)}
                className="w-full bg-bg-secondary border border-border-light rounded-lg px-3 py-2 text-xs outline-none focus:border-primary"
              >
                <option>All Clients</option>
                {clients
                  .filter(client => client.status === 'Active' || projects.some(project => project.client === client.name))
                  .map(client => client.name)
                  .concat(Array.from(new Set(projects.map(project => project.client))).filter(name => !clients.some(client => client.name === name)))
                  .map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5 font-bold">
              <label className="text-[10px] text-gray-400 uppercase tracking-widest">Status</label>
              <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full bg-bg-secondary border border-border-light rounded-lg px-3 py-2 text-xs outline-none focus:border-primary"
              >
                <option>All Statuses</option>
                {PROJECT_STATUSES.map(status => <option key={status}>{status}</option>)}
              </select>
            </div>
            <div className="space-y-1.5 font-bold">
              <label className="text-[10px] text-gray-400 uppercase tracking-widest">Billing</label>
              <select 
                value={billingFilter}
                onChange={(e) => setBillingFilter(e.target.value)}
                className="w-full bg-bg-secondary border border-border-light rounded-lg px-3 py-2 text-xs outline-none focus:border-primary"
              >
                <option>Any</option>
                <option>Billable</option>
                <option>Non-Billable</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-dark/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl animate-in zoom-in-95 duration-200">
            <ProjectForm 
              project={selectedProject} 
              onClose={() => setIsFormOpen(false)} 
              onSave={fetchData}
            />
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!projectToClose}
        title="Close Project"
        description={`${projectToClose?.name || 'This project'} will be marked as Completed and active allocations will be ended today. Historical staffing and timesheet records will remain available.`}
        confirmLabel="Close Project"
        variant="primary"
        onConfirm={confirmCloseProject}
        onCancel={() => setProjectToClose(null)}
      />

      {view === 'table' ? (
        <DataTable
          header={(
            <tr>
              <SortableHeader<ProjectSortKey> label="Project & Client" sortKey="project" sortConfig={sortConfig} onSort={(key) => setSortConfig(current => nextSortConfig(current, key))} />
              <SortableHeader<ProjectSortKey> label="Project Manager" sortKey="manager" sortConfig={sortConfig} onSort={(key) => setSortConfig(current => nextSortConfig(current, key))} />
              <SortableHeader<ProjectSortKey> label="Resource Allocation" sortKey="resources" sortConfig={sortConfig} onSort={(key) => setSortConfig(current => nextSortConfig(current, key))} />
              <SortableHeader<ProjectSortKey> label="Status" sortKey="status" sortConfig={sortConfig} onSort={(key) => setSortConfig(current => nextSortConfig(current, key))} />
              <th className="py-4 px-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Actions</th>
            </tr>
          )}
        >
              {filteredProjects.map((proj) => {
                const resourceRows = getProjectResourceRows(proj);
                const visibleResources = resourceRows.slice(0, 4);
                const remainingCount = Math.max(0, resourceRows.length - visibleResources.length);

                return (
                  <tr key={proj.id} className="hover:bg-bg-secondary transition-colors group">
                    <td className="py-5 px-6">
                      <div className="flex flex-col min-w-0">
                        <Link to={`/projects/${proj.id}`} className="text-sm font-bold text-heading hover:text-primary transition-colors truncate">
                          {proj.name}
                        </Link>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-body/60 font-mono tracking-tight font-bold">{proj.projectCode}</span>
                          <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                          <span className="text-[10px] text-gray-400 font-bold uppercase">{proj.client}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-5 px-6">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center text-[8px] font-bold text-slate-500 uppercase">
                           {proj.managerName.split(' ').map(n => n[0]).join('')}
                        </div>
                        <span className="text-xs text-heading font-medium">{proj.managerName}</span>
                      </div>
                    </td>
                    <td className="py-5 px-6 min-w-[360px]">
                      {resourceRows.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {visibleResources.map(({ allocation, employee }) => (
                            <Link
                              key={allocation.id}
                              to={`/employees/${employee.id}`}
                              className="inline-flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-2.5 py-1.5 hover:border-primary/30 hover:bg-orange-50/70 transition-all"
                              title={`${employee.name} is allocated ${allocation.percentage}% on ${proj.name}`}
                            >
                              <span className="max-w-[130px] truncate text-[10px] font-bold text-heading">{employee.name}</span>
                              <span className={cn(
                                "text-[10px] font-black tabular-nums",
                                allocation.percentage >= 80 ? "text-primary" : "text-slate-500"
                              )}>
                                {allocation.percentage}%
                              </span>
                            </Link>
                          ))}
                          {remainingCount > 0 && (
                            <Link
                              to={`/projects/${proj.id}`}
                              className="inline-flex items-center rounded-xl border border-primary/20 bg-orange-50 px-2.5 py-1.5 text-[10px] font-bold text-primary hover:bg-primary hover:text-white transition-all"
                            >
                              +{remainingCount} more
                            </Link>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center rounded-xl border border-dashed border-slate-200 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                          No current resources
                        </span>
                      )}
                    </td>
                    <td className="py-5 px-6">
                      <div className="flex flex-col gap-1">
                        <Badge variant={proj.status === 'Active' ? 'success' : proj.status === 'Proposed' ? 'neutral' : 'warning'}>
                          {proj.status}
                        </Badge>
                        <span className="text-[9px] font-bold text-gray-400 px-1 uppercase tracking-tighter">
                          {proj.billable ? 'Billable' : 'Non-billable'}
                        </span>
                      </div>
                    </td>
                    <td className="py-5 px-6 text-right">
                      <div className="flex items-center justify-end gap-1 font-bold">
                        <Link 
                          to={`/projects/${proj.id}`}
                          className="p-2 text-gray-400 hover:text-primary hover:bg-orange-50 rounded-lg transition-all"
                        >
                          <Eye size={16} />
                        </Link>
                        <button 
                          onClick={() => handleEdit(proj)}
                          className="p-2 text-gray-400 hover:text-primary hover:bg-orange-50 rounded-lg transition-all"
                          title="Edit Project"
                        >
                          <Edit2 size={16} />
                        </button>
                        {proj.status !== 'Completed' && (
                          <button
                            onClick={() => handleCloseProject(proj)}
                            className="p-2 text-gray-400 hover:text-success hover:bg-green-50 rounded-lg transition-all"
                            title="Close Project"
                          >
                            <CheckCircle2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
        </DataTable>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredProjects.map((project, idx) => {
            const resourceRows = getProjectResourceRows(project);
            const visibleResources = resourceRows.slice(0, 5);

            return (
            <motion.div 
              key={project.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="group bg-white border border-border-light rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 relative"
            >
              {project.status === 'Active' && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-primary shadow-[0_0_10px_rgba(239,125,0,0.4)]" />
              )}

              <div className="p-6">
                <div className="flex justify-between items-start mb-6">
                  <div className="p-2.5 bg-bg-secondary group-hover:bg-orange-50 rounded-xl text-slate-dark group-hover:text-primary transition-colors border border-border-light group-hover:border-primary/20">
                     <Layers size={20} />
                  </div>
                  <Badge variant={project.status === 'Active' ? 'success' : project.status === 'Proposed' ? 'neutral' : 'warning'}>
                    {project.status}
                  </Badge>
                </div>

                <div className="mb-8">
                  <Link to={`/projects/${project.id}`} className="text-lg font-bold text-heading group-hover:text-primary transition-colors leading-tight mb-1 block">
                    {project.name}
                  </Link>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{project.client} • {project.projectCode}</p>
                </div>

                <div className="grid grid-cols-2 gap-6 mb-8 py-5 border-y border-gray-50">
                  <div className="space-y-1">
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                      <Calendar size={10} /> Schedule
                    </span>
                    <p className="text-xs font-bold text-heading">{project.startDate}</p>
                    <p className="text-[10px] text-body opacity-60 font-mono italic">To {project.endDate}</p>
                  </div>
                  <div className="space-y-1 text-right">
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest flex items-center justify-end gap-1.5">
                      <Users size={10} /> Current Team
                    </span>
                    <p className="text-xs font-bold text-heading">{resourceRows.length} Resource{resourceRows.length === 1 ? '' : 's'}</p>
                  </div>
                </div>

                <div className="space-y-2 mb-6">
                  <div className="flex items-center justify-between">
                     <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Resource Allocation</p>
                     <Link to={`/projects/${project.id}`} className="text-[9px] font-bold uppercase tracking-widest text-primary hover:underline">
                       View all
                     </Link>
                  </div>
                  {visibleResources.length > 0 ? visibleResources.map(({ allocation, employee }) => (
                    <Link
                      key={allocation.id}
                      to={`/employees/${employee.id}`}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 hover:border-primary/30 hover:bg-orange-50/70 transition-all"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-heading truncate">{employee.name}</p>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 truncate">{allocation.roleOnProject || employee.designation}</p>
                      </div>
                      <span className="text-xs font-black text-primary tabular-nums">{allocation.percentage}%</span>
                    </Link>
                  )) : (
                    <div className="rounded-xl border border-dashed border-slate-200 px-3 py-5 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">No current resources</p>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between mt-8 pt-4 border-t border-gray-50">
                   <Link to={`/projects/${project.id}`} className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-primary hover:underline group/btn">
                      Governance <ArrowUpRight size={14} className="group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform" />
                   </Link>
                   <div className="flex items-center gap-2">
                       <button 
                         onClick={() => handleEdit(project)}
                         className="p-2 text-gray-400 hover:text-primary transition-colors"
                         title="Edit Project"
                       >
                         <Edit2 size={14} />
                       </button>
                       {project.status !== 'Completed' && (
                         <button
                           onClick={() => handleCloseProject(project)}
                           className="p-2 text-gray-400 hover:text-success transition-colors"
                           title="Close Project"
                         >
                           <CheckCircle2 size={14} />
                         </button>
                       )}
                      <div className={cn("w-1.5 h-1.5 rounded-full", project.billable ? "bg-success" : "bg-gray-300")}></div>
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">{project.billable ? 'Billable' : 'Non-billable'}</span>
                   </div>
                </div>
              </div>
            </motion.div>
            );
          })}

          <button 
            onClick={handleAdd}
            className="h-full min-h-[380px] border-2 border-dashed border-border-light rounded-2xl flex flex-col items-center justify-center gap-4 text-gray-400 hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-all group p-8 text-center"
          >
             <div className="w-16 h-16 rounded-2xl bg-bg-secondary flex items-center justify-center group-hover:scale-110 group-hover:bg-white group-hover:shadow-lg transition-all duration-300">
                <Plus size={32} />
             </div>
             <div>
               <p className="text-sm font-bold text-heading group-hover:text-primary mb-1 transition-colors">Register Newstream</p>
               <p className="text-[10px] text-body/60 font-medium leading-relaxed">Initiate a new client engagement with standard governance.</p>
             </div>
          </button>
        </div>
      )}
    </div>
  );
};
