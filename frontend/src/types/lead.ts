export type EmailSource = 'readme' | 'profile' | 'commits' | null;

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
  fetched: string;
  bio: string;
  blog: string;
  tw: string;
}
