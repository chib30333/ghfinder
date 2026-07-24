import type { Tone } from '@/types';

export const toneQuietBg: Record<Tone, string> = {
  accent: 'bg-accent-quiet',
  success: 'bg-success-quiet',
  warning: 'bg-warning-quiet',
  danger: 'bg-danger-quiet',
  info: 'bg-info-quiet',
  neutral: 'bg-surface-2',
};

export const toneText: Record<Tone, string> = {
  accent: 'text-accent',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  info: 'text-info',
  neutral: 'text-muted',
};

export const toneSolidBg: Record<Tone, string> = {
  accent: 'bg-accent',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
  neutral: 'bg-muted',
};
