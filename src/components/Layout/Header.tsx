import { Search, Bell, User, Settings as SettingsIcon, LogOut, Users, BriefcaseBusiness, Building2, BarChart3, ShieldCheck, Database, KeyRound, X, type LucideIcon } from 'lucide-react';
import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { authService } from '../../services/authService';
import { useNavigate } from 'react-router-dom';
import { adminService, allocationService, clientService, employeeService, projectService } from '../../services/api';
import { hasRouteRole, ROUTE_ROLES } from '../../services/accessControl';

type SearchResult = {
  id: string;
  title: string;
  subtitle: string;
  path: string;
  icon: LucideIcon;
  keywords: string;
};



export const Header = () => {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isPasswordOpen, setIsPasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordNotice, setPasswordNotice] = useState<{ type: 'success' | 'danger'; message: string } | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const user = authService.getCurrentUser();
  const navigate = useNavigate();
  const isPasswordChangeRequired = Boolean(user?.mustChangePassword);

  // Async data for search
  const [allEmployees, setAllEmployees] = useState<any[]>([]);
  const [allProjects, setAllProjects] = useState<any[]>([]);
  const [allocations, setAllocations] = useState<any[]>([]);
  const [allClients, setAllClients] = useState<any[]>([]);
  const [allDirectors, setAllDirectors] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      const [emps, projs, allocs, clients, directors] = await Promise.all([
        employeeService.getAll(),
        projectService.getAll(),
        allocationService.getAll(),
        clientService.getAll(),
        adminService.getCountryDirectors(),
      ]);
      setAllEmployees(emps);
      setAllProjects(projs);
      setAllocations(allocs);
      setAllClients(clients);
      setAllDirectors(directors);
    };
    load();
  }, []);

  useEffect(() => {
    if (isPasswordChangeRequired) {
      resetPasswordForm();
      setPasswordNotice({ type: 'danger', message: 'You must change your temporary password before continuing.' });
      setIsPasswordOpen(true);
    }
  }, [isPasswordChangeRequired]);

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const canAccess = (roles?: string[]) => !roles || !!user && roles.includes(user.role);

  const searchResults = useMemo<SearchResult[]>(() => {
    const query = searchQuery.trim().toLowerCase();
    const pages: Array<SearchResult & { roles?: string[] }> = [
      { id: 'page-dashboard', title: 'Overview Dashboard', subtitle: 'Company and regional utilization command center', path: '/', icon: BarChart3, keywords: 'dashboard overview kpi country director clients operations', roles: ROUTE_ROLES.dashboard },
      { id: 'page-my-workspace', title: 'My Workspace', subtitle: 'My projects, utilization, and timesheet status', path: '/my-workspace', icon: Users, keywords: 'my workspace employee assignments projects utilization timesheet', roles: ROUTE_ROLES.employeeWorkspace },
      { id: 'page-pm-workspace', title: 'PM Workspace', subtitle: 'Managed projects, team allocation, approvals, and risks', path: '/pm-workspace', icon: BriefcaseBusiness, keywords: 'pm workspace project manager team allocation approvals risks', roles: ROUTE_ROLES.projectManagerWorkspace },
      { id: 'page-employees', title: 'Employee Master', subtitle: 'Resources, roles, CD mappings, utilization', path: '/employees', icon: Users, keywords: 'employees resources people consultants hr', roles: ['Admin', 'HR', 'CountryDirector', 'TeamLead'] },
      { id: 'page-projects', title: 'Project Master', subtitle: 'Processes, clients, project managers, resources', path: '/projects', icon: BriefcaseBusiness, keywords: 'projects processes clients pm delivery', roles: ['Admin', 'HR', 'CountryDirector', 'ProjectManager'] },
      { id: 'page-clients', title: 'Client Portfolio', subtitle: 'Client, project, and resource coverage', path: '/clients', icon: Building2, keywords: 'clients portfolio accounts customer distribution', roles: ['Admin', 'HR', 'CountryDirector'] },
      { id: 'page-planned', title: 'Planned Utilization', subtitle: 'Allocation-derived capacity view', path: '/utilization/planned', icon: BarChart3, keywords: 'planned allocation utilization capacity', roles: ['Admin', 'HR', 'CountryDirector', 'ProjectManager', 'TeamLead'] },
      { id: 'page-actual', title: 'Actual Utilization', subtitle: 'Approved timesheet reconciliation', path: '/utilization/actual', icon: BarChart3, keywords: 'actual utilization timesheet approved reconciliation', roles: ['Admin', 'HR', 'CountryDirector', 'ProjectManager', 'TeamLead'] },
      { id: 'page-forecast', title: 'Forecast Utilization', subtitle: 'Forward allocation outlook', path: '/utilization/forecast', icon: BarChart3, keywords: 'forecast future utilization pipeline', roles: ['Admin', 'HR', 'CountryDirector', 'ProjectManager', 'TeamLead'] },
      { id: 'page-import', title: 'Import / Export', subtitle: 'CSV imports, exports, history', path: '/import-export', icon: Database, keywords: 'import export csv data bulk', roles: ['Admin'] },
      { id: 'page-audit', title: 'Audit Trail', subtitle: 'System activity and traceability', path: '/audit-trail', icon: ShieldCheck, keywords: 'audit logs history traceability', roles: ['Admin'] },
      { id: 'page-admin', title: 'Admin Settings', subtitle: 'Roles, directors, thresholds, policies', path: '/admin', icon: SettingsIcon, keywords: 'admin settings roles country directors thresholds', roles: ['Admin', 'HR'] },
    ];

    const visibleEmployees = (() => {
      if (!user) return [];
      if (['Admin', 'HR', 'TeamLead'].includes(user.role)) return allEmployees;
      if (user.role === 'CountryDirector' && user.cdId) {
        return allEmployees.filter(employee => employee.primaryCountryDirectorId === user.cdId || employee.mappedCountryDirectorIds.includes(user.cdId!));
      }
      if (user.role === 'ProjectManager') {
        const managedProjectIds = new Set(allProjects
          .filter(project => project.managerId === user.id || project.managerId === user.employeeId || project.managerName === user.name)
          .map(project => project.id));
        const employeeIds = new Set(allocations.filter(allocation => managedProjectIds.has(allocation.projectId)).map(allocation => allocation.employeeId));
        return allEmployees.filter(employee => employee.id === user.id || employeeIds.has(employee.id));
      }
      return allEmployees.filter(employee => employee.id === user.id);
    })();
    const visibleProjects = (() => {
      if (!user) return [];
      if (['Admin', 'HR'].includes(user.role)) return allProjects;
      if (user.role === 'ProjectManager') {
        return allProjects.filter(project => project.managerId === user.id || project.managerId === user.employeeId || project.managerName === user.name);
      }
      if (user.role === 'CountryDirector' && user.cdId) {
        const scopedEmployeeIds = new Set(visibleEmployees.map(employee => employee.id));
        const scopedProjectIds = new Set(allocations.filter(allocation => scopedEmployeeIds.has(allocation.employeeId)).map(allocation => allocation.projectId));
        return allProjects.filter(project => scopedProjectIds.has(project.id));
      }
      const ownProjectIds = new Set(allocations.filter(allocation => allocation.employeeId === user.id).map(allocation => allocation.projectId));
      return allProjects.filter(project => ownProjectIds.has(project.id));
    })();

    const employees = visibleEmployees.map(employee => ({
      id: `employee-${employee.id}`,
      title: employee.name,
      subtitle: `${employee.employeeId} - ${employee.designation} - ${employee.department}`,
      path: `/employees/${employee.id}`,
      icon: Users,
      keywords: `${employee.name} ${employee.employeeId} ${employee.email} ${employee.designation} ${employee.department} ${employee.country}`,
    }));

    const projects = visibleProjects.map(project => ({
      id: `project-${project.id}`,
      title: project.name,
      subtitle: `${project.projectCode} - ${project.client} - ${project.status}`,
      path: `/projects/${project.id}`,
      icon: BriefcaseBusiness,
      keywords: `${project.name} ${project.projectCode} ${project.client} ${project.managerName} ${project.status}`,
    }));

    const visibleClientNames = new Set(visibleProjects.map(project => project.client));
    const clients = canAccess(ROUTE_ROLES.clients)
      ? allClients
        .filter(client => client.status === 'Active' && visibleClientNames.has(client.name))
        .map(client => ({
      id: `client-${client.id}`,
      title: client.name,
      subtitle: `${client.industry} - client projects and assigned resource coverage`,
      path: `/clients?client=${encodeURIComponent(client.name)}`,
      icon: Building2,
      keywords: `${client.name} ${client.industry} client customer account projects resources`,
        }))
      : [];

    const visibleDirectors = (() => {
      if (!user) return [];
      if (['Admin', 'HR', 'TeamLead'].includes(user.role)) return allDirectors;
      if (user.role === 'CountryDirector' && user.cdId) return allDirectors.filter(director => director.id === user.cdId);
      const directorIds = new Set(visibleEmployees.flatMap(employee => [employee.primaryCountryDirectorId, ...employee.mappedCountryDirectorIds]));
      return allDirectors.filter(director => directorIds.has(director.id));
    })();

    const countryDirectors = canAccess(ROUTE_ROLES.employees) ? visibleDirectors.map(director => ({
      id: `director-${director.id}`,
      title: director.name,
      subtitle: `${director.region} country director scope`,
      path: `/employees?countryDirectorId=${director.id}`,
      icon: Users,
      keywords: `${director.name} ${director.region} country director cd`,
    })) : [];

    const allResults = [...pages.filter(page => canAccess(page.roles)), ...employees, ...projects, ...clients, ...countryDirectors];
    if (!query) return allResults.slice(0, 6);
    return allResults
      .filter(result => result.title.toLowerCase().includes(query) || result.subtitle.toLowerCase().includes(query) || result.keywords.toLowerCase().includes(query))
      .slice(0, 8);
  }, [searchQuery, user, allEmployees, allProjects, allocations, allClients, allDirectors]);

  const goToResult = (path: string) => {
    setSearchQuery('');
    setIsSearchOpen(false);
    navigate(path);
  };

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && searchResults[0]) {
      goToResult(searchResults[0].path);
    }
    if (event.key === 'Escape') {
      setIsSearchOpen(false);
    }
  };

  const resetPasswordForm = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordNotice(null);
    setIsChangingPassword(false);
  };

  const closePasswordModal = () => {
    if (isPasswordChangeRequired) {
      setPasswordNotice({ type: 'danger', message: 'Change your temporary password before continuing, or sign out.' });
      return;
    }
    setIsPasswordOpen(false);
  };

  const submitPasswordChange = async () => {
    if (newPassword !== confirmPassword) {
      setPasswordNotice({ type: 'danger', message: 'New password and confirmation do not match.' });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordNotice({ type: 'danger', message: 'New password must be at least 6 characters.' });
      return;
    }
    setIsChangingPassword(true);
    const ok = await authService.changePassword(currentPassword, newPassword);
    setIsChangingPassword(false);
    if (!ok) {
      setPasswordNotice({ type: 'danger', message: 'Password change failed. Check your current password and policy requirements.' });
      return;
    }
    setPasswordNotice({ type: 'success', message: 'Password changed successfully.' });
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setIsPasswordOpen(false);
  };

  return (
    <>
      <header className="h-16 bg-white border-b border-border-light flex items-center justify-between px-10 shrink-0 sticky top-0 z-10">
      <div className="flex items-center flex-1">
        <div
          className="relative group"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              setIsSearchOpen(false);
            }
          }}
        >
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-primary transition-colors" size={15} />
          <input 
            type="text" 
            placeholder="Search resources, projects or insights..." 
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value);
              setIsSearchOpen(true);
            }}
            onFocus={() => setIsSearchOpen(true)}
            onKeyDown={handleSearchKeyDown}
            className="w-96 bg-white border border-primary/20 rounded-xl py-2.5 pl-10 pr-4 text-xs font-medium text-heading placeholder:text-body/45 focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all shadow-sm"
          />
          {isSearchOpen && (
            <div className="absolute left-0 top-11 w-[28rem] max-w-[calc(100vw-2rem)] bg-white border border-border-light rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              {searchResults.length > 0 ? (
                <div className="space-y-1">
                  {searchResults.map(result => {
                    const Icon = result.icon;
                    return (
                      <button
                        key={result.id}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          goToResult(result.path);
                        }}
                        onClick={() => goToResult(result.path)}
                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-orange-50 text-left transition-colors group/result"
                      >
                        <span className="w-9 h-9 rounded-xl bg-bg-secondary text-primary flex items-center justify-center group-hover/result:bg-primary group-hover/result:text-white transition-colors">
                          <Icon size={16} />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-xs font-bold text-heading truncate">{result.title}</span>
                          <span className="block text-[10px] font-medium text-body/60 truncate mt-0.5">{result.subtitle}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="p-5 text-center">
                  <p className="text-xs font-bold text-heading">No matching workspace item</p>
                  <p className="text-[10px] text-body/50 mt-1">Try an employee, project, client, director, or page name.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-8">
        <button className="relative text-heading hover:text-primary transition-colors p-2 rounded-full hover:bg-bg-secondary group">
          <Bell size={18} />
          <div className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full border-2 border-white group-hover:scale-110 transition-transform"></div>
        </button>
        
        <div className="relative">
          <button 
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="flex items-center gap-3 hover:opacity-80 transition-all pl-6 border-l border-border-light"
          >
            <div className="text-right hidden sm:block">
              <div className="text-xs font-bold text-heading">{user?.name || 'Guest User'}</div>
              <div className="text-[10px] text-body uppercase tracking-[0.1em] font-medium opacity-60">{user?.role || 'User'}</div>
            </div>
            <div className="w-9 h-9 rounded bg-bg-secondary border border-border-light flex items-center justify-center font-bold text-heading text-xs shadow-sm">
               {user ? getInitials(user.name) : '??'}
            </div>
          </button>

          {isProfileOpen && (
            <div className="absolute right-0 top-12 w-52 bg-white border border-border-light rounded-lg shadow-2xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="px-4 py-2 border-b border-border-light mb-1">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Signed in as</p>
                <p className="text-xs font-bold text-heading truncate">{user?.email}</p>
              </div>
              <button
                onClick={() => {
                  setIsProfileOpen(false);
                  if (user) navigate(`/employees/${user.id}`);
                }}
                className="w-full px-4 py-2 text-left text-xs text-heading hover:bg-bg-secondary flex items-center gap-2 transition-colors"
              >
                <User size={14} /> My Profile
              </button>
              <button
                onClick={() => {
                  setIsProfileOpen(false);
                  resetPasswordForm();
                  setIsPasswordOpen(true);
                }}
                className="w-full px-4 py-2 text-left text-xs text-heading hover:bg-bg-secondary flex items-center gap-2 transition-colors"
              >
                <KeyRound size={14} /> Change Password
              </button>
              {hasRouteRole(user, ROUTE_ROLES.adminSettings) && (
                <button
                  onClick={() => {
                    setIsProfileOpen(false);
                    navigate('/admin');
                  }}
                  className="w-full px-4 py-2 text-left text-xs text-heading hover:bg-bg-secondary flex items-center gap-2 transition-colors"
                >
                  <SettingsIcon size={14} /> System Preferences
                </button>
              )}
              <div className="h-px bg-border-light my-1 mx-2"></div>
              <button 
                onClick={handleLogout}
                className="w-full px-4 py-2 text-left text-xs text-danger hover:bg-danger-bg flex items-center gap-2 transition-colors"
              >
                <LogOut size={14} /> Secure Sign Out
              </button>
            </div>
          )}
        </div>
        </div>
      </header>
      {isPasswordOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-dark/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-3xl border border-border-light bg-white shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-primary">
                  <KeyRound size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-heading">Change Password</h3>
                  <p className="mt-2 text-xs font-medium leading-relaxed text-slate-500">Update your account password. Your current session will remain active.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={closePasswordModal}
                className="rounded-xl p-2 text-slate-300 transition-colors hover:bg-slate-50 hover:text-heading"
                aria-label="Close change password"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4 p-6">
              {passwordNotice && (
                <div className={`rounded-2xl border px-4 py-3 text-xs font-bold ${passwordNotice.type === 'success' ? 'border-green-100 bg-green-50 text-green-800' : 'border-red-100 bg-red-50 text-red-800'}`}>
                  {passwordNotice.message}
                </div>
              )}
              <label className="block">
                <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">Current Password</span>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  className="w-full rounded-xl border border-border-light px-4 py-3 text-sm font-medium text-heading outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10"
                  autoComplete="current-password"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">New Password</span>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  className="w-full rounded-xl border border-border-light px-4 py-3 text-sm font-medium text-heading outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10"
                  autoComplete="new-password"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">Confirm New Password</span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="w-full rounded-xl border border-border-light px-4 py-3 text-sm font-medium text-heading outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10"
                  autoComplete="new-password"
                />
              </label>
            </div>
            <div className="flex items-center justify-end gap-3 bg-slate-50 px-6 py-4">
              <button
                type="button"
                onClick={isPasswordChangeRequired ? handleLogout : closePasswordModal}
                className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-heading transition-colors hover:bg-slate-100"
              >
                {isPasswordChangeRequired ? 'Secure Sign Out' : 'Close'}
              </button>
              <button
                type="button"
                onClick={submitPasswordChange}
                disabled={isChangingPassword}
                className="rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-orange-200 transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isChangingPassword ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
