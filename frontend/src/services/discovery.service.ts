import { apiClient, apiUrl } from './api/client';

export type JobStatus = 'idle' | 'running' | 'done' | 'failed' | 'stopped';

export interface JobState {
  kind: string;
  status: JobStatus;
  running: boolean;
  startedAt: number | null;
  endedAt: number | null;
  exitCode: number | null;
  lineCount: number;
  // Argv the job child was spawned with (present on the campaign/discovery job
  // state). Used to reconstruct an in-flight send after a page reload.
  argv?: string[] | null;
}
export interface JobLine {
  t: number;
  stream: 'stdout' | 'stderr';
  line: string;
}

export const DISCOVERY_STREAM_URL = apiUrl('/api/discovery/stream');

export function fetchDiscoveryStatus(): Promise<JobState> {
  return apiClient<JobState>('/api/discovery/status');
}

export function startCrawl(opts: { limit?: number; maxProfiles?: number; country?: string } = {}): Promise<JobState> {
  return apiClient<JobState>('/api/discovery/start', { method: 'POST', body: JSON.stringify(opts) });
}

export function stopCrawl(): Promise<{ stopping: boolean }> {
  return apiClient<{ stopping: boolean }>('/api/discovery/stop', { method: 'POST', body: JSON.stringify({}) });
}
