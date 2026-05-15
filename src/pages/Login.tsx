import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { authService } from '../services/authService';
import { UserAccount, UserRole } from '../types';
import { LogIn, Users, Shield, Briefcase, Globe, Info, UserCheck, LockKeyhole, Database, Clock3 } from 'lucide-react';
import { DataStorage, STORAGE_KEYS } from '../services/storage';
import { NoticeBanner } from '../components/ui/NoticeBanner';
import { isDemoFallbackAllowed } from '../services/apiClient';

const roles: { role: UserRole; icon: any; color: string; desc: string }[] = [
  { role: 'Admin', icon: Shield, color: 'text-purple-600 bg-purple-50', desc: 'Full system control, settings, and high-level audits.' },
  { role: 'HR', icon: Users, color: 'text-blue-600 bg-blue-50', desc: 'Employee data management and workforce reports.' },
  { role: 'CountryDirector', icon: Globe, color: 'text-orange-600 bg-orange-50', desc: 'Regional oversight and consultant mapping.' },
  { role: 'ProjectManager', icon: Briefcase, color: 'text-emerald-600 bg-emerald-50', desc: 'Project health, PM-scoped allocations, and approvals.' },
  { role: 'TeamLead', icon: UserCheck, color: 'text-cyan-600 bg-cyan-50', desc: 'Team-level visibility and operational tracking.' },
  { role: 'Employee', icon: Users, color: 'text-slate-600 bg-slate-50', desc: 'Personal timesheets and own allocation view.' },
];

