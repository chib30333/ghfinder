import type { ExportFile } from '@/types';
import { bytes, timeAgo } from '@/lib/format';
import { apiClient } from './api/client';

interface ExportEntry {
  name: string;
  size: number;
  mtime: number;
}
interface ExportsResponse {
  batches: ExportEntry[];
  ges: ExportEntry[];
  link: ExportEntry[];
}

function toFile(e: ExportEntry, type: string, kind: ExportFile['kind']): ExportFile {
  return {
    name: e.name,
    type,
    records: 0,
    size: bytes(e.size),
    created: timeAgo(new Date(e.mtime).toISOString()),
    kind,
  };
}

export async function fetchExports(): Promise<ExportFile[]> {
  const r = await apiClient<ExportsResponse>('/api/exports');
  return [
    ...(r.batches ?? []).map((e) => toFile(e, 'batch', 'txt')),
    ...(r.ges ?? []).map((e) => toFile(e, 'GES', 'json')),
    ...(r.link ?? []).map((e) => toFile(e, 'social', 'csv')),
  ].sort((a, b) => (a.name < b.name ? 1 : a.name > b.name ? -1 : 0));
}
