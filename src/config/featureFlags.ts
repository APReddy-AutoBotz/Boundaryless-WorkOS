const frontendEnv = ((import.meta as unknown as { env?: Record<string, string | undefined> }).env || {});

export type EnterpriseFeatureFlag = 'leave' | 'notifications' | 'teams' | 'entra' | 'planning';

const readFlag = (viteKey: string, serverKey: string) => {
  const value = frontendEnv[viteKey] ?? frontendEnv[serverKey] ?? 'false';
  return ['true', '1', 'yes', 'on'].includes(String(value).trim().toLowerCase());
};

export const enterpriseFeatureFlags: Record<EnterpriseFeatureFlag, boolean> = {
  leave: readFlag('VITE_FEATURE_LEAVE', 'FEATURE_LEAVE'),
  notifications: readFlag('VITE_FEATURE_NOTIFICATIONS', 'FEATURE_NOTIFICATIONS'),
  teams: readFlag('VITE_FEATURE_TEAMS', 'FEATURE_TEAMS'),
  entra: readFlag('VITE_FEATURE_ENTRA', 'FEATURE_ENTRA'),
  planning: readFlag('VITE_FEATURE_PLANNING', 'FEATURE_PLANNING'),
};

export const isEnterpriseFeatureEnabled = (flag: EnterpriseFeatureFlag) => enterpriseFeatureFlags[flag];