export const Login = () => {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [account, setAccount] = useState<UserAccount | undefined>(undefined);
  const [loginError, setLoginError] = useState('');
  const showDemoShortcuts = isDemoFallbackAllowed();

  useEffect(() => {
    // Login is a public route. Do not call protected employee APIs here, because
    // production/API mode correctly returns 401 before authentication.
    if (showDemoShortcuts) {
      DataStorage.initialize();
      setEmployees(DataStorage.get(STORAGE_KEYS.EMPLOYEES, []));
    }
  }, []);

  useEffect(() => {
    const found = identifier ? authService.getAccountByIdentifier(identifier) : undefined;
    setAccount(found);
    if (found) {
      setSelectedRole(current => current && found.roles.includes(current) ? current : found.primaryRole);
    } else {
      setSelectedRole(undefined);
    }
  }, [identifier]);

  const allowedRoleCards = useMemo(() => {
    if (!account) return [];
    return roles.filter(role => account.roles.includes(role.role));
  }, [account]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setLoginError('');
    const session = await authService.login(identifier, password, selectedRole);
    if (session) {
      navigate('/');
    } else {
      setLoginError('Login failed. Check your username, password, and assigned role.');
    }
    setLoading(false);
  };

  const selectDemoUser = (emp: any, role: UserRole) => {
    if (!emp) return;
    const found = authService.getAccountByIdentifier(emp.email);
    setIdentifier(found?.userName || emp.email);
    setPassword(authService.getDemoPassword());
    setSelectedRole(role);
  };

  return (
    <div className="min-h-screen bg-bg-secondary relative overflow-hidden flex items-center justify-center p-4 sm:p-6">
      <div
        className="absolute inset-0 bg-cover bg-center opacity-[0.18]"
        style={{ backgroundImage: "url('/login-workspace-bg.svg')" }}
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-gradient-to-br from-white via-white/90 to-[#e8f1f4]/80" aria-hidden="true" />
      <div className="absolute inset-y-0 left-0 w-[54vw] bg-gradient-to-r from-white via-white/72 to-transparent" aria-hidden="true" />

      <div className="relative z-10 max-w-6xl w-full grid grid-cols-1 lg:grid-cols-[0.88fr_1fr] gap-6 items-stretch">
        <section className="bg-slate-dark/95 text-white rounded-3xl border border-white/10 shadow-xl overflow-hidden flex flex-col relative">
          <div
            className="absolute inset-0 bg-cover bg-center opacity-[0.08]"
            style={{ backgroundImage: "url('/login-workspace-bg.svg')" }}
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-slate-dark via-slate-dark/96 to-[#002a4b]/96" aria-hidden="true" />
          <div className="bg-white px-8 py-5 border-b border-border-light">
            <img src="/boundaryless-logo.png" alt="Boundaryless" className="h-10 w-auto object-contain" />
          </div>

          <div className="relative p-8 flex-1 flex flex-col justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white/70">
                <LockKeyhole size={13} className="text-primary" />
                Authorized Internal Access
              </div>

              <div className="mt-8">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">StaffPulse Workforce Operations Core</p>
                <h1 className="mt-3 text-2xl sm:text-3xl font-black tracking-tight leading-tight">
                  Internal workforce planning workspace
                </h1>
                <p className="mt-4 text-sm leading-6 text-white/60 max-w-md">
                  Use this system for employee capacity, client/project assignments, utilization reporting, timesheet governance, and audit review.
                </p>
              </div>

              <div className="mt-8 space-y-3">
                {[
                  { icon: Users, label: 'People data', text: 'Employees, roles, Country Director mappings, and active assignments.' },
                  { icon: Briefcase, label: 'Delivery data', text: 'Clients, projects, allocations, PM ownership, and project staffing.' },
                  { icon: Database, label: 'Audit data', text: 'Timesheet approvals, master-data changes, imports, exports, and governance events.' },
                ].map(item => (
                  <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 flex gap-3">
                    <div className="mt-0.5 h-9 w-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-primary">
                      <item.icon size={17} />
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest">{item.label}</p>
                      <p className="text-[11px] leading-5 text-white/50 mt-1">{item.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="flex items-center gap-2 text-primary">
                <Clock3 size={14} />
                <p className="text-[10px] font-bold uppercase tracking-widest">Access note</p>
              </div>
              <p className="mt-2 text-[11px] leading-5 text-white/55">
                Access is role based. Shared UAT credentials are available only for testing and must be replaced by named production accounts before go-live.
              </p>
            </div>
          </div>
        </section>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-border-light p-6 sm:p-8 lg:p-10 rounded-3xl shadow-xl relative overflow-hidden"
        >
          <div className="relative z-10">
            <div className="mb-7 flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Sign in</p>
                <h2 className="text-2xl font-black text-heading mt-2">Internal workspace access</h2>
                <p className="text-gray-400 text-sm mt-2">Use your assigned username and password.</p>
              </div>
              <div className="hidden sm:flex h-11 w-11 rounded-2xl bg-orange-50 text-primary items-center justify-center">
                <Shield size={20} />
              </div>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
              {loginError && (
                <NoticeBanner
                  type="danger"
                  title="Authentication"
                  message={loginError}
                  onClose={() => setLoginError('')}
                />
              )}

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Username</label>
                <div className="relative">
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="Username, employee ID, or work email"
                    className="w-full bg-slate-50 border border-border-light rounded-xl py-3.5 px-4 text-sm font-medium outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                    required
                    autoComplete="username"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300">
                    <Users size={18} />
                  </div>
                </div>
                {account && (
                  <p className="mt-2 text-[10px] text-gray-400 font-medium">
                    Signing in as {account.displayName}. Assigned roles: {account.roles.join(', ')}.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Password</label>
                <div className="relative">
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    className="w-full bg-slate-50 border border-border-light rounded-xl py-3.5 px-4 text-sm font-medium outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                    required
                    autoComplete="current-password"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300">
                    <Shield size={18} />
                  </div>
                </div>
                {showDemoShortcuts && (
                  <p className="mt-2 text-[10px] text-gray-400 font-medium">UAT seeded users use the configured demo password. Production must use named accounts and server-side password policies.</p>
                )}
              </div>

              {allowedRoleCards.length > 1 && (
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Access Role</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {allowedRoleCards.map((r) => (
                      <button
                        key={r.role}
                        type="button"
                        onClick={() => setSelectedRole(r.role)}
                        className={`p-3 rounded-xl flex items-center justify-center gap-2 transition-all border text-[10px] font-bold uppercase tracking-widest ${
                          selectedRole === r.role 
                            ? 'border-primary bg-orange-50/50 text-primary shadow-sm' 
                            : 'border-border-light hover:border-gray-300 bg-white text-gray-400'
                        }`}
                        title={r.desc}
                      >
                        <r.icon size={16} />
                        {r.role}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-slate-dark text-white rounded-xl py-3.5 font-bold text-sm tracking-wide shadow-xl shadow-slate-900/10 hover:bg-black transition-all flex items-center justify-center gap-2 group"
              >
                {loading ? 'Authenticating...' : 'Open Workspace'}
                <LogIn size={18} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </form>

            {showDemoShortcuts && (
            <div className="mt-8 pt-6 border-t border-border-light">
              <div className="flex items-center gap-2 mb-4 text-primary">
                <Info size={14} />
                <span className="text-[10px] font-bold uppercase tracking-widest">UAT account shortcuts</span>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5">
                <button 
                  onClick={() => selectDemoUser(employees.find(e => e.employeeId === 'ADMIN-1'), 'Admin')}
                  className="text-left p-3 rounded-xl border border-border-light hover:border-primary/30 hover:bg-orange-50/30 transition-colors"
                >
                  <p className="text-[10px] font-bold text-heading">Admin-1</p>
                  <p className="text-[9px] text-gray-400 truncate">admin-1 / demo123</p>
                </button>
                <button 
                   onClick={() => selectDemoUser(employees.find(e => e.employeeId === 'EMP-1'), 'Employee')}
                  className="text-left p-3 rounded-xl border border-border-light hover:border-primary/30 hover:bg-orange-50/30 transition-colors"
                >
                  <p className="text-[10px] font-bold text-heading">Emp-1</p>
                  <p className="text-[9px] text-gray-400 truncate">emp-1 / demo123</p>
                </button>
                 <button 
                   onClick={() => selectDemoUser(employees.find(e => e.employeeId === 'CD-1'), 'CountryDirector')}
                  className="text-left p-3 rounded-xl border border-border-light hover:border-primary/30 hover:bg-orange-50/30 transition-colors"
                >
                  <p className="text-[10px] font-bold text-heading">CD-1</p>
                  <p className="text-[9px] text-gray-400 truncate">cd-1 / demo123</p>
                </button>
                 <button 
                   onClick={() => selectDemoUser(employees.find(e => e.employeeId === 'PM-1'), 'ProjectManager')}
                  className="text-left p-3 rounded-xl border border-border-light hover:border-primary/30 hover:bg-orange-50/30 transition-colors"
                >
                  <p className="text-[10px] font-bold text-heading">PM-1</p>
                  <p className="text-[9px] text-gray-400 truncate">pm-1 / demo123</p>
                </button>
                 <button 
                   onClick={() => selectDemoUser(employees.find(e => e.employeeId === 'EMP-12'), 'Employee')}
                  className="text-left p-3 rounded-xl border border-border-light hover:border-primary/30 hover:bg-orange-50/30 transition-colors"
                >
                  <p className="text-[10px] font-bold text-heading">Emp-12</p>
                  <p className="text-[9px] text-gray-400 truncate">multi-project demo</p>
                </button>
                 <button 
                   onClick={() => selectDemoUser(employees.find(e => e.employeeId === 'HR-1'), 'HR')}
                  className="text-left p-3 rounded-xl border border-border-light hover:border-primary/30 hover:bg-orange-50/30 transition-colors"
                >
                  <p className="text-[10px] font-bold text-heading">HR-1</p>
                  <p className="text-[9px] text-gray-400 truncate">hr-1 / demo123</p>
                </button>
              </div>
            </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};
