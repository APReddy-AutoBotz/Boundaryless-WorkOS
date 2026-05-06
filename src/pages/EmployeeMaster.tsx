import { PageHeader } from '../components/ui/PageHeader';
import { Badge } from '../components/ui/Badge';
import { employeeService, adminService, allocationService } from '../services/api';
import { Employee, CountryDirector, Allocation, SystemSettings } from '../types';
import { 
  Eye, 
  Edit2, 
  Loader2, 
  LayoutGrid, 
  List, 
  Search,
  UserPlus,
  ArrowUpRight,
  User,
  UserX,
  Filter,
  Download,
  Info,
  Flame,
  CalendarRange
} from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { EmployeeForm } from '../components/forms/EmployeeForm';
import { AllocationForm } from '../components/forms/AllocationForm';
import { cn } from '../lib/utils';
import { downloadCsv } from '../lib/csv';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { SortableHeader } from '../components/ui/SortableHeader';
import { DataTable } from '../components/ui/DataTable';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { nextSortConfig, SortConfig, sortByConfig } from '../lib/sorting';
import { EMPLOYEE_STATUSES } from '../constants/statuses';
import { authService } from '../services/authService';
import { CapacityCard } from '../components/employee/CapacityCard';
import { AllocationTimeline } from '../components/employee/AllocationTimeline';
import { UtilizationHeatmap } from '../components/employee/UtilizationHeatmap';
import { isUtilizationEligibleEmployee } from '../services/calculations';

type EmployeeSortKey = 'employee' | 'designation' | 'director' | 'utilization' | 'projects' | 'status';
type ViewMode = 'table' | 'cards' | 'timeline' | 'heatmap';

