import type { EmailSource, Lead } from '@/types';
import { timeAgo } from '@/lib/format';
import { apiClient, qs } from './api/client';

export type LeadSortKey = 'login' | 'followers' | 'repos';
export type SortDir = 'asc' | 'desc';
export type LeadSource = 'all' | 'readme' | 'profile' | 'commits';

export interface LeadQuery {
  search?: string;
  hasEmail?: boolean;
  hireable?: boolean;
  source?: LeadSource;
  sort?: { key: LeadSortKey; dir: SortDir };
  limit?: number;
  offset?: number;
}

interface LeadRow {
  login: string;
  name: string | null;
  company: string | null;
  location: string | null;
  email: string | null;
  email_source: string | null;
  followers: number | null;
  public_repos: number | null;
  hireable: number | null;
  telegram: string | null;
  discord: string | null;
  fetched_at: string | null;
  source_city: string | null;
}
interface LeadDetailRow extends LeadRow {
  blog: string | null;
  bio: string | null;
  twitter: string | null;
}
interface LeadsResponse {
  rows: LeadRow[];
  total: number;
  limit: number;
  offset: number;
}

const VALID_SRC = new Set(['readme', 'profile', 'commits']);
const SORT_COLUMN: Record<LeadSortKey, string> = {
  login: 'login',
  followers: 'followers',
  repos: 'public_repos',
};

function mapLead(r: LeadRow, extra?: Pick<LeadDetailRow, 'bio' | 'blog' | 'twitter'>): Lead {
  const src = r.email_source && VALID_SRC.has(r.email_source) ? (r.email_source as EmailSource) : null;
  return {
    login: r.login,
    name: r.name ?? r.login,
    loc: r.location ?? '',
    city: r.source_city ?? r.location ?? '',
    email: r.email && r.email.trim() ? r.email : null,
    src,
    followers: r.followers ?? 0,
    repos: r.public_repos ?? 0,
    hireable: r.hireable === 1,
    tg: r.telegram != null,
    dc: r.discord != null,
    company: r.company ?? '',
    fetched: timeAgo(r.fetched_at),
    bio: extra?.bio ?? '',
    blog: extra?.blog ?? '',
    tw: extra?.twitter ?? '',
  };
}

export async function fetchLeads(q: LeadQuery = {}): Promise<{ leads: Lead[]; total: number }> {
  const query = qs({
    search: q.search?.trim() || undefined,
    hasEmail: q.hasEmail ? 1 : undefined,
    hireable: q.hireable ? 1 : undefined,
    emailSource: q.source && q.source !== 'all' ? q.source : undefined,
    sort: q.sort ? SORT_COLUMN[q.sort.key] : undefined,
    order: q.sort?.dir,
    limit: q.limit ?? 50,
    offset: q.offset ?? 0,
  });
  const res = await apiClient<LeadsResponse>(`/api/leads${query}`);
  return { leads: (res.rows ?? []).map((r) => mapLead(r)), total: res.total ?? 0 };
}

export async function fetchLeadDetail(login: string): Promise<Lead> {
  const r = await apiClient<LeadDetailRow>(`/api/leads/${encodeURIComponent(login)}`);
  return mapLead(r, { bio: r.bio, blog: r.blog, twitter: r.twitter });
}

export async function fetchRecipientCount(): Promise<number> {
  const r = await apiClient<{ unique: number }>('/api/campaigns/recipients');
  return r.unique ?? 0;
}
