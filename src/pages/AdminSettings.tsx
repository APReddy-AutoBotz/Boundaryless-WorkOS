import { useState, useEffect } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { Badge } from '../components/ui/Badge';
import { 
  Users, 
  Settings, 
  Database, 
  BarChart3, 
  Clock, 
  ShieldCheck, 
  Lock, 
  Globe, 
  Zap,
  ChevronRight,
  UserPlus,
  RefreshCcw,
  Bell,
  Mail,
  Palette,
  Save,
  AlertCircle,
  Plus,
  Trash2
} from 'lucide-react';
import { cn } from '../lib/utils';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { NoticeBanner } from '../components/ui/NoticeBanner';
import { adminService, clientService, employeeService } from '../services/api';
import { CatalogItem, CountryDirector, RoleDefinition, SystemSettings } from '../types';

type NoticeState = { type: 'success' | 'warning' | 'danger' | 'info'; message: string };
type ConfirmState = {
  title: string;
  description: string;
  confirmLabel: string;
  variant?: 'danger' | 'primary';
  onConfirm: () => void | Promise<void>;
};

export const AdminSettings = () => {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [roleDefinitions, setRoleDefinitions] = useState<RoleDefinition[]>([]);
  const [countryDirectors, setCountryDirectors] = useState<CountryDirector[]>([]);
  const [departments, setDepartments] = useState<CatalogItem[]>([]);
  const [countries, setCountries] = useState<CatalogItem[]>([]);
  const [industries, setIndustries] = useState<CatalogItem[]>([]);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDepartment, setNewRoleDepartment] = useState('Delivery');
  const [newDirectorName, setNewDirectorName] = useState('');
  const [newDirectorRegion, setNewDirectorRegion] = useState('');
  const [newDepartmentName, setNewDepartmentName] = useState('');
  const [newCountryName, setNewCountryName] = useState('');
  const [newIndustryName, setNewIndustryName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success'>('idle');
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmState | null>(null);

  useEffect(() => {
    const load = async () => {
      const [setts, roles, cds, depts, ctrs, inds] = await Promise.all([
        adminService.getSettings(),
        adminService.getRoleDefinitions(),
        adminService.getCountryDirectors(),
        adminService.getDepartments(),
        adminService.getCountries(),
        adminService.getIndustries(),
      ]);
      setSettings(setts);
      setRoleDefinitions(roles);
      setCountryDirectors(cds);
      setDepartments(depts);
      setCountries(ctrs);
      setIndustries(inds);
      setLoading(false);
    };
    load();
  }, []);

  const handleSave = () => {
    if (!settings) return;
    setSaveStatus('saving');
    setTimeout(() => {
      adminService.saveSettings(settings);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }, 500);
  };

  const handleAddRole = async () => {
    const name = newRoleName.trim();
    if (!name) return;
    if (roleDefinitions.some(role => role.name.toLowerCase() === name.toLowerCase())) {
      setNotice({ type: 'warning', message: 'This job role already exists.' });
      return;
    }
    const role: RoleDefinition = {
      id: `job-role-${Date.now()}`,
      name,
      department: newRoleDepartment.trim() || 'Delivery',
      description: 'Custom role for demo/resource planning.',
      active: true,
      createdAt: new Date().toISOString(),
    };
    await adminService.saveRoleDefinition(role);
    setRoleDefinitions(await adminService.getRoleDefinitions());
    setNewRoleName('');
    setNotice({ type: 'success', message: `${name} was added to the active role catalog.` });
  };

  const handleDeleteRole = (role: RoleDefinition) => {
    setConfirmAction({
      title: 'Retire Job Role',
      description: `Retire "${role.name}" from the active role catalog? Records already using this role will be protected by service guardrails.`,
      confirmLabel: 'Retire Role',
      variant: 'danger',
      onConfirm: async () => {
        const deleted = await adminService.deleteRoleDefinition(role.id);
        setConfirmAction(null);
        if (!deleted) {
          setNotice({
            type: 'danger',
            message: `"${role.name}" is still assigned to employees or active allocations. Reassign those records before retiring this role.`,
          });
        } else {
          setNotice({ type: 'success', message: `"${role.name}" was retired from the role catalog.` });
        }
        setRoleDefinitions(await adminService.getRoleDefinitions());
      },
    });
  };

  const handleAddCountryDirector = async () => {
    const name = newDirectorName.trim();
    const region = newDirectorRegion.trim();
    if (!name || !region) return;
    if (countryDirectors.some(director => director.name.toLowerCase() === name.toLowerCase() || director.region.toLowerCase() === region.toLowerCase())) {
      setNotice({ type: 'warning', message: 'A Country Director with this name or region already exists.' });
      return;
    }
    await adminService.saveCountryDirector({
      id: `cd-custom-${Date.now()}`,
      name,
      region,
    });
    setCountryDirectors(await adminService.getCountryDirectors());
    setNewDirectorName('');
    setNewDirectorRegion('');
    setNotice({ type: 'success', message: `${name} was added for ${region}.` });
  };

  const handleDeleteCountryDirector = async (director: CountryDirector) => {
    const allEmployees = await employeeService.getAll();
    const mappedEmployees = allEmployees.filter(employee =>
      employee.primaryCountryDirectorId === director.id || employee.mappedCountryDirectorIds.includes(director.id)
    );
    if (mappedEmployees.length > 0) {
      setNotice({
        type: 'danger',
        message: `${director.name} still owns ${mappedEmployees.length} employee mapping(s). Reassign those employees on the Employee Master before deleting this director.`,
      });
      return;
    }
    setConfirmAction({
      title: 'Delete Country Director',
      description: `Delete "${director.name}" for ${director.region}? This is allowed only when no employee mappings reference the director.`,
      confirmLabel: 'Delete Director',
      variant: 'danger',
      onConfirm: async () => {
        const deleted = await adminService.deleteCountryDirector(director.id);
        setConfirmAction(null);
        if (!deleted) {
          setNotice({
            type: 'danger',
            message: `${director.name} could not be deleted because active mappings still reference this director.`,
          });
        } else {
          setNotice({ type: 'success', message: `${director.name} was deleted from the Country Director catalog.` });
        }
        setCountryDirectors(await adminService.getCountryDirectors());
      },
    });
  };

  const handleAddCatalogItem = async (
    label: string,
    value: string,
    existing: CatalogItem[],
    save: (item: CatalogItem) => Promise<void>,
    refresh: () => Promise<void>,
    clear: () => void
  ) => {
    const name = value.trim();
    if (!name) return;
    if (existing.some(item => item.name.toLowerCase() === name.toLowerCase())) {
      setNotice({ type: 'warning', message: `${label} "${name}" already exists.` });
      return;
    }
    await save({
      id: `${label.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
      name,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await refresh();
    clear();
    setNotice({ type: 'success', message: `${name} was added to the ${label.toLowerCase()} catalog.` });
  };

  const handleDeleteCatalogItem = (
    label: string,
    item: CatalogItem,
    deleteItem: (id: string) => Promise<boolean>,
    refresh: () => void,
    usageLabel: string
  ) => {
    setConfirmAction({
      title: `Retire ${label}`,
      description: `Retire "${item.name}" from the ${label.toLowerCase()} catalog? This is blocked when ${usageLabel} still reference it.`,
      confirmLabel: `Retire ${label}`,
      variant: 'danger',
      onConfirm: async () => {
        const deleted = await deleteItem(item.id);
        setConfirmAction(null);
        if (!deleted) {
          setNotice({ type: 'danger', message: `"${item.name}" is still in use. Reassign dependent records before retiring it.` });
        } else {
          setNotice({ type: 'success', message: `"${item.name}" was retired from the ${label.toLowerCase()} catalog.` });
        }
        refresh();
      },
    });
  };

  const handleResetDemoData = () => {
    setConfirmAction({
      title: 'Reset Demo Dataset',
      description: 'Reset all local demo employees, projects, allocations, timesheets, users, and role definitions? This replaces local demo edits and returns to login.',
      confirmLabel: 'Reset Dataset',
      variant: 'danger',
      onConfirm: () => {
        adminService.resetDemoData();
        window.location.href = '/login';
      },
    });
  };

  const handleRecalculateBounds = () => {
    if (!settings) return;
    adminService.saveSettings(settings);
    setNotice({ type: 'success', message: 'Utilization settings were saved and demo calculations were refreshed.' });
  };

  if (loading || !settings) return null;

  const [directorMappingCounts, departmentUsage, countryUsage, industryUsage] = [
    countryDirectors.reduce<Record<string, number>>((counts, director) => {
      // We use local employee data from state; these will be 0 in API mode until employees are loaded in another page
      counts[director.id] = 0;
      return counts;
    }, {}),
    departments.reduce<Record<string, number>>((counts, department) => {
      counts[department.id] = roleDefinitions.filter(role => role.department === department.name).length;
      return counts;
    }, {}),
    countries.reduce<Record<string, number>>((counts, country) => {
      counts[country.id] = 0;
      return counts;
    }, {}),
    industries.reduce<Record<string, number>>((counts, industry) => {
      counts[industry.id] = 0;
      return counts;
    }, {}),
  ];

  return (
    <div className="animate-in fade-in duration-500 pb-12">
      <PageHeader 
        title="Governance Control Center" 
        subtitle="Operational governance, regional ownership, and platform parameters configuration."
        breadcrumb={['System', 'Governance']}
      />

      {notice && (
        <NoticeBanner
          type={notice.type}
          title="Governance"
          message={notice.message}
          onClose={() => setNotice(null)}
          className="mb-6"
        />
      )}

      <ConfirmDialog
        open={!!confirmAction}
        title={confirmAction?.title || ''}
        description={confirmAction?.description || ''}
        confirmLabel={confirmAction?.confirmLabel}
        variant={confirmAction?.variant}
        onConfirm={() => confirmAction?.onConfirm()}
        onCancel={() => setConfirmAction(null)}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
         {/* Main Settings Grid */}
         <div className="lg:col-span-8 space-y-8">
            <div className="bg-white border border-border-light rounded-3xl p-8 shadow-sm space-y-8">
               <div className="flex items-center justify-between border-b border-slate-50 pb-6">
                  <div className="flex items-center gap-4">
                     <div className="w-12 h-12 rounded-2xl bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/20">
                        <Settings size={24} />
                     </div>
                     <div>
                        <h3 className="text-lg font-bold text-heading">Core Business Rules</h3>
                        <p className="text-xs text-body opacity-60 font-medium">Manage calculation logic, utilization bands, and timesheet policies.</p>
                     </div>
                  </div>
                  <button 
                    onClick={handleSave}
                    disabled={saveStatus === 'saving'}
                    className="btn-primary py-2.5 px-6 flex items-center gap-2 shadow-lg shadow-primary/20"
                  >
                    {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'success' ? 'Settings Saved' : <><Save size={16} /> Save Changes</>}
                  </button>
               </div>

               <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl mb-6">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 italic">Infrastructure Note</p>
                  <p className="text-xs text-slate-600 font-medium leading-relaxed">
                    Current data is persisted in secure local browser storage for demo stability. 
                    Future backend integration can be implemented using Node.js APIs and PostgreSQL, aligned with the company’s existing stack.
                  </p>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                     <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                        <BarChart3 size={14} /> Utilization Bands
                     </h4>
                     <div className="space-y-4">
                        <div className="space-y-1.5">
                           <label className="text-[10px] font-bold text-heading uppercase tracking-wider">Over-allocation Trigger (%)</label>
                           <input 
                              type="number" 
                              value={settings.utilizationThresholdHigh}
                              onChange={(e) => setSettings({...settings, utilizationThresholdHigh: Number(e.target.value)})}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                           />
                           <p className="text-[9px] text-slate-400 font-medium">Threshold above which resources are marked as 'Overallocated'.</p>
                        </div>
                        <div className="space-y-1.5">
                           <label className="text-[10px] font-bold text-heading uppercase tracking-wider">Balanced Floor (%)</label>
                           <input 
                              type="number" 
                              value={settings.utilizationThresholdLow}
                              onChange={(e) => setSettings({...settings, utilizationThresholdLow: Number(e.target.value)})}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                           />
                           <p className="text-[9px] text-slate-400 font-medium">Lower bound for 'Balanced' utilization band.</p>
                        </div>
                        <div className="space-y-1.5">
                           <label className="text-[10px] font-bold text-heading uppercase tracking-wider">Bench Threshold (%)</label>
                           <input 
                              type="number" 
                              value={settings.benchThreshold}
                              onChange={(e) => setSettings({...settings, benchThreshold: Number(e.target.value)})}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                           />
                           <p className="text-[9px] text-slate-400 font-medium">Resources at or below this are marked as 'On Bench'.</p>
                        </div>
                     </div>
                  </div>

                  <div className="space-y-6">
                     <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                        <Clock size={14} /> Timesheet Policy
                     </h4>
                     <div className="space-y-4">
                        <div className="space-y-1.5">
                           <label className="text-[10px] font-bold text-heading uppercase tracking-wider">Expected Weekly Hours</label>
                           <input 
                              type="number" 
                              value={settings.expectedWeeklyHours}
                              onChange={(e) => setSettings({...settings, expectedWeeklyHours: Number(e.target.value)})}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                           />
                           <p className="text-[9px] text-slate-400 font-medium">Used as divisor for Actual Utilization calculations.</p>
                        </div>
                        <div className="space-y-1.5 pt-2">
                            <div className="p-4 bg-orange-50 border border-primary/20 rounded-xl flex gap-3">
                               <AlertCircle size={16} className="text-primary shrink-0 mt-0.5" />
                               <p className="text-[10px] text-heading font-medium leading-relaxed">
                                  Changing 'Expected Weekly Hours' will trigger a global recalculation of all historical utilization snapshots.
                               </p>
                            </div>
                        </div>
                        
                        <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl mt-4 group">
                           <div>
                              <p className="text-xs font-bold text-heading">Block Over-allocation</p>
                              <p className="text-[9px] text-slate-400 font-medium">When ON, allocations above the high threshold are blocked.</p>
                           </div>
                           <button 
                             onClick={() => setSettings({...settings, blockOverAllocation: !settings.blockOverAllocation})}
                             className={cn(
                               "w-10 h-5 rounded-full relative transition-all duration-300 shadow-inner cursor-pointer",
                               settings.blockOverAllocation ? "bg-primary" : "bg-slate-300"
                             )}
                           >
                              <div className={cn(
                                "absolute top-1 w-3 h-3 bg-white rounded-full transition-all shadow-sm",
                                settings.blockOverAllocation ? "right-1" : "left-1"
                              )} />
                           </button>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl mt-4 group">
                           <div>
                              <p className="text-xs font-bold text-heading">Admin Demo Submission Mode</p>
                              <p className="text-[9px] text-slate-400 font-medium">When ON, Admins can self-submit timesheets for testing.</p>
                           </div>
                           <button 
                             onClick={() => setSettings({...settings, demoSubmissionMode: !settings.demoSubmissionMode})}
                             className={cn(
                               "w-10 h-5 rounded-full relative transition-all duration-300 shadow-inner cursor-pointer",
                               settings.demoSubmissionMode ? "bg-primary" : "bg-slate-300"
                             )}
                           >
                              <div className={cn(
                                "absolute top-1 w-3 h-3 bg-white rounded-full transition-all shadow-sm",
                                settings.demoSubmissionMode ? "right-1" : "left-1"
                              )} />
                           </button>
                        </div>
                     </div>
                  </div>
               </div>
            </div>

            <div className="bg-white border border-border-light rounded-3xl p-8 shadow-sm space-y-6">
               <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-50 pb-6">
                  <div>
                     <h3 className="text-lg font-bold text-heading">Delivery Role Catalog</h3>
                     <p className="text-xs text-body opacity-60 font-medium">
                        Manage job/designation values used for employees and project-specific allocation roles.
                     </p>
                  </div>
                  <Badge variant="neutral">{roleDefinitions.length} Roles</Badge>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-[1fr_180px_auto] gap-3">
                  <input
                    value={newRoleName}
                    onChange={(event) => setNewRoleName(event.target.value)}
                    placeholder="Add role, e.g. Process Mining Analyst"
                    className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                  />
                  <input
                    value={newRoleDepartment}
                    onChange={(event) => setNewRoleDepartment(event.target.value)}
                    placeholder="Department"
                    className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                  />
                  <button onClick={handleAddRole} className="btn-primary py-2.5 px-5 flex items-center justify-center gap-2">
                    <Plus size={14} /> Add Role
                  </button>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[360px] overflow-y-auto pr-1">
                  {roleDefinitions.map(role => (
                    <div key={role.id} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-start justify-between gap-4">
                       <div>
                          <p className="text-xs font-bold text-heading">{role.name}</p>
                          <p className="text-[10px] font-bold text-primary uppercase tracking-widest mt-1">{role.department}</p>
                          {role.description && <p className="text-[10px] text-slate-400 font-medium mt-2 leading-relaxed">{role.description}</p>}
                       </div>
                       <button
                         onClick={() => handleDeleteRole(role)}
                         className="p-2 text-slate-300 hover:text-danger hover:bg-white rounded-lg transition-colors"
                         title={`Delete ${role.name}`}
                       >
                         <Trash2 size={14} />
                       </button>
                    </div>
                  ))}
               </div>
            </div>

            <div className="bg-white border border-border-light rounded-3xl p-8 shadow-sm space-y-6">
               <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-50 pb-6">
                  <div>
                     <h3 className="text-lg font-bold text-heading">Country Director Catalog</h3>
                     <p className="text-xs text-body opacity-60 font-medium">
                        Add or retire regional ownership records used by dashboards, employee mapping, and access scoping.
                     </p>
                  </div>
                  <Badge variant="neutral">{countryDirectors.length} Directors</Badge>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3">
                  <input
                    value={newDirectorName}
                    onChange={(event) => setNewDirectorName(event.target.value)}
                    placeholder="Director name, e.g. CD-9"
                    className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                  />
                  <input
                    value={newDirectorRegion}
                    onChange={(event) => setNewDirectorRegion(event.target.value)}
                    placeholder="Region, e.g. LATAM"
                    className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                  />
                  <button onClick={handleAddCountryDirector} className="btn-primary py-2.5 px-5 flex items-center justify-center gap-2">
                    <Plus size={14} /> Add Director
                  </button>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[320px] overflow-y-auto pr-1">
                  {countryDirectors.map(director => (
                    <div key={director.id} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between gap-4">
                       <div>
                          <p className="text-xs font-bold text-heading">{director.name}</p>
                          <p className="text-[10px] font-bold text-primary uppercase tracking-widest mt-1">{director.region}</p>
                          <p className="text-[10px] text-slate-400 font-medium mt-2">
                            {directorMappingCounts[director.id] || 0} mapped employee{(directorMappingCounts[director.id] || 0) === 1 ? '' : 's'}
                          </p>
                       </div>
                       <button
                         onClick={() => handleDeleteCountryDirector(director)}
                         className={cn(
                           "p-2 rounded-lg transition-colors",
                           directorMappingCounts[director.id] > 0
                             ? "text-slate-300 cursor-not-allowed"
                             : "text-slate-300 hover:text-danger hover:bg-white"
                         )}
                         title={
                           directorMappingCounts[director.id] > 0
                             ? 'Reassign mapped employees before deleting'
                             : `Delete ${director.name}`
                         }
                       >
                         <Trash2 size={14} />
                       </button>
                    </div>
                  ))}
               </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="bg-white border border-border-light rounded-3xl p-6 shadow-sm space-y-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-heading">Department Catalog</h3>
                    <p className="text-[10px] text-body/60 font-medium mt-1">Controls employee home departments and role grouping.</p>
                  </div>
                  <Badge variant="neutral">{departments.length}</Badge>
                </div>
                <div className="flex gap-2">
                  <input
                    value={newDepartmentName}
                    onChange={(event) => setNewDepartmentName(event.target.value)}
                    placeholder="Add department"
                    className="min-w-0 flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs focus:ring-2 focus:ring-primary/20 outline-none"
                  />
                  <button
                    onClick={() => handleAddCatalogItem('Department', newDepartmentName, departments, adminService.saveDepartment, async () => setDepartments(await adminService.getDepartments()), () => setNewDepartmentName(''))}
                    className="btn-primary px-3"
                    title="Add Department"
                  >
                    <Plus size={14} />
                  </button>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {departments.map(department => (
                    <div key={department.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-heading truncate">{department.name}</p>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">{departmentUsage[department.id] || 0} linked</p>
                      </div>
                      <button
                        onClick={() => handleDeleteCatalogItem('Department', department, adminService.deleteDepartment, async () => setDepartments(await adminService.getDepartments()), 'employees or roles')}
                        className="p-2 rounded-lg text-slate-300 hover:text-danger hover:bg-white transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white border border-border-light rounded-3xl p-6 shadow-sm space-y-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-heading">Country Catalog</h3>
                    <p className="text-[10px] text-body/60 font-medium mt-1">Controls employee base-country values.</p>
                  </div>
                  <Badge variant="neutral">{countries.length}</Badge>
                </div>
                <div className="flex gap-2">
                  <input
                    value={newCountryName}
                    onChange={(event) => setNewCountryName(event.target.value)}
                    placeholder="Add country"
                    className="min-w-0 flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs focus:ring-2 focus:ring-primary/20 outline-none"
                  />
                  <button
                    onClick={() => handleAddCatalogItem('Country', newCountryName, countries, adminService.saveCountry, async () => setCountries(await adminService.getCountries()), () => setNewCountryName(''))}
                    className="btn-primary px-3"
                    title="Add Country"
                  >
                    <Plus size={14} />
                  </button>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {countries.map(country => (
                    <div key={country.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-heading truncate">{country.name}</p>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">{countryUsage[country.id] || 0} employees</p>
                      </div>
                      <button
                        onClick={() => handleDeleteCatalogItem('Country', country, adminService.deleteCountry, async () => setCountries(await adminService.getCountries()), 'employees')}
                        className="p-2 rounded-lg text-slate-300 hover:text-danger hover:bg-white transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white border border-border-light rounded-3xl p-6 shadow-sm space-y-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-heading">Industry Catalog</h3>
                    <p className="text-[10px] text-body/60 font-medium mt-1">Controls client segmentation and portfolio reporting.</p>
                  </div>
                  <Badge variant="neutral">{industries.length}</Badge>
                </div>
                <div className="flex gap-2">
                  <input
                    value={newIndustryName}
                    onChange={(event) => setNewIndustryName(event.target.value)}
                    placeholder="Add industry"
                    className="min-w-0 flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs focus:ring-2 focus:ring-primary/20 outline-none"
                  />
                  <button
                    onClick={() => handleAddCatalogItem('Industry', newIndustryName, industries, adminService.saveIndustry, async () => setIndustries(await adminService.getIndustries()), () => setNewIndustryName(''))}
                    className="btn-primary px-3"
                    title="Add Industry"
                  >
                    <Plus size={14} />
                  </button>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {industries.map(industry => (
                    <div key={industry.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-heading truncate">{industry.name}</p>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">{industryUsage[industry.id] || 0} clients</p>
                      </div>
                      <button
                        onClick={() => handleDeleteCatalogItem('Industry', industry, adminService.deleteIndustry, async () => setIndustries(await adminService.getIndustries()), 'clients')}
                        className="p-2 rounded-lg text-slate-300 hover:text-danger hover:bg-white transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
               <div className="bg-white border border-border-light p-4 rounded-2xl text-center shadow-sm">
                  <p className="text-sm font-bold text-heading">{settings.utilizationThresholdHigh}%</p>
                  <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mt-1">High Cap</p>
               </div>
               <div className="bg-white border border-border-light p-4 rounded-2xl text-center shadow-sm">
                  <p className="text-sm font-bold text-heading">{settings.utilizationThresholdLow}%</p>
                  <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mt-1">Floor</p>
               </div>
               <div className="bg-white border border-border-light p-4 rounded-2xl text-center shadow-sm">
                  <p className="text-sm font-bold text-heading">{settings.benchThreshold}%</p>
                  <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mt-1">Bench</p>
               </div>
               <div className="bg-white border border-border-light p-4 rounded-2xl text-center shadow-sm">
                  <p className="text-sm font-bold text-heading">{settings.expectedWeeklyHours}h</p>
                  <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mt-1">Work Week</p>
               </div>
            </div>

            <div className="bg-slate-dark text-white rounded-[40px] p-10 shadow-2xl relative overflow-hidden group mt-8">
               <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                  <div className="space-y-4 max-w-md">
                      <div className="flex items-center gap-3 text-primary uppercase text-[10px] font-bold tracking-[0.2em] mb-2">
                         <Globe size={14} /> Regional Configuration
                      </div>
                      <h4 className="text-2xl font-bold tracking-tight">Director Mapping Rules</h4>
                      <p className="text-sm text-white/50 leading-relaxed font-medium italic">
                         Platform configuration for multi-mapped resource leads is currently set to "Shared Visibility". 
                         Regional Director overrides enabled for EMEA.
                      </p>
                      <button
                        onClick={handleRecalculateBounds}
                        className="btn-primary py-3 px-8 shadow-lg shadow-primary/20 flex items-center gap-2 mt-4"
                      >
                         Recalculate Bounds <RefreshCcw size={16} />
                      </button>
                  </div>
                  <div className="w-full md:w-64 aspect-square bg-white/5 rounded-3xl border border-white/10 p-6 backdrop-blur-sm shadow-inner group-hover:border-primary/20 transition-all">
                      <div className="h-full flex flex-col justify-between">
                         <div>
                            <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Environment Status</p>
                            <p className="text-xl font-bold text-white mt-1">Live Ops</p>
                         </div>
                         <div className="space-y-3">
                            <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                               <div className="h-full bg-success w-[94%]"></div>
                            </div>
                            <div className="flex justify-between text-[10px] font-bold text-white/30 uppercase tracking-widest">
                               <span>System Uptime</span>
                               <span>99.98%</span>
                            </div>
                         </div>
                      </div>
                  </div>
               </div>
               <div className="absolute bottom-0 left-0 w-96 h-96 bg-primary/10 blur-[120px] -ml-48 -mb-48 rounded-full group-hover:bg-primary/20 transition-all" />
            </div>
         </div>

         {/* Sidebars & Quick Settings */}
         <div className="lg:col-span-4 space-y-8">
            <div className="bg-white border border-border-light rounded-3xl p-8 shadow-sm">
               <h3 className="text-sm font-bold text-heading uppercase tracking-widest mb-6">User Management</h3>
               <div className="space-y-4">
                  <button
                    onClick={() => setNotice({ type: 'info', message: 'Administrator invites require the production backend user-management service. Demo accounts are generated from employee records.' })}
                    className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 rounded-2xl border border-slate-100 transition-all group"
                  >
                     <div className="flex items-center gap-3 text-heading">
                        <UserPlus size={18} />
                        <span className="text-xs font-bold">Invite New Administrator</span>
                     </div>
                     <ChevronRight size={16} className="text-gray-300 group-hover:translate-x-1 group-hover:text-primary transition-all" />
                  </button>
                  <button
                    onClick={() => setNotice({ type: 'info', message: 'Branding is locked to the current Boundaryless visual system for this phase.' })}
                    className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 rounded-2xl border border-slate-100 transition-all group"
                  >
                     <div className="flex items-center gap-3 text-heading">
                        <Palette size={18} />
                        <span className="text-xs font-bold">Customize Branding</span>
                     </div>
                     <ChevronRight size={16} className="text-gray-300 group-hover:translate-x-1 group-hover:text-primary transition-all" />
                  </button>
                  <button
                    onClick={handleResetDemoData}
                    className="w-full flex items-center justify-between p-4 bg-orange-50 hover:bg-orange-100 rounded-2xl border border-primary/20 transition-all group"
                  >
                     <div className="flex items-center gap-3 text-heading">
                        <RefreshCcw size={18} className="text-primary" />
                        <span className="text-xs font-bold">Reset Demo Dataset</span>
                     </div>
                     <ChevronRight size={16} className="text-primary/50 group-hover:translate-x-1 transition-all" />
                  </button>
               </div>
            </div>

            <div className="bg-white border border-border-light rounded-3xl p-8 shadow-sm">
               <h3 className="text-sm font-bold text-heading uppercase tracking-widest mb-8">System Preferences</h3>
               <div className="space-y-6">
                  {[
                    { icon: Bell, label: 'Push Notifications', status: 'Enabled', active: true },
                    { icon: Mail, label: 'Email Digest', status: 'Weekly', active: false },
                    { icon: Zap, label: 'Auto-Utilization Sync', status: 'Hourly', active: true },
                  ].map((pref, i) => (
                    <div key={i} className="flex items-center justify-between border-b border-slate-50 pb-6 last:border-0 last:pb-0">
                       <div className="flex items-center gap-4">
                          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-all", pref.active ? "bg-orange-50 text-primary shadow-inner" : "bg-slate-50 text-gray-400")}>
                             <pref.icon size={18} />
                          </div>
                          <div>
                             <p className="text-xs font-bold text-heading">{pref.label}</p>
                             <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{pref.status}</p>
                          </div>
                       </div>
                       <div className={cn(
                         "w-10 h-5 rounded-full relative transition-all duration-300 cursor-pointer shadow-inner",
                         pref.active ? "bg-primary" : "bg-slate-200"
                       )}>
                          <div className={cn(
                            "absolute top-1 w-3 h-3 bg-white rounded-full transition-all shadow-sm",
                            pref.active ? "right-1" : "left-1"
                          )} />
                       </div>
                    </div>
                  ))}
               </div>
            </div>

            <div className="p-8 italic text-body/40 text-[10px] leading-relaxed text-center font-bold uppercase tracking-[0.2em]">
               Boundaryless v1.2.0 • Phase 1 Production Shell
            </div>
         </div>
      </div>
    </div>
  );
};
