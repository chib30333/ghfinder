export interface Account {
  slot: number;
  index: number;
  email: string;
  title: string;
  url: string;
  status: 'sending' | 'ready' | 'capped' | 'idle';
  sent: number;
  cap: number;
  last: string;
}
