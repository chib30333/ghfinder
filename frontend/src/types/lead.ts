export type EmailSource = 'readme' | 'profile' | 'commits' | null;

// Outreach state of a lead, derived from the backend's emailed_at stamp:
// 'done' = already emailed (or retired by hand), 'active' = still to contact.
export type LeadStatus = 'active' | 'done';

export interface Lead {
  login: string;
  name: string;
  loc: string;
  city: string;
  email: string | null;
  src: EmailSource;
  followers: number;
  repos: number;
  hireable: boolean;
  tg: boolean;
  dc: boolean;
  company: string;
  status: LeadStatus;
  emailedAt: string | null;
  fetched: string;
  bio: string;
  blog: string;
  tw: string;
}