export const EmployeeMaster = () => {
  const currentUser = authService.getCurrentUser();
  const defaultView: ViewMode = currentUser?.role === 'CountryDirector' ? 'cards' : 'table';
  const [view, setView] = useState<ViewMode>(defaultView);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editAllocation, setEditAllocation] = useState<Allocation | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | undefined>(undefined);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [cds, setCds] = useState<CountryDirector[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [settings, setSettings] = useState<SystemSettings>({ utilizationThresholdHigh: 100, utilizationThresholdLow: 50, expectedWeeklyHours: 40, benchThreshold: 20, timesheetPolicyMaxHours: 60, currency: 'GBP' });
  const [departmentOptions, setDepartmentOptions] = useState<string[]>([]);
  const [countryOptions, setCountryOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [employeeToDeactivate, setEmployeeToDeactivate] = useState<Employee | null>(null);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('All Departments');
  const [countryFilter, setCountryFilter] = useState('All Countries');
  const [statusFilter, setStatusFilter] = useState('All Statuses');
  const [assignFilter, setAssignFilter] = useState('All Assignments');
  const [utilFilter, setUtilFilter] = useState('Any');
  const [cdFilter, setCdFilter] = useState('All Directors');
  const [sortConfig, setSortConfig] = useState<SortConfig<EmployeeSortKey> | null>({ key: 'employee', direction: 'asc' });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [empData, cdData, allocData, depts, countries, setts] = await Promise.all([
        employeeService.getAll(),
        adminService.getCountryDirectors(),
        allocationService.getAll(),
        adminService.getDepartments(),
        adminService.getCountries(),
        adminService.getSettings(),
      ]);
      setEmployees(empData);
      setCds(cdData);
      setAllocations(allocData);
      setSettings(setts);
      setDepartmentOptions(Array.from(new Set([
        ...depts.map(item => item.name),
        ...empData.map(employee => employee.department),
      ])).sort((a, b) => a.localeCompare(b)));
      setCountryOptions(Array.from(new Set([
        ...countries.map(item => item.name),
        ...empData.map(employee => employee.country),
      ])).sort((a, b) => a.localeCompare(b)));
    } catch (error) {
      console.error('Failed to fetch data', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const directorId = searchParams.get('countryDirectorId');
    if (!directorId || cds.length === 0) return;
    const directorExists = cds.some(director => director.id === directorId);
    if (!directorExists) return;
    setCdFilter(directorId);
    setShowFilters(true);
  }, [cds, searchParams]);

  useEffect(() => {
    const editId = searchParams.get('edit');
    if (!editId || employees.length === 0) return;
    const employee = employees.find(item => item.id === editId);
    if (employee) {
      setSelectedEmployee(employee);
      setIsFormOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [employees, searchParams, setSearchParams]);

  const getCDName = (id: string) => cds.find(c => c.id === id)?.name || id;

  const filteredEmployees = useMemo(() => {
    const filtered = employees.filter(emp => {
      const matchesSearch = 
        emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.employeeId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.designation.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesDept = deptFilter === 'All Departments' || emp.department === deptFilter;
      const matchesCountry = countryFilter === 'All Countries' || emp.country === countryFilter;
      const matchesStatus = statusFilter === 'All Statuses' || emp.status === statusFilter;
      
      let matchesAssign = true;
      const utilizationEligible = isUtilizationEligibleEmployee(emp, allocations);
      if (assignFilter === 'Assigned') matchesAssign = utilizationEligible && emp.activeProjectCount > 0;
      else if (assignFilter === 'Bench') matchesAssign = utilizationEligible && emp.activeProjectCount === 0;

      const matchesCd = cdFilter === 'All Directors' || 
        emp.primaryCountryDirectorId === cdFilter || 
        emp.mappedCountryDirectorIds.includes(cdFilter);

      let matchesUtil = true;
      if (utilFilter === 'Over 100%') matchesUtil = utilizationEligible && emp.plannedUtilization > 100;
      else if (utilFilter === '80-100%') matchesUtil = utilizationEligible && emp.plannedUtilization >= 80 && emp.plannedUtilization <= 100;
      else if (utilFilter === 'Under 80%') matchesUtil = utilizationEligible && emp.plannedUtilization < 80;
      else if (utilFilter === 'Excluded') matchesUtil = !utilizationEligible;

      return matchesSearch && matchesDept && matchesCountry && matchesStatus && matchesAssign && matchesCd && matchesUtil;
    });
    return sortByConfig<Employee, EmployeeSortKey>(filtered, sortConfig, {
      employee: emp => emp.name,
      designation: emp => `${emp.designation} ${emp.department}`,
      director: emp => getCDName(emp.primaryCountryDirectorId),
      utilization: emp => isUtilizationEligibleEmployee(emp, allocations) ? emp.plannedUtilization : -1,
      projects: emp => emp.activeProjectCount,
      status: emp => emp.status,
    });
  }, [employees, allocations, searchQuery, deptFilter, countryFilter, statusFilter, assignFilter, utilFilter, cdFilter, sortConfig, cds]);

  const selectedDirector = cds.find(director => director.id === cdFilter);

  const handleAdd = () => {
    setSelectedEmployee(undefined);
    setIsFormOpen(true);
  };

  const handleEdit = (emp: Employee) => {
    setSelectedEmployee(emp);
    setIsFormOpen(true);
  };

  const handleDeactivate = (emp: Employee) => {
    if (emp.status === 'Exited') return;
    setEmployeeToDeactivate(emp);
  };

  const confirmDeactivate = async () => {
    if (!employeeToDeactivate) return;
    await employeeService.delete(employeeToDeactivate.id);
    setEmployeeToDeactivate(null);
    fetchData();
  };

  const handleExport = () => {
    downloadCsv('employee-master-export.csv', filteredEmployees.map(emp => ({
      employeeId: emp.employeeId,
      name: emp.name,
      email: emp.email,
      designation: emp.designation,
      department: emp.department,
      country: emp.country,
      primaryCountryDirector: getCDName(emp.primaryCountryDirectorId),
      mappedCountryDirectors: emp.mappedCountryDirectorIds.map(getCDName).join(' | '),
      status: emp.status,
      utilizationEligible: isUtilizationEligibleEmployee(emp, allocations) ? 'Yes' : 'No',
      plannedUtilization: emp.plannedUtilization,
      actualUtilization: emp.actualUtilization,
      activeProjectCount: emp.activeProjectCount,
    })));
    adminService.logAction('Export', 'Employee Master', `Exported ${filteredEmployees.length} employee rows from current filter scope`);
  };

  if (loading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={40} />
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-500 pb-12">
      <PageHeader 
        title="Employee Master" 
        subtitle="Manage global consultant directory, multi-director mappings, and utilization benchmarks."
        breadcrumb={['Operations', 'Master Data']}
        actions={
          <div className="flex bg-white border border-border-light rounded-lg p-1 shadow-sm gap-0.5" role="group" aria-label="View mode">
            {([
              { key: 'table', icon: <List size={16} />, label: 'Table' },
              { key: 'cards', icon: <LayoutGrid size={16} />, label: 'Capacity Cards' },
              { key: 'timeline', icon: <CalendarRange size={16} />, label: 'Timeline' },
              { key: 'heatmap', icon: <Flame size={16} />, label: 'Heatmap' },
            ] as const).map(v => (
              <button
                key={v.key}
                onClick={() => setView(v.key)}
                title={v.label}
                aria-label={v.label}
                aria-pressed={view === v.key}
                className={cn(
                  'p-2 rounded-md transition-all',
                  view === v.key ? 'bg-bg-secondary text-primary shadow-inner' : 'text-gray-400 hover:text-heading'
                )}
              >
                {v.icon}
              </button>
            ))}
          </div>
        }
      />

      <div className="flex flex-col gap-4 mb-8">
        {selectedDirector && (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-orange-50 border border-primary/20 rounded-2xl px-5 py-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Country Director Scope</p>
              <p className="text-sm font-black text-heading mt-1">
                {selectedDirector.name} | {selectedDirector.region} | {filteredEmployees.length} mapped employee{filteredEmployees.length === 1 ? '' : 's'}
              </p>
              <p className="text-[10px] font-medium text-slate-500 mt-1">
                Includes employees where this director is primary or one of multiple mapped directors.
              </p>
            </div>
            <button
              onClick={() => {
                setCdFilter('All Directors');
                setSearchParams({}, { replace: true });
              }}
              className="btn-secondary py-2 px-4 text-[10px] font-bold uppercase tracking-widest"
            >
              Clear Scope
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="relative flex-1 max-w-xl flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input 
                type="text" 
                placeholder="Search by name, ID or designation..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-border-light rounded-xl py-2.5 pl-10 pr-4 text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all shadow-sm"
              />
            </div>
            {view !== 'table' && (
              <select
                value={`${sortConfig?.key || 'employee'}-${sortConfig?.direction || 'asc'}`}
                onChange={(e) => {
                  const [key, direction] = e.target.value.split('-');
                  setSortConfig({ key: key as EmployeeSortKey, direction: direction as 'asc' | 'desc' });
                }}
                className="bg-white border border-border-light rounded-xl py-2.5 px-3 text-xs outline-none focus:border-primary shadow-sm min-w-[200px]"
              >
                <option value="employee-asc">Sort: Name (A-Z)</option>
                <option value="employee-desc">Sort: Name (Z-A)</option>
                <option value="utilization-desc">Sort: Utilization (High-Low)</option>
                <option value="utilization-asc">Sort: Utilization (Low-High)</option>
                <option value="projects-desc">Sort: Projects (High-Low)</option>
                <option value="projects-asc">Sort: Projects (Low-High)</option>
                <option value="designation-asc">Sort: Designation</option>
              </select>
            )}
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
              <UserPlus size={14} /> Add Employee
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-4 p-5 bg-white border border-border-light rounded-2xl animate-in slide-in-from-top-2 duration-200">
            <div className="space-y-1.5 font-bold">
              <label className="text-[10px] text-gray-400 uppercase tracking-widest">Department</label>
              <select 
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="w-full bg-bg-secondary border border-border-light rounded-lg px-3 py-2 text-xs outline-none focus:border-primary"
              >
                <option>All Departments</option>
                {departmentOptions.map(department => <option key={department}>{department}</option>)}
              </select>
            </div>
            <div className="space-y-1.5 font-bold">
              <label className="text-[10px] text-gray-400 uppercase tracking-widest">Country</label>
              <select 
                value={countryFilter}
                onChange={(e) => setCountryFilter(e.target.value)}
                className="w-full bg-bg-secondary border border-border-light rounded-lg px-3 py-2 text-xs outline-none focus:border-primary"
              >
                <option>All Countries</option>
                {countryOptions.map(country => <option key={country}>{country}</option>)}
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
                {EMPLOYEE_STATUSES.map(status => <option key={status}>{status}</option>)}
              </select>
            </div>
            <div className="space-y-1.5 font-bold">
              <label className="text-[10px] text-gray-400 uppercase tracking-widest">Assignment</label>
              <select 
                value={assignFilter}
                onChange={(e) => setAssignFilter(e.target.value)}
                className="w-full bg-bg-secondary border border-border-light rounded-lg px-3 py-2 text-xs outline-none focus:border-primary"
              >
                <option>All Assignments</option>
                <option>Assigned</option>
                <option>Bench</option>
              </select>
            </div>
            <div className="space-y-1.5 font-bold">
              <label className="text-[10px] text-gray-400 uppercase tracking-widest">Utilization</label>
              <select 
                value={utilFilter}
                onChange={(e) => setUtilFilter(e.target.value)}
                className="w-full bg-bg-secondary border border-border-light rounded-lg px-3 py-2 text-xs outline-none focus:border-primary"
              >
                <option>Any</option>
                <option>Over 100%</option>
                <option>80-100%</option>
                <option>Under 80%</option>
                <option>Excluded</option>
              </select>
            </div>
            <div className="space-y-1.5 font-bold">
              <div className="flex items-center gap-1.5">
                <label className="text-[10px] text-gray-400 uppercase tracking-widest">Country Director</label>
                <div className="group relative">
                  <Info size={12} className="text-slate-300 cursor-help" />
                  <div className="absolute left-0 bottom-full mb-2 w-64 p-2 bg-slate-800 text-white text-[10px] rounded shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 font-medium">
                    Employees mapped to multiple Country Directors appear in each of their respective CD filters.
                  </div>
                </div>
              </div>
              <select 
                value={cdFilter}
                onChange={(e) => setCdFilter(e.target.value)}
                className="w-full bg-bg-secondary border border-border-light rounded-lg px-3 py-2 text-xs outline-none focus:border-primary"
              >
                <option value="All Directors">All Directors</option>
                {cds.map(cd => <option key={cd.id} value={cd.id}>{cd.name}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>

      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-dark/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl animate-in zoom-in-95 duration-200">
            <EmployeeForm 
              employee={selectedEmployee} 
              onClose={() => setIsFormOpen(false)} 
              onSave={fetchData}
            />
          </div>
        </div>
      )}

      {editAllocation && (
        <div className="fixed inset-0 bg-slate-dark/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-3xl animate-in zoom-in-95 duration-200">
            <AllocationForm
              allocation={editAllocation}
              onClose={() => { setEditAllocation(null); fetchData(); }}
            />
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!employeeToDeactivate}
        title="Deactivate Employee"
        description={`${employeeToDeactivate?.name || 'This employee'} will be marked as Exited and their demo login will be disabled. Existing historical allocations and timesheets remain intact for auditability.`}
        confirmLabel="Deactivate"
        variant="danger"
        onConfirm={confirmDeactivate}
        onCancel={() => setEmployeeToDeactivate(null)}
      />

      {view === 'cards' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredEmployees.length === 0 && (
            <div className="col-span-full py-16 text-center text-gray-400 text-xs font-medium">No employees match the current filters.</div>
          )}
          {filteredEmployees.map(emp => (
            <CapacityCard
              key={emp.id}
              employee={{ ...emp }}
              allocations={allocations}
              cds={cds}
              settings={settings}
              utilizationEligible={isUtilizationEligibleEmployee(emp, allocations)}
              onEdit={handleEdit}
            />
          ))}
        </div>
      )}

      {view === 'timeline' && (
        <AllocationTimeline
          employees={filteredEmployees.filter(emp => isUtilizationEligibleEmployee(emp, allocations))}
          allocations={allocations}
          settings={settings}
          onEditAllocation={(alloc) => setEditAllocation(alloc)}
        />
      )}

      {view === 'heatmap' && (
        <UtilizationHeatmap
          employees={filteredEmployees.filter(emp => isUtilizationEligibleEmployee(emp, allocations))}
          allocations={allocations}
          settings={settings}
        />
      )}

      {view === 'table' && (
        <DataTable
          header={(
            <tr>
              <SortableHeader<EmployeeSortKey> label="Employee & ID" sortKey="employee" sortConfig={sortConfig} onSort={(key) => setSortConfig(current => nextSortConfig(current, key))} />
              <SortableHeader<EmployeeSortKey> label="Designation & Dept." sortKey="designation" sortConfig={sortConfig} onSort={(key) => setSortConfig(current => nextSortConfig(current, key))} />
              <SortableHeader<EmployeeSortKey> label="Director Mapping" sortKey="director" sortConfig={sortConfig} onSort={(key) => setSortConfig(current => nextSortConfig(current, key))} />
              <SortableHeader<EmployeeSortKey> label="Utilization" sortKey="utilization" sortConfig={sortConfig} onSort={(key) => setSortConfig(current => nextSortConfig(current, key))} align="center" />
              <SortableHeader<EmployeeSortKey> label="Active Projects" sortKey="projects" sortConfig={sortConfig} onSort={(key) => setSortConfig(current => nextSortConfig(current, key))} />
              <th className="py-4 px-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Actions</th>
            </tr>
          )}
        >
              {filteredEmployees.map((emp) => {
                const utilizationEligible = isUtilizationEligibleEmployee(emp, allocations);
                return (
                <tr key={emp.id} className="hover:bg-bg-secondary transition-colors group">
                  <td className="py-5 px-6">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-dark border border-slate-200 flex items-center justify-center font-bold shadow-sm group-hover:bg-orange-50 group-hover:text-primary group-hover:border-primary/20 transition-colors">
                        {emp.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <Link to={`/employees/${emp.id}`} className="text-sm font-bold text-heading hover:text-primary transition-colors truncate">
                          {emp.name}
                        </Link>
                        <span className="text-[10px] text-body/60 font-mono tracking-tight">{emp.employeeId}</span>
                      </div>
                    </div>
                  </td>
                  <td className="py-5 px-6">
                    <span className="text-xs text-heading font-semibold block">{emp.designation}</span>
                    <span className="text-[10px] text-body/60 font-medium">{emp.department}</span>
                  </td>
                  <td className="py-5 px-6">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-1.5">
                        <User size={10} className="text-primary" />
                        <span className="text-xs font-bold text-slate-dark">{getCDName(emp.primaryCountryDirectorId)}</span>
                      </div>
                      {emp.mappedCountryDirectorIds.length > 1 && (
                        <div className="flex flex-wrap gap-1">
                          <span className="px-1.5 py-0.5 bg-slate-100 text-[9px] font-bold text-gray-500 rounded uppercase">
                            +{emp.mappedCountryDirectorIds.length - 1} More Mappings
                          </span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="py-5 px-6">
                    <div className="flex flex-col items-center gap-1">
                      {utilizationEligible ? (
                        <>
                          <span className={cn(
                            "text-xs font-bold transition-all tabular-nums",
                            emp.plannedUtilization > 100 ? "text-danger" : "text-heading"
                          )}>
                            {emp.plannedUtilization}%
                          </span>
                          <div className="w-20 bg-gray-100 h-1 rounded-full overflow-hidden">
                            <div
                              className={cn("h-full transition-all duration-500", emp.plannedUtilization > 100 ? "bg-danger" : "bg-primary")}
                              style={{ width: `${Math.min(emp.plannedUtilization, 100)}%` }}
                            />
                          </div>
                        </>
                      ) : (
                        <span className="px-2 py-1 rounded-md bg-slate-100 border border-slate-200 text-[9px] font-bold uppercase tracking-wider text-slate-500">
                          Excluded
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-5 px-6">
                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                      {allocations
                        .filter(a => a.employeeId === emp.id && a.status === 'Active')
                        .map((a, idx) => (
                          <span key={idx} className="px-2 py-0.5 bg-orange-50 text-primary border border-primary/10 rounded-md text-[10px] font-bold truncate max-w-[150px]" title={a.projectName}>
                            {a.projectName}
                          </span>
                        ))
                      }
                      {allocations.filter(a => a.employeeId === emp.id && a.status === 'Active').length === 0 && (
                        <span className="text-[10px] text-gray-400 font-medium italic">
                          {utilizationEligible ? 'No active projects' : 'Not capacity-tracked'}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-5 px-6 text-right">
                    <div className="flex items-center justify-end gap-1 font-bold">
                      <Link 
                        to={`/employees/${emp.id}`}
                        className="p-2 text-gray-400 hover:text-primary hover:bg-orange-50 rounded-lg transition-all" 
                        title="View Full Profile"
                      >
                        <Eye size={16} />
                      </Link>
                      <button 
                        onClick={() => handleEdit(emp)}
                        className="p-2 text-gray-400 hover:text-primary hover:bg-orange-50 rounded-lg transition-all" 
                        title="Quick Edit"
                      >
                        <Edit2 size={16} />
                      </button>
                      {emp.status !== 'Exited' && (
                        <button
                          onClick={() => handleDeactivate(emp)}
                          className="p-2 text-gray-400 hover:text-danger hover:bg-red-50 rounded-lg transition-all"
                          title="Deactivate Employee"
                        >
                          <UserX size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )})}
        </DataTable>
      )}
    </div>
  );
};
