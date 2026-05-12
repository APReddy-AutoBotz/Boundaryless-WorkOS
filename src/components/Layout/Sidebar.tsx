import React, { useState, useMemo } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Briefcase, 
  Building2,
  Link as LinkIcon, 
  Clock, 
  BarChart3, 
  TrendingUp, 
  PieChart, 
  FileUp, 
  History, 
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { authService } from '../../services/authService';
import { ROUTE_ROLES } from '../../services/accessControl';
import { UserRole } from '../../types';

interface SidebarItem {
  name: string;
  path: string;
  icon: React.ElementType;
  roles?: readonly UserRole[];
}

interface SidebarGroup {
  group: string;
  items: SidebarItem[];
}

export const Sidebar = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const navigate = useNavigate();
  const user = authService.getCurrentUser();

  const sidebarGroups: SidebarGroup[] = useMemo(() => [
    { 
      group: 'Main', 
      items: [
        { name: 'Overview Dashboard', path: '/', icon: LayoutDashboard, roles: ROUTE_ROLES.dashboard },
      ]
    },
    { 
      group: 'Operations', 
      items: [
        { name: 'Employee Master', path: '/employees', icon: Users, roles: ROUTE_ROLES.employees },
        { name: 'Project Master', path: '/projects', icon: Briefcase, roles: ROUTE_ROLES.projects },
        { name: 'Client Portfolio', path: '/clients', icon: Building2, roles: ROUTE_ROLES.clients },
        { name: 'Allocation Control', path: '/allocations', icon: LinkIcon, roles: ROUTE_ROLES.allocations },
        { 
          name: user?.role === 'Admin' ? 'Timesheet Self-Log' : 'My Timesheet', 
          path: '/timesheets', 
          icon: Clock, 
          roles: ROUTE_ROLES.timesheets 
        },
        { 
          name: user?.role === 'Admin' ? 'Timesheet Governance' : 'Timesheet Approvals', 
          path: '/timesheets/approval', 
          icon: TrendingUp, 
          roles: ROUTE_ROLES.timesheetApproval 
        },
      ]
    },
    { 
      group: 'Analytics', 
      items: [
        { name: 'Planned Utilization', path: '/utilization/planned', icon: BarChart3, roles: ROUTE_ROLES.utilization },
        { name: 'Actual Utilization', path: '/utilization/actual', icon: PieChart, roles: ROUTE_ROLES.utilization },
        { name: 'Forecast Utilization', path: '/utilization/forecast', icon: TrendingUp, roles: ROUTE_ROLES.utilization },
      ]
    },
    { 
      group: 'System', 
      items: [
        { name: 'Import / Export', path: '/import-export', icon: FileUp, roles: ROUTE_ROLES.importExport },
        { name: 'Audit Trail', path: '/audit-trail', icon: History, roles: ROUTE_ROLES.auditTrail },
        { name: 'Governance Settings', path: '/admin', icon: Settings, roles: ROUTE_ROLES.adminSettings },
      ]
    },
  ], []);

  const filteredGroups = useMemo(() => {
    if (!user) return [];
    return sidebarGroups.map(group => ({
      ...group,
      items: group.items.filter(item => !item.roles || item.roles.includes(user.role))
    })).filter(group => group.items.length > 0);
  }, [user, sidebarGroups]);

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (!user) return null;

  return (
    <div 
      className={cn(
        "h-screen bg-slate-dark text-white transition-all duration-300 flex flex-col z-20 shrink-0 shadow-2xl",
        isCollapsed ? "w-16" : "w-[260px]"
      )}
    >
      <div className="flex items-center p-4 border-b border-sidebar-border h-16 shrink-0">
        {isCollapsed ? (
          <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shrink-0 shadow-lg shadow-black/10">
            <img src="/boundaryless-mark.png" alt="Boundaryless" className="w-7 h-7 object-contain" />
          </div>
        ) : (
          <div className="h-11 w-full rounded-xl bg-white px-3 py-2 flex items-center shadow-lg shadow-black/10">
            <img src="/boundaryless-logo.png" alt="Boundaryless" className="h-full w-full object-contain" />
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-6 scrollbar-hide">
        {filteredGroups.map((group, gIdx) => (
          <div key={group.group} className={cn(gIdx > 0 && "mt-8")}>
            <div className="px-6 mb-3">
              {!isCollapsed && (
                <span className="text-white/40 text-[10px] uppercase font-bold tracking-[0.15em]">
                  {group.group}
                </span>
              )}
            </div>
            {group.items.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => cn(
                  "flex items-center px-6 py-2.5 text-sm transition-all duration-300 group relative",
                  isActive 
                    ? "text-primary bg-primary/5 font-bold" 
                    : "text-white/60 hover:text-white hover:bg-white/5"
                )}
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary shadow-[0_0_12px_rgba(239,125,0,0.5)]" />
                    )}
                    <item.icon className={cn(
                      "shrink-0 transition-colors",
                      isActive ? "text-primary" : "group-hover:text-white",
                      isCollapsed ? "mx-auto" : "mr-4"
                    )} size={18} />
                    {!isCollapsed && <span>{item.name}</span>}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="mt-auto border-t border-sidebar-border bg-black/10">
        {!isCollapsed ? (
          <div className="p-4">
            <div className="flex items-center gap-3 p-2 rounded-lg bg-white/5 border border-white/5 mb-4 group/user">
              <div className="w-9 h-9 rounded bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-xs">
                {getInitials(user.name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white truncate">{user.name}</p>
                <p className="text-[10px] text-white/40 font-mono truncate uppercase">{user.role}</p>
              </div>
              <button 
                onClick={handleLogout}
                className="opacity-0 group-hover/user:opacity-100 transition-opacity p-1.5 hover:bg-white/10 rounded-md text-white/40 hover:text-white"
                title="Logout"
              >
                <LogOut size={14} />
              </button>
            </div>
            <button 
              onClick={() => setIsCollapsed(true)}
              className="flex items-center gap-3 w-full px-2 py-2 text-white/40 text-[10px] uppercase font-bold tracking-widest hover:text-white transition-colors"
            >
              <ChevronLeft size={16} /> Hide Navigation
            </button>
          </div>
        ) : (
          <div className="p-4 space-y-4">
             <button 
              onClick={handleLogout}
              className="w-8 h-8 flex items-center justify-center text-white/40 hover:text-white mx-auto transition-colors hover:bg-white/10 rounded"
              title="Logout"
            >
              <LogOut size={16} />
            </button>
            <button 
              onClick={() => setIsCollapsed(false)}
              className="w-8 h-8 flex items-center justify-center text-white/40 hover:text-white mx-auto transition-colors bg-white/5 rounded"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
