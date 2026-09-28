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

// Upper bound on the rotation. Past ~10 variants the operator can no longer keep
// the copy consistent, and the deliverability win from more variation flattens.
export const MAX_TEMPLATES = 10;

const DEFAULT_TEMPLATE = {
  subject: 'Hi, {{firstName}}',
  message:
    'I came across your GitHub profile and wanted to reach out.\n\n' +
    '<< replace this body: data/ges-template.json >>\n\n' +
    'Thanks,\nYour Name',
};

const strip = (tpl) => ({ subject: tpl.subject, message: tpl.message });

// Accepts the rotation shape ({ templates: [...] }), a bare array, and the
// original single-template shape ({ subject, message }) — which normalises to a
// one-entry rotation, so an untouched ges-template.json keeps working.
function normalize(raw, where) {
  const list = Array.isArray(raw?.templates) ? raw.templates : Array.isArray(raw) ? raw : [raw];
  if (list.length === 0) {
    throw new Error(`${where} must hold at least one template.`);
  }
  if (list.length > MAX_TEMPLATES) {
    throw new Error(`${where} may hold at most ${MAX_TEMPLATES} templates (got ${list.length}).`);
  }
  list.forEach((tpl, i) => {
    if (typeof tpl?.subject !== 'string' || typeof tpl?.message !== 'string') {
      throw new Error(
        `${where}: template ${i + 1} of ${list.length} must have string "subject" and "message" fields.`,
      );
    }
  });
  return list.map(strip);
}

export function loadTemplates() {
  if (!existsSync(templatePath)) {
    mkdirSync(dirname(templatePath), { recursive: true });
    writeFileSync(templatePath, JSON.stringify({ templates: [DEFAULT_TEMPLATE] }, null, 2) + '\n');
    return { templates: [strip(DEFAULT_TEMPLATE)], created: true };
  }
  let raw;
  try {
    raw = JSON.parse(readFileSync(templatePath, 'utf8'));
  } catch (e) {
    throw new Error(`ges-template.json is not valid JSON: ${e.message}`);
  }
  return { templates: normalize(raw, 'ges-template.json'), created: false };
}

export function saveTemplates(templates) {
  const clean = normalize(templates, 'template rotation');
  mkdirSync(dirname(templatePath), { recursive: true });
  writeFileSync(templatePath, JSON.stringify({ templates: clean }, null, 2) + '\n');
  return clean;
}

// Picks the nth message's template, wrapping at the end of the rotation. Callers
// pass a per-account counter so each account walks the whole rotation in order
// instead of being pinned to one variant (see the sender's send loop).
export function templateAt(templates, n) {
  const list = Array.isArray(templates) ? templates : [templates];
  const i = Math.trunc(n) % list.length;
  return list[i < 0 ? i + list.length : i];
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

export function buildBatches(rows, templates, size) {
  if (!existsSync(gesDir)) mkdirSync(gesDir, { recursive: true });
  clearBatches();
  // Rotate through the templates in order across the whole recipient list, so a
  // batch file carries a mix of variants rather than one repeated body.
  const entries = rows.map((r, i) => toEntry(r, templateAt(templates, i)));
  let files = 0;
  for (let i = 0; i < entries.length; i += size) {
    const chunk = entries.slice(i, i + size);
    writeFileSync(join(gesDir, batchName(files + 1)), JSON.stringify(chunk, null, 2) + '\n');
    files++;
  }
  return { recipients: entries.length, files, size, dir: gesDir };
}
