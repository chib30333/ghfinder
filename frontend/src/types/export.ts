export interface ExportFile {
  name: string;
  type: string;
  records: number;
  size: string;
  created: string;
  kind: 'txt' | 'csv' | 'json';
}
