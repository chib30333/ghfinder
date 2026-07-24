import { apiClient, apiUrl } from './api/client';
import type { JobState } from './discovery.service';

// SSE endpoint that replays + streams the real CDP sender's stdout/stderr.
export const CAMPAIGN_STREAM_URL = apiUrl('/api/campaigns/send/stream');

export interface SendTemplate {
  subject: string;
  message: string;
}

// Persist the subject/body the operator typed so the CDP sender composes the
// same content (with {{firstName}} filled per recipient) that the UI previews.
export function saveTemplate(tpl: SendTemplate): Promise<SendTemplate> {
  return apiClient<SendTemplate>('/api/campaigns/template', {
    method: 'PUT',
    body: JSON.stringify(tpl),
  });
}

export interface StartSendOpts {
  dryRun: boolean;
  all: boolean;
  count?: number;
  index?: number;
  perAccount?: number;
  accounts?: number[];
  // Messages each account (by /u/slot/) already sent today. The sender subtracts
  // these from perAccount so a resumed day tops each account up to the cap
  // instead of sending a fresh full batch. Keyed by slot; omit for drafts.
  sentOffsets?: Record<number, number>;
}

// Spawns backend/apps/sender — the Playwright/CDP process that actually clicks
// Compose, types the recipient/subject/body, and (in send mode) clicks Send.
export function startCampaignSend(opts: StartSendOpts): Promise<JobState> {
  return apiClient<JobState>('/api/campaigns/send/start', {
    method: 'POST',
    body: JSON.stringify(opts),
  });
}

export function stopCampaignSend(): Promise<{ stopping: boolean }> {
  return apiClient<{ stopping: boolean }>('/api/campaigns/send/stop', {
    method: 'POST',
    body: '{}',
  });
}

export function fetchCampaignSendStatus(): Promise<JobState> {
  return apiClient<JobState>('/api/campaigns/send/status');
}
