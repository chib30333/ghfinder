import { apiClient } from './api/client';

export interface RuntimeSettings {
  github: {
    configured: boolean;
    tokenMask: string;
  };
  storage: {
    dbPath: string;
    exportDir: string;
    usersPerFile: number;
  };
  enrichment: {
    readmeEmail: boolean;
    commitEmail: boolean;
    emailRepoScan: number;
    telegram: boolean;
    discord: boolean;
  };
}

export const EMPTY_RUNTIME_SETTINGS: RuntimeSettings = {
  github: { configured: false, tokenMask: 'Not configured' },
  storage: { dbPath: '', exportDir: '', usersPerFile: 0 },
  enrichment: {
    readmeEmail: false,
    commitEmail: false,
    emailRepoScan: 0,
    telegram: false,
    discord: false,
  },
};

export function fetchSettings(): Promise<RuntimeSettings> {
  return apiClient<RuntimeSettings>('/api/settings');
}
