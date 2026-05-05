/**
 * authService.ts — Dual-mode authentication.
 * API mode: calls POST /api/auth/login, stores token in sessionStorage.
 * Demo mode: validates against localStorage accounts (SHA-256, existing behavior).
 */
import { UserAccount, UserRole, UserSession, CountryDirector } from '../types';
import { DataStorage, STORAGE_KEYS } from './storage';
import { checkBackend, storeToken, clearToken, getToken, resetBackendCheck } from './apiClient';

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
    if (await checkBackend()) {
      // ── API mode ──
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ userName: identifier, password, requestedRole }),
        });
        if (!res.ok) return null;
        const data = await res.json() as { token: string; session: UserSession };
        storeToken(data.token);
        saveSession(data.session);
        return data.session;
      } catch { return null; }
    }

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

  switchRole: (role: UserRole): UserSession | null => {
    const session = authService.getCurrentUser();
    if (!session || !session.availableRoles.includes(role)) return null;
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
    if (await checkBackend()) {
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
};
