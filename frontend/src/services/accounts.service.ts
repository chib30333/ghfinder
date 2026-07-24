import type { Account } from '@/types';
import { apiClient } from './api/client';

interface AccountWire {
  index: number;
  email: string | null;
  title: string | null;
  url: string | null;
}
interface AccountsResponse {
  cdp: 'up' | 'down';
  endpoint: string;
  accounts: AccountWire[];
}

export interface AccountsResult {
  cdp: 'up' | 'down';
  endpoint: string;
  accounts: Account[];
}

const DEFAULT_CAP = 15;

function toAccount(a: AccountWire, cap: number): Account {
  return {
    slot: a.index,
    index: a.index,
    email: a.email ?? `account ${a.index}`,
    title: a.title ?? '',
    url: a.url ?? '',
    status: 'ready',
    sent: 0,
    cap,
    last: '—',
  };
}

function toResult(r: AccountsResponse, cap: number): AccountsResult {
  return { cdp: r.cdp, endpoint: r.endpoint, accounts: (r.accounts ?? []).map((a) => toAccount(a, cap)) };
}

export async function fetchAccounts(defaultCap = DEFAULT_CAP): Promise<AccountsResult> {
  return toResult(await apiClient<AccountsResponse>('/api/accounts'), defaultCap);
}

export async function launchBrowser(defaultCap = DEFAULT_CAP): Promise<AccountsResult & { launched: boolean }> {
  const r = await apiClient<AccountsResponse & { launched?: boolean }>('/api/accounts/launch', {
    method: 'POST',
    body: '{}',
  });
  return { ...toResult(r, defaultCap), launched: !!r.launched };
}

export function addGmailAccount(): Promise<{ opened: boolean }> {
  return apiClient<{ opened: boolean }>('/api/accounts/add', { method: 'POST', body: '{}' });
}

export function openMailbox(index: number): Promise<{ opened: boolean; focused: boolean }> {
  return apiClient<{ opened: boolean; focused: boolean }>('/api/accounts/open', {
    method: 'POST',
    body: JSON.stringify({ index }),
  });
}
