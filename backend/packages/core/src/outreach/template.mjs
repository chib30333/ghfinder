import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
  rmSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { config } from '../config.mjs';

export const gesDir = join(config.root, 'data', 'ges');
export const templatePath = join(config.root, 'data', 'ges-template.json');

const DEFAULT_TEMPLATE = {
  subject: 'Hi, {{firstName}}',
  message:
    'I came across your GitHub profile and wanted to reach out.\n\n' +
    '<< replace this body: data/ges-template.json >>\n\n' +
    'Thanks,\nYour Name',
};

export function loadTemplate() {
  if (!existsSync(templatePath)) {
    mkdirSync(dirname(templatePath), { recursive: true });
    writeFileSync(templatePath, JSON.stringify(DEFAULT_TEMPLATE, null, 2) + '\n');
    return { ...DEFAULT_TEMPLATE, _created: true };
  }
  let tpl;
  try {
    tpl = JSON.parse(readFileSync(templatePath, 'utf8'));
  } catch (e) {
    throw new Error(`ges-template.json is not valid JSON: ${e.message}`);
  }
  if (typeof tpl.subject !== 'string' || typeof tpl.message !== 'string') {
    throw new Error('ges-template.json must have string "subject" and "message" fields.');
  }
  return tpl;
}

export function firstName(name, fallback = 'there') {
  const first = String(name ?? '').trim().split(/\s+/)[0];
  return first || fallback;
}

const fill = (text, first) => text.replace(/\{\{\s*firstName\s*\}\}/g, first);

export function toEntry(row, tpl) {
  const first = firstName(row.name);
  return {
    email: String(row.email).trim(),
    subject: fill(tpl.subject, first),
    message: fill(tpl.message, first),
  };
}

const BATCH_RE = /^batch_(\d+)\.json$/;

function clearBatches() {
  if (!existsSync(gesDir)) return;
  for (const name of readdirSync(gesDir)) {
    if (BATCH_RE.test(name)) rmSync(join(gesDir, name));
  }
}

const batchName = (i) => `batch_${String(i).padStart(4, '0')}.json`;

export function buildBatches(rows, tpl, size) {
  if (!existsSync(gesDir)) mkdirSync(gesDir, { recursive: true });
  clearBatches();
  const entries = rows.map((r) => toEntry(r, tpl));
  let files = 0;
  for (let i = 0; i < entries.length; i += size) {
    const chunk = entries.slice(i, i + size);
    writeFileSync(join(gesDir, batchName(files + 1)), JSON.stringify(chunk, null, 2) + '\n');
    files++;
  }
  return { recipients: entries.length, files, size, dir: gesDir };
}

export function saveTemplate(tpl) {
  if (typeof tpl?.subject !== 'string' || typeof tpl?.message !== 'string') {
    throw new Error('template must have string "subject" and "message" fields.');
  }
  const clean = { subject: tpl.subject, message: tpl.message };
  mkdirSync(dirname(templatePath), { recursive: true });
  writeFileSync(templatePath, JSON.stringify(clean, null, 2) + '\n');
  return clean;
}
