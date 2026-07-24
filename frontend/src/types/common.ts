export type Theme = 'dark' | 'light';

export type Screen =
  | 'dashboard'
  | 'discovery'
  | 'countries'
  | 'cities'
  | 'leads'
  | 'campaigns'
  | 'accounts'
  | 'exports'
  | 'settings'
  | 'profile';

export type AuthView = 'signin' | 'signup' | 'forgot' | 'sent' | 'reset';
export type Mode = 'draft' | 'send';
export type Scope = 'all' | 'count';
export type CdpState = 'up' | 'down';

export type Tone = 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
