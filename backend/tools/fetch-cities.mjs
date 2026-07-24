import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { config } from '../packages/core/src/config.mjs';

const SRC =
  'https://raw.githubusercontent.com/grammakov/USA-cities-and-states/master/us_cities_states_counties.csv';

const csvField = (s) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

async function main() {
  console.error(`Downloading ${SRC} ...`);
  const res = await fetch(SRC);
  if (!res.ok) throw new Error(`download failed: HTTP ${res.status}`);
  const text = await res.text();

  const lines = text.split(/\r?\n/);
  lines.shift();

  const SKIP_STATES = new Set(['AA', 'AE', 'AP']);

  const seen = new Set();
  const out = [];
  for (const line of lines) {
    if (!line) continue;
    const [city, stateShort] = line.split('|');
    if (!city || !stateShort) continue;
    const c = city.trim();
    const s = stateShort.trim();
    if (!c || !s) continue;
    if (SKIP_STATES.has(s.toUpperCase())) continue;
    const key = `${c.toLowerCase()}|${s.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push([c, s]);
  }

  out.sort((a, b) => a[1].localeCompare(b[1]) || a[0].localeCompare(b[0]));

  const dir = dirname(config.citiesCsv);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const body = ['city,state', ...out.map(([c, s]) => `${csvField(c)},${csvField(s)}`)].join('\n');
  writeFileSync(config.citiesCsv, body + '\n');

  console.error(`Wrote ${out.length} unique city/state pairs to ${config.citiesCsv}`);
}

main().catch((e) => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
