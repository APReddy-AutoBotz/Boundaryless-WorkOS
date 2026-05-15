/**
 * authService.ts — Dual-mode authentication.
 * API mode: calls POST /api/auth/login, stores token in sessionStorage.
 * Demo mode: validates against localStorage accounts (SHA-256, existing behavior).
 */
import { UserAccount, UserRole, UserSession, CountryDirector } from '../types';
import { DataStorage, STORAGE_KEYS } from './storage';
import { checkBackend, storeToken, clearToken, getToken, resetBackendCheck, isDemoFallbackAllowed } from './apiClient';

const DEMO_PASSWORD = 'demo123';
const SESSION_KEY = 'rut_session';

// ─── SHA-256 helper (demo mode only) ─────────────────────────────────────────
const sha256 = async (value: string) => {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
};

const normalize = (v: string) => v.trim().toLowerCase();

const findAccount = (identifier: string): UserAccount | undefined => {
  const lookup = normalize(identifier);
  const accounts = DataStorage.get<UserAccount[]>(STORAGE_KEYS.USER_ACCOUNTS, []);
  return accounts.find(a =>
    normalize(a.userName) === lookup ||
    normalize(a.email) === lookup ||
    normalize(a.employeeId) === lookup
  );
};

const buildSession = (account: UserAccount, role: UserRole): UserSession => {
  const session: UserSession = {
    id: account.employeeRecordId,
    userName: account.userName,
    employeeId: account.employeeId,
    name: account.displayName,
    email: account.email,
    role,
    availableRoles: account.roles,
    lastLogin: new Date().toISOString(),
  };
  if (role === 'CountryDirector') {
    const directors = DataStorage.get<CountryDirector[]>(STORAGE_KEYS.CDS, []);
    const cd = directors.find(d => d.name === account.displayName);
    if (cd) session.cdId = cd.id;
  }
  return session;
};

type ApiLoginResponse = {
  id: string;
  username: string;
  employeeId: string;
  employeeRecordId?: string;
  countryDirectorId?: string;
  email: string;
  name?: string;
  roles: UserRole[];
  activeRole: UserRole;
  mustChangePassword?: boolean;
  token: string;
};

const buildApiSession = (data: ApiLoginResponse): UserSession => ({
  id: data.employeeRecordId || data.employeeId || data.id,
  userName: data.username,
  employeeId: data.employeeId,
  name: data.name || data.username,
  email: data.email,
  role: data.activeRole,
  availableRoles: data.roles,
  cdId: data.countryDirectorId,
  mustChangePassword: data.mustChangePassword,
  lastLogin: new Date().toISOString(),
});

// ─── Session storage (works in both modes) ────────────────────────────────────
const saveSession = (session: UserSession) =>
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));

const loadSession = (): UserSession | null => {
  try {
    // API mode: sessionStorage
    const s = sessionStorage.getItem(SESSION_KEY);
    if (s) return JSON.parse(s) as UserSession;
    // Demo fallback: localStorage
    return DataStorage.get<UserSession | null>(STORAGE_KEYS.AUTH, null);
  } catch { return null; }
};

