import { useMemo, useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowUpRight,
  Briefcase,
  Building2,
  Loader2,
  Pencil,
  Plus,
  Search,
  Save,
  Trash2,
  Users,
  WalletCards,
  X,
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Badge } from '../components/ui/Badge';
import { allocationService, adminService, clientService, employeeService, projectService } from '../services/api';
import { authService } from '../services/authService';
import { Allocation, Client, Employee, Project } from '../types';
import { isProjectAvailableForPlanning, overlapsDateRange } from '../services/calculations';
import { cn } from '../lib/utils';

interface ClientScopeRow {
  clientId: string;
  client: string;
  industry: string;
  status: Client['status'];
  countryDirectorIds: string[];
  people: Employee[];
  projects: Project[];
  allocations: Allocation[];
  allocatedFte: number;
  billableFte: number;
  avgPlanned: number;
}

export const ClientPortfolio = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [loading] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [clientNotice, setClientNotice] = useState('');

  const currentUser = authService.getCurrentUser();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [directors, setDirectors] = useState<any[]>([]);
  const [industries, setIndustries] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      employeeService.getAll(),
      projectService.getAll(),
      allocationService.getAll(),
      clientService.getAll(),
      adminService.getCountryDirectors(),
      adminService.getIndustries(),
    ]).then(([emps, projs, allocs, cls, dirs, inds]) => {
      setEmployees(emps);
      setProjects(projs);
      setAllocations(allocs);
      setClients(cls);
      setDirectors(dirs);
      setIndustries(inds);
    });
  }, []);
  const requestedDirectorId = searchParams.get('countryDirectorId') || '';
  const requestedClientName = searchParams.get('client') || '';
  const effectiveDirectorId = currentUser?.role === 'CountryDirector'
    ? currentUser.cdId || requestedDirectorId
    : requestedDirectorId;
  const selectedDirector = directors.find(director => director.id === effectiveDirectorId);
  const canManageClients = currentUser?.role === 'Admin' || currentUser?.role === 'HR';

  const currentDate = new Date().toISOString().split('T')[0];

  const scopedRows = useMemo<ClientScopeRow[]>(() => {
    const projectById = new Map<string, Project>(projects.map(project => [project.id, project]));
    const employeeById = new Map<string, Employee>(employees.map(employee => [employee.id, employee]));
    const clientById = new Map<string, Client>(clients.map(client => [client.id, client]));
    const clientByName = new Map<string, Client>(clients.map(client => [client.name.toLowerCase(), client]));
    const scopedEmployeeIds = effectiveDirectorId
      ? new Set(employees
          .filter(employee =>
            employee.status === 'Active' &&
            (employee.primaryCountryDirectorId === effectiveDirectorId || employee.mappedCountryDirectorIds.includes(effectiveDirectorId))
          )
          .map(employee => employee.id))
      : new Set(employees.filter(employee => employee.status === 'Active').map(employee => employee.id));

    const grouped = new Map<string, {
      clientId: string;
      client: string;
      industry: string;
      status: Client['status'];
      countryDirectorIds: string[];
      people: Map<string, Employee>;
      projects: Map<string, Project>;
      allocations: Allocation[];
      allocatedFte: number;
      billableFte: number;
    }>();

    clients
      .filter(client => client.status === 'Active')
      .filter(client => !effectiveDirectorId || client.countryDirectorIds.includes(effectiveDirectorId))
      .forEach(client => {
        grouped.set(client.id, {
          clientId: client.id,
          client: client.name,
          industry: client.industry,
          status: client.status,
          countryDirectorIds: client.countryDirectorIds,
          people: new Map<string, Employee>(),
          projects: new Map<string, Project>(),
          allocations: [],
          allocatedFte: 0,
          billableFte: 0,
        });
      });

    allocations
      .filter(allocation => {
        const project = projectById.get(allocation.projectId);
        return allocation.status === 'Active' &&
          scopedEmployeeIds.has(allocation.employeeId) &&
          !!project &&
          isProjectAvailableForPlanning(project, currentDate, currentDate) &&
          overlapsDateRange(allocation.startDate, allocation.endDate, currentDate, currentDate);
      })
      .forEach(allocation => {
        const project = projectById.get(allocation.projectId);
        const employee = employeeById.get(allocation.employeeId);
        if (!project || !employee) return;

        const masterClient = (project.clientId ? clientById.get(project.clientId) : undefined) ||
          clientByName.get(project.client.toLowerCase());
        const groupKey = masterClient?.id || project.client;
        const row = grouped.get(groupKey) || {
          clientId: masterClient?.id || project.client,
          client: project.client,
          industry: masterClient?.industry || 'Unclassified',
          status: masterClient?.status || 'Active',
          countryDirectorIds: masterClient?.countryDirectorIds || [],
          people: new Map<string, Employee>(),
          projects: new Map<string, Project>(),
          allocations: [],
          allocatedFte: 0,
          billableFte: 0,
        };
        row.people.set(employee.id, employee);
        row.projects.set(project.id, project);
        row.allocations.push(allocation);
        row.allocatedFte += allocation.percentage / 100;
        if (allocation.billable && project.billable) row.billableFte += allocation.percentage / 100;
        grouped.set(groupKey, row);
      });

    return Array.from(grouped.values())
      .map(row => {
        const people = Array.from(row.people.values());
        const getProjectFte = (projectId: string) =>
          row.allocations
            .filter(allocation => allocation.projectId === projectId)
            .reduce((sum, allocation) => sum + allocation.percentage / 100, 0);
        return {
          clientId: row.clientId,
          client: row.client,
          industry: row.industry,
          status: row.status,
          countryDirectorIds: row.countryDirectorIds,
          people,
          projects: Array.from(row.projects.values()).sort((a, b) => getProjectFte(b.id) - getProjectFte(a.id) || a.name.localeCompare(b.name)),
          allocations: row.allocations,
          allocatedFte: Number(row.allocatedFte.toFixed(1)),
          billableFte: Number(row.billableFte.toFixed(1)),
          avgPlanned: people.length
            ? Math.round(people.reduce((sum, employee) => sum + employee.plannedUtilization, 0) / people.length)
            : 0,
        };
      })
      .sort((a, b) => b.allocatedFte - a.allocatedFte || b.people.length - a.people.length || a.client.localeCompare(b.client));
  }, [allocations, clients, currentDate, effectiveDirectorId, employees, projects]);

  const filteredRows = useMemo(() => {
    const query = (searchQuery.trim() || requestedClientName).toLowerCase();
    if (!query) return scopedRows;
    return scopedRows.filter(row =>
      row.client.toLowerCase().includes(query) ||
      row.projects.some(project => project.name.toLowerCase().includes(query) || project.projectCode.toLowerCase().includes(query)) ||
      row.people.some(employee => employee.name.toLowerCase().includes(query) || employee.employeeId.toLowerCase().includes(query))
    );
  }, [requestedClientName, scopedRows, searchQuery]);

  const totals = useMemo(() => {
    const peopleIds = new Set<string>();
    const projectIds = new Set<string>();
    filteredRows.forEach(row => {
      row.people.forEach(employee => peopleIds.add(employee.id));
      row.projects.forEach(project => projectIds.add(project.id));
    });
    return {
      clients: filteredRows.length,
      people: peopleIds.size,
      projects: projectIds.size,
      allocatedFte: filteredRows.reduce((sum, row) => sum + row.allocatedFte, 0),
      billableFte: filteredRows.reduce((sum, row) => sum + row.billableFte, 0),
    };
  }, [filteredRows]);

  const saveClient = async () => {
    if (!editingClient) return;
    if (!editingClient.name.trim()) {
      setClientNotice('Client name is required.');
      return;
    }
    await clientService.save(editingClient);
    setClientNotice(`${editingClient.name.trim()} saved.`);
    setEditingClient(null);
  };

  const deactivateClient = async (client: Client) => {
    try {
      await clientService.delete(client.id);
      setClientNotice(`${client.name} was deactivated.`);
    } catch {
      setClientNotice(`${client.name} still has active projects.`);
    }
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
        title="Client Portfolio"
        subtitle="Client-level delivery footprint across active projects, mapped people, and allocated FTE."
        breadcrumb={['Operations', 'Client Scope']}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {selectedDirector && (
              <button
                onClick={() => {
                  const next = new URLSearchParams(searchParams);
                  next.delete('countryDirectorId');
                  setSearchParams(next, { replace: true });
                }}
                className="btn-secondary py-2 px-4 text-[10px] font-bold uppercase tracking-widest"
              >
                Clear Director Scope
              </button>
            )}
            {canManageClients && (
              <button
                onClick={() => setEditingClient({
                  id: `client-${Date.now()}`,
                  name: '',
                  industry: 'Unclassified',
                  accountOwnerId: undefined,
                  countryDirectorIds: selectedDirector ? [selectedDirector.id] : [],
                  status: 'Active',
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                })}
                className="btn-primary py-2 px-4 text-[10px] font-bold uppercase tracking-widest inline-flex items-center gap-2"
              >
                <Plus size={14} /> Add Client
              </button>
            )}
          </div>
        }
      />

      {clientNotice && (
        <div className="mb-6 rounded-2xl border border-primary/20 bg-orange-50 px-5 py-4 flex items-start justify-between gap-4">
          <p className="text-xs font-bold text-heading">{clientNotice}</p>
          <button onClick={() => setClientNotice('')} className="text-slate-400 hover:text-heading">
            <X size={16} />
          </button>
        </div>
      )}

      {selectedDirector && (
        <div className="mb-6 rounded-2xl border border-primary/20 bg-orange-50 px-5 py-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Country Director Scope</p>
          <p className="text-sm font-black text-heading mt-1">{selectedDirector.name} | {selectedDirector.region}</p>
          <p className="text-[10px] font-medium text-slate-500 mt-1">
            Includes clients with at least one current active project allocation from employees mapped to this director.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {[
          { label: 'Active Clients', value: totals.clients, icon: Building2 },
          { label: 'Projects', value: totals.projects, icon: Briefcase },
          { label: 'People', value: totals.people, icon: Users },
          { label: 'Allocated FTE', value: totals.allocatedFte.toFixed(1), icon: WalletCards },
          { label: 'Billable FTE', value: totals.billableFte.toFixed(1), icon: WalletCards },
        ].map(metric => (
          <div key={metric.label} className="bg-white border border-border-light rounded-2xl p-4 flex items-center gap-4 shadow-sm">
            <div className="p-2.5 rounded-xl bg-bg-secondary text-primary">
              <metric.icon size={18} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">{metric.label}</p>
              <p className="text-xl font-black text-heading leading-none tabular-nums">{metric.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Search client, project, or employee..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="w-full bg-white border border-border-light rounded-xl py-2.5 pl-10 pr-4 text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all shadow-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {filteredRows.map(row => {
          const topProjects = row.projects.slice(0, 4);
          const projectFte = (projectId: string) =>
            row.allocations
              .filter(allocation => allocation.projectId === projectId)
              .reduce((sum, allocation) => sum + allocation.percentage / 100, 0);
          const topPeople = row.people
            .slice()
            .sort((a, b) => b.plannedUtilization - a.plannedUtilization || a.name.localeCompare(b.name))
            .slice(0, 5);
          const billableShare = row.allocatedFte > 0 ? Math.round((row.billableFte / row.allocatedFte) * 100) : 0;

          return (
            <div key={row.client} className="bg-white border border-border-light rounded-3xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-border-light flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Client</p>
                  <h3 className="text-lg font-black text-heading mt-1">{row.client}</h3>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-1">{row.industry}</p>
                </div>
                <div className="flex items-center gap-2">
                  {canManageClients && (
                    <>
                      <button
                        onClick={() => setEditingClient(clients.find(client => client.id === row.clientId) || null)}
                        className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-heading hover:border-primary hover:text-primary transition-all disabled:opacity-40"
                        disabled={!clients.some(client => client.id === row.clientId)}
                      >
                        <Pencil size={12} /> Edit
                      </button>
                      <button
                        onClick={() => {
                          const client = clients.find(item => item.id === row.clientId);
                          if (client) deactivateClient(client);
                        }}
                        className="inline-flex items-center gap-1 rounded-xl border border-rose-100 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-rose-500 hover:bg-rose-50 transition-all disabled:opacity-40"
                        disabled={!clients.some(client => client.id === row.clientId)}
                      >
                        <Trash2 size={12} /> Deactivate
                      </button>
                    </>
                  )}
                  <Link
                    to={`/projects?client=${encodeURIComponent(row.client)}${effectiveDirectorId ? `&countryDirectorId=${effectiveDirectorId}` : ''}`}
                    className="inline-flex items-center gap-1 rounded-xl bg-orange-50 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-primary hover:bg-primary hover:text-white transition-all"
                  >
                    Projects <ArrowUpRight size={12} />
                  </Link>
                </div>
              </div>

              <div className="p-5 space-y-5">
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: 'People', value: row.people.length },
                    { label: 'Projects', value: row.projects.length },
                    { label: 'Alloc FTE', value: row.allocatedFte.toFixed(1) },
                    { label: 'Billable', value: `${billableShare}%` },
                  ].map(metric => (
                    <div key={metric.label} className="rounded-2xl bg-slate-50 border border-slate-100 p-3">
                      <p className="text-[8px] font-bold uppercase tracking-widest text-slate-400">{metric.label}</p>
                      <p className="text-base font-black text-heading mt-1 tabular-nums">{metric.value}</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[10px] font-black uppercase tracking-widest text-heading">Active Projects</p>
                      <Badge variant="neutral">{row.projects.length}</Badge>
                    </div>
                    <div className="space-y-2">
                      {topProjects.map(project => (
                        <Link
                          key={project.id}
                          to={`/projects/${project.id}`}
                          className="block rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2.5 hover:border-primary/30 hover:bg-orange-50/50 transition-all"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-heading truncate">{project.name}</p>
                              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">{project.projectCode}</p>
                            </div>
                            <span className="text-[10px] font-black text-heading tabular-nums">{projectFte(project.id).toFixed(1)} FTE</span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[10px] font-black uppercase tracking-widest text-heading">Mapped Resources</p>
                      <Badge variant={row.avgPlanned > 100 ? 'danger' : 'neutral'}>{row.avgPlanned}% Avg</Badge>
                    </div>
                    <div className="space-y-2">
                      {topPeople.map(employee => (
                        <Link
                          key={employee.id}
                          to={`/employees/${employee.id}`}
                          className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2.5 hover:border-primary/30 hover:bg-orange-50/50 transition-all"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-heading truncate">{employee.name}</p>
                            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">{employee.employeeId}</p>
                          </div>
                          <span className={cn(
                            "text-[10px] font-black tabular-nums",
                            employee.plannedUtilization > 100 ? "text-danger" : "text-heading"
                          )}>
                            {employee.plannedUtilization}%
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {filteredRows.length === 0 && (
          <div className="xl:col-span-2 rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center">
            <p className="text-sm font-bold text-heading">No clients found for this scope.</p>
            <p className="text-xs text-slate-400 mt-2">Try clearing the search or director scope.</p>
          </div>
        )}
      </div>

      {editingClient && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-3xl bg-white border border-border-light shadow-2xl overflow-hidden">
            <div className="px-6 py-5 bg-slate-dark text-white flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black">{clients.some(client => client.id === editingClient.id) ? 'Edit Client Master' : 'Add Client Master'}</h3>
                <p className="text-[10px] uppercase tracking-widest text-white/50 font-bold">Controls project grouping and client portfolio cards</p>
              </div>
              <button onClick={() => setEditingClient(null)} className="p-2 rounded-xl hover:bg-white/10 transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-heading">Client Name</label>
                  <input
                    value={editingClient.name}
                    onChange={(event) => setEditingClient({ ...editingClient, name: event.target.value })}
                    className="w-full rounded-xl border border-border-light bg-slate-50 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    placeholder="Example Client"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-heading">Industry</label>
                  <select
                    value={editingClient.industry}
                    onChange={(event) => setEditingClient({ ...editingClient, industry: event.target.value })}
                    className="w-full rounded-xl border border-border-light bg-slate-50 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  >
                    {Array.from(new Set([
                      ...industries.map(industry => industry.name),
                      editingClient.industry,
                    ].filter(Boolean))).map(industry => (
                      <option key={industry}>{industry}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-heading">Country Director Scope</label>
                  <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Multiple allowed</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {directors.map(director => {
                    const checked = editingClient.countryDirectorIds.includes(director.id);
                    return (
                      <label
                        key={director.id}
                        className={cn(
                          "rounded-xl border p-3 cursor-pointer transition-all",
                          checked ? "border-primary bg-orange-50 text-primary" : "border-border-light bg-slate-50 text-heading hover:border-primary/30"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            const nextIds = checked
                              ? editingClient.countryDirectorIds.filter(id => id !== director.id)
                              : [...editingClient.countryDirectorIds, director.id];
                            setEditingClient({ ...editingClient, countryDirectorIds: nextIds });
                          }}
                          className="sr-only"
                        />
                        <span className="block text-xs font-black">{director.name}</span>
                        <span className="block text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-1">{director.region}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border-light">
                <button onClick={() => setEditingClient(null)} className="btn-secondary py-2.5 px-5 text-xs font-bold">
                  Cancel
                </button>
                <button onClick={saveClient} className="btn-primary py-2.5 px-5 text-xs font-bold inline-flex items-center gap-2">
                  <Save size={14} /> Save Client
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
