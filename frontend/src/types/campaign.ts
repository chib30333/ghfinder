export type LogStream = 'stdout' | 'stderr';

export interface SendLog {
  stream: LogStream;
  line: string;
}

export interface SendAcct {
  slot: number;
  email: string;
  sent: number;
  cap: number;
  // Set once this account hits a Gmail block/verification prompt: it is pulled
  // out of the send rotation for the rest of the day (this run).
  blocked: boolean;
}

export type SendStatus = 'running' | 'stopping' | 'stopped' | 'done' | 'failed';

export interface SendRun {
  dry: boolean;
  status: SendStatus;
  startedAt: number;
  endedAt: number | null;
  sent: number;
  total: number;
  accts: SendAcct[];
  // slot = the sending account (/u/slot/); index = the sender's global 1-based
  // message number ([index/total]) — used to de-duplicate the daily send tally
  // when the SSE stream replays on reconnect/reload.
  current: { name: string; email: string; slot: number; index: number } | null;
  waiting: number;
  logs: SendLog[];
  // Highest message index already folded into `sent`/`accts` for THIS run's live
  // monitor. In-memory only (resets on reload) — de-dups the SSE buffer replay
  // that fires on every EventSource (re)connect so the monitor can't over-count.
  counted: number;
}