// ─── Public service ───────────────────────────────────────────────────────────
export const authService = {
  login: async (identifier: string, password = '', requestedRole?: UserRole): Promise<UserSession | null> => {
    let backendConnected = false;
    try {
      backendConnected = await checkBackend();
    } catch {
      return null;
    }

    if (backendConnected) {
      // ── API mode ──
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ username: identifier, password, requestedRole }),
        });
        if (!res.ok) return null;
        const data = await res.json() as ApiLoginResponse;
        const session = buildApiSession(data);
        storeToken(data.token);
        saveSession(session);
        return session;
      } catch { return null; }
    }

    if (!isDemoFallbackAllowed()) return null;

    // ── Demo / localStorage mode ──
    DataStorage.ensureUserAccounts();
    const account = findAccount(identifier);
    if (!account || account.status !== 'Active') return null;
    const expectedHash = account.passwordHash.replace(/^sha256:/, '');
    const suppliedHash = await sha256(password);
    if (suppliedHash !== expectedHash) return null;
    const role = requestedRole && account.roles.includes(requestedRole) ? requestedRole : account.primaryRole;
    const session = buildSession(account, role);
    DataStorage.set(STORAGE_KEYS.AUTH, session);
    saveSession(session);
    DataStorage.logAction(session.id, session.name, session.role, 'Login', 'Auth', `Logged in as ${role}`);
    return session;
  },

  switchRole: async (role: UserRole): Promise<UserSession | null> => {
    const session = authService.getCurrentUser();
    if (!session || !session.availableRoles.includes(role)) return null;
    let backendConnected = false;
    try {
      backendConnected = await checkBackend();
    } catch {
      return null;
    }
    if (backendConnected) {
      try {
        const res = await fetch('/api/auth/switch-role', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
          },
          credentials: 'include',
          body: JSON.stringify({ role }),
        });
        if (!res.ok) return null;
        const data = await res.json() as ApiLoginResponse;
        const next = buildApiSession(data);
        storeToken(data.token);
        saveSession(next);
        return next;
      } catch {
        return null;
      }
    }

    if (!isDemoFallbackAllowed()) return null;

    const next = { ...session, role };
    if (role === 'CountryDirector') {
      const directors = DataStorage.get<CountryDirector[]>(STORAGE_KEYS.CDS, []);
      const cd = directors.find(d => d.name === session.name);
      next.cdId = cd?.id;
    } else {
      delete next.cdId;
    }
    saveSession(next);
    DataStorage.set(STORAGE_KEYS.AUTH, next);
    return next;
  },

  logout: async () => {
    const session = authService.getCurrentUser();
    let backendConnected = false;
    try {
      backendConnected = await checkBackend();
    } catch {
      backendConnected = false;
    }
    if (backendConnected) {
      try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }); } catch { /* ok */ }
      clearToken();
      resetBackendCheck();
    }
    if (session) {
      DataStorage.logAction(session.id, session.name, session.role, 'Logout', 'Auth', 'Logged out');
    }
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(STORAGE_KEYS.AUTH);
  },

  getCurrentUser: (): UserSession | null => loadSession(),

  isAuthenticated: (): boolean => !!authService.getCurrentUser(),

  hasRole: (roles: UserRole[]): boolean => {
    const user = authService.getCurrentUser();
    return !!user && roles.includes(user.role);
  },

  getAccountByIdentifier: (identifier: string): UserAccount | undefined => {
    DataStorage.ensureUserAccounts();
    return findAccount(identifier);
  },

  getDemoPassword: () => DEMO_PASSWORD,

  changePassword: async (currentPassword: string, newPassword: string): Promise<boolean> => {
    let backendConnected = false;
    try {
      backendConnected = await checkBackend();
    } catch {
      return false;
    }
    if (backendConnected) {
      try {
        const res = await fetch('/api/auth/change-password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
          },
          credentials: 'include',
          body: JSON.stringify({ currentPassword, newPassword }),
        });
        if (!res.ok) return false;
        const session = authService.getCurrentUser();
        if (session) {
          const next = { ...session, mustChangePassword: false };
          saveSession(next);
          DataStorage.set(STORAGE_KEYS.AUTH, next);
        }
        return true;
      } catch {
        return false;
      }
    }

    if (!isDemoFallbackAllowed()) return false;
    DataStorage.ensureUserAccounts();
    const session = authService.getCurrentUser();
    if (!session) return false;
    const account = findAccount(session.userName);
    if (!account || account.status !== 'Active') return false;
    const expectedHash = account.passwordHash.replace(/^sha256:/, '');
    const suppliedHash = await sha256(currentPassword);
    if (suppliedHash !== expectedHash) return false;
    const accounts = DataStorage.get<UserAccount[]>(STORAGE_KEYS.USER_ACCOUNTS, []);
    const nextHash = `sha256:${await sha256(newPassword)}`;
    DataStorage.set(STORAGE_KEYS.USER_ACCOUNTS, accounts.map(item =>
      item.id === account.id ? { ...item, passwordHash: nextHash, mustChangePassword: false } : item
    ));
    const nextSession = { ...session, mustChangePassword: false };
    saveSession(nextSession);
    DataStorage.set(STORAGE_KEYS.AUTH, nextSession);
    DataStorage.logAction(session.id, session.name, session.role, 'Change Password', 'Auth', 'Changed own password');
    return true;
  },
};
