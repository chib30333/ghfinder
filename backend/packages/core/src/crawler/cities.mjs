import { loadCitiesTx } from '../db/index.mjs';
import { getCountry, readUsCities, fetchCountryCityNames } from '../data/countries.mjs';

export function buildQuery(city, state, mode) {
  const loc = mode === 'city-state' ? `location:"${city}, ${state}"` : `location:"${city}"`;
  return `${loc} type:user`;
}

// Map the full US gazetteer (data/us_cities.csv) into work-list rows, keeping
// each city's real 2-letter state code.
function usCityRows(queryMode) {
  return readUsCities().map(({ city, state }) => ({
    city,
    state,
    query: buildQuery(city, state, queryMode),
  }));
}

export function loadCities(queryMode = 'city') {
  return loadCitiesTx(usCityRows(queryMode));
}

// Seed the work list with the cities of a single country. For most countries
// the country name is stored in the `state` column so they can be grouped and
// filtered on the Discovery page. The US is CSV-backed: it loads the full
// us_cities.csv gazetteer with each city's real 2-letter state code.
// `location:"City"` (city mode) or `location:"City, State"` (city-state mode)
// drives the GitHub search.
export function loadCountryCities(code, queryMode = 'city') {
  const country = getCountry(code);
  if (!country) throw new Error(`unknown country: ${code}`);
  const rows = country.csv
    ? usCityRows(queryMode)
    : country.cities.map((city) => ({
        city,
        state: country.name,
        query: buildQuery(city, country.name, queryMode),
      }));
  const inserted = loadCitiesTx(rows);
  return { inserted, total: rows.length, country: country.name };
}

// Seed the work list with EVERY city of a country, not just the curated hubs.
// The US is already exhaustive (CSV gazetteer), so it reuses that path. For every
// other country we fetch the full city list from the remote gazetteer and merge
// the curated hubs in first (so hand-picked cities are never dropped). If the
// remote lookup fails we fall back to the curated shortlist so the action still
// works offline; the returned `source` says which list was actually seeded.
export async function loadAllCountryCities(code, queryMode = 'city') {
  const country = getCountry(code);
  if (!country) throw new Error(`unknown country: ${code}`);

  if (country.csv) {
    const rows = usCityRows(queryMode);
    const inserted = loadCitiesTx(rows);
    return { inserted, total: rows.length, country: country.name, source: 'gazetteer' };
  }

  let names = country.cities.slice();
  let source = 'curated';
  try {
    const remote = await fetchCountryCityNames(country.name);
    if (remote.length) {
      const seen = new Set();
      const merged = [];
      for (const city of [...country.cities, ...remote]) {
        const k = city.toLowerCase();
        if (seen.has(k)) continue;
        seen.add(k);
        merged.push(city);
      }
      names = merged;
      source = 'remote';
    }
  } catch {
    // Remote gazetteer unreachable — keep the curated shortlist (source stays 'curated').
  }

  const rows = names.map((city) => ({
    city,
    state: country.name,
    query: buildQuery(city, country.name, queryMode),
  }));
  const inserted = loadCitiesTx(rows);
  return { inserted, total: rows.length, country: country.name, source };
}
