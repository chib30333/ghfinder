import { existsSync, readFileSync } from 'node:fs';
import { config } from '../config.mjs';

export const REGIONS = [
  { id: 'north-america', label: 'North America' },
  { id: 'latin-america', label: 'Latin America' },
  { id: 'europe', label: 'Europe' },
  { id: 'asia-pacific', label: 'Asia Pacific' },
  { id: 'middle-east-africa', label: 'Middle East & Africa' },
];

// A focused set of useful developer markets. The curated cities make the app
// useful offline; "all cities" can expand any non-US country from the remote
// gazetteer.
export const COUNTRIES = [
  { code: 'US', name: 'United States', region: 'north-america', csv: true, cities: ['New York', 'Los Angeles', 'Chicago', 'Austin', 'Seattle', 'San Francisco', 'Boston', 'Denver', 'Atlanta', 'Portland'] },
  { code: 'CA', name: 'Canada', region: 'north-america', cities: ['Toronto', 'Vancouver', 'Montreal', 'Calgary', 'Ottawa', 'Waterloo'] },
  { code: 'MX', name: 'Mexico', region: 'latin-america', cities: ['Mexico City', 'Guadalajara', 'Monterrey', 'Queretaro', 'Merida'] },
  { code: 'BR', name: 'Brazil', region: 'latin-america', cities: ['Sao Paulo', 'Rio de Janeiro', 'Belo Horizonte', 'Curitiba', 'Recife', 'Porto Alegre'] },
  { code: 'AR', name: 'Argentina', region: 'latin-america', cities: ['Buenos Aires', 'Cordoba', 'Rosario', 'Mendoza'] },
  { code: 'CL', name: 'Chile', region: 'latin-america', cities: ['Santiago', 'Valparaiso', 'Concepcion'] },
  { code: 'CO', name: 'Colombia', region: 'latin-america', cities: ['Bogota', 'Medellin', 'Cali', 'Barranquilla'] },
  { code: 'GB', name: 'United Kingdom', region: 'europe', cities: ['London', 'Manchester', 'Edinburgh', 'Bristol', 'Birmingham', 'Cambridge'] },
  { code: 'DE', name: 'Germany', region: 'europe', cities: ['Berlin', 'Munich', 'Hamburg', 'Frankfurt', 'Cologne', 'Stuttgart'] },
  { code: 'FR', name: 'France', region: 'europe', cities: ['Paris', 'Lyon', 'Toulouse', 'Bordeaux', 'Lille', 'Nantes'] },
  { code: 'NL', name: 'Netherlands', region: 'europe', cities: ['Amsterdam', 'Rotterdam', 'Utrecht', 'Eindhoven', 'The Hague'] },
  { code: 'ES', name: 'Spain', region: 'europe', cities: ['Madrid', 'Barcelona', 'Valencia', 'Seville', 'Malaga'] },
  { code: 'PT', name: 'Portugal', region: 'europe', cities: ['Lisbon', 'Porto', 'Braga', 'Coimbra'] },
  { code: 'IT', name: 'Italy', region: 'europe', cities: ['Milan', 'Rome', 'Turin', 'Bologna', 'Florence'] },
  { code: 'IE', name: 'Ireland', region: 'europe', cities: ['Dublin', 'Cork', 'Galway', 'Limerick'] },
  { code: 'SE', name: 'Sweden', region: 'europe', cities: ['Stockholm', 'Gothenburg', 'Malmo', 'Uppsala'] },
  { code: 'NO', name: 'Norway', region: 'europe', cities: ['Oslo', 'Bergen', 'Trondheim', 'Stavanger'] },
  { code: 'DK', name: 'Denmark', region: 'europe', cities: ['Copenhagen', 'Aarhus', 'Odense', 'Aalborg'] },
  { code: 'FI', name: 'Finland', region: 'europe', cities: ['Helsinki', 'Espoo', 'Tampere', 'Turku'] },
  { code: 'PL', name: 'Poland', region: 'europe', cities: ['Warsaw', 'Krakow', 'Wroclaw', 'Gdansk', 'Poznan'] },
  { code: 'CZ', name: 'Czechia', region: 'europe', cities: ['Prague', 'Brno', 'Ostrava'] },
  { code: 'CH', name: 'Switzerland', region: 'europe', cities: ['Zurich', 'Geneva', 'Basel', 'Lausanne'] },
  { code: 'AT', name: 'Austria', region: 'europe', cities: ['Vienna', 'Graz', 'Linz', 'Salzburg'] },
  { code: 'UA', name: 'Ukraine', region: 'europe', cities: ['Kyiv', 'Lviv', 'Kharkiv', 'Odesa', 'Dnipro'] },
  { code: 'IN', name: 'India', region: 'asia-pacific', cities: ['Bengaluru', 'Mumbai', 'Delhi', 'Hyderabad', 'Pune', 'Chennai'] },
  { code: 'CN', name: 'China', region: 'asia-pacific', cities: ['Beijing', 'Shanghai', 'Shenzhen', 'Guangzhou', 'Hangzhou'] },
  { code: 'JP', name: 'Japan', region: 'asia-pacific', cities: ['Tokyo', 'Osaka', 'Kyoto', 'Fukuoka', 'Nagoya'] },
  { code: 'KR', name: 'South Korea', region: 'asia-pacific', cities: ['Seoul', 'Busan', 'Incheon', 'Daejeon'] },
  { code: 'SG', name: 'Singapore', region: 'asia-pacific', cities: ['Singapore'] },
  { code: 'AU', name: 'Australia', region: 'asia-pacific', cities: ['Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide', 'Canberra'] },
  { code: 'NZ', name: 'New Zealand', region: 'asia-pacific', cities: ['Auckland', 'Wellington', 'Christchurch', 'Hamilton'] },
  { code: 'ID', name: 'Indonesia', region: 'asia-pacific', cities: ['Jakarta', 'Bandung', 'Surabaya', 'Yogyakarta'] },
  { code: 'PH', name: 'Philippines', region: 'asia-pacific', cities: ['Manila', 'Quezon City', 'Cebu City', 'Davao City'] },
  { code: 'VN', name: 'Vietnam', region: 'asia-pacific', cities: ['Ho Chi Minh City', 'Hanoi', 'Da Nang'] },
  { code: 'IL', name: 'Israel', region: 'middle-east-africa', cities: ['Tel Aviv', 'Jerusalem', 'Haifa', 'Beersheba'] },
  { code: 'AE', name: 'United Arab Emirates', region: 'middle-east-africa', cities: ['Dubai', 'Abu Dhabi', 'Sharjah'] },
  { code: 'TR', name: 'Turkey', region: 'middle-east-africa', cities: ['Istanbul', 'Ankara', 'Izmir', 'Bursa'] },
  { code: 'ZA', name: 'South Africa', region: 'middle-east-africa', cities: ['Cape Town', 'Johannesburg', 'Pretoria', 'Durban'] },
  { code: 'NG', name: 'Nigeria', region: 'middle-east-africa', cities: ['Lagos', 'Abuja', 'Ibadan', 'Port Harcourt'] },
  { code: 'KE', name: 'Kenya', region: 'middle-east-africa', cities: ['Nairobi', 'Mombasa', 'Kisumu'] },
  { code: 'EG', name: 'Egypt', region: 'middle-east-africa', cities: ['Cairo', 'Alexandria', 'Giza'] },
];

const US_STATE_CODES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL',
  'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT',
  'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI',
  'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC',
];

const normalize = (value) => String(value ?? '').trim().toLowerCase();

export function getCountry(value) {
  const key = normalize(value);
  return COUNTRIES.find((country) =>
    normalize(country.code) === key || normalize(country.name) === key
  ) ?? null;
}

function parseCsvLine(line) {
  const fields = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      fields.push(field);
      field = '';
    } else {
      field += char;
    }
  }
  fields.push(field);
  return fields;
}

export function readUsCities() {
  if (!existsSync(config.citiesCsv)) {
    throw new Error(
      `US city data is missing at ${config.citiesCsv}. Run \`node tools/fetch-cities.mjs\` from backend/.`,
    );
  }
  const rows = [];
  const seen = new Set();
  const lines = readFileSync(config.citiesCsv, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/);
  const header = parseCsvLine(lines.shift() ?? '').map((value) => normalize(value));
  const cityIndex = header.indexOf('city');
  const stateIndex = header.indexOf('state');
  if (cityIndex === -1 || stateIndex === -1) {
    throw new Error(`Invalid US city CSV at ${config.citiesCsv}: expected city,state columns.`);
  }
  for (const line of lines) {
    if (!line.trim()) continue;
    const fields = parseCsvLine(line);
    const city = String(fields[cityIndex] ?? '').trim();
    const state = String(fields[stateIndex] ?? '').trim().toUpperCase();
    const key = `${normalize(city)}|${state}`;
    if (!city || !US_STATE_CODES.includes(state) || seen.has(key)) continue;
    seen.add(key);
    rows.push({ city, state });
  }
  return rows;
}

export const usCityCount = () => readUsCities().length;
export const usStateCodes = () => [...US_STATE_CODES];

export function countryStates(value) {
  const country = getCountry(value);
  if (!country) return null;
  return country.csv ? usStateCodes() : [country.name];
}

export const countryStateFilter = countryStates;

export function listCountries(loadedByState = {}) {
  return {
    regions: REGIONS,
    countries: COUNTRIES.map((country) => {
      const loaded = country.csv
        ? US_STATE_CODES.reduce((sum, state) => sum + Number(loadedByState[state] ?? 0), 0)
        : Number(loadedByState[country.name] ?? 0);
      let cityCount = country.cities.length;
      if (country.csv && existsSync(config.citiesCsv)) cityCount = usCityCount();
      return { code: country.code, name: country.name, region: country.region, cityCount: loaded || cityCount, loaded };
    }),
  };
}

export async function fetchCountryCityNames(countryName) {
  const res = await fetch('https://countriesnow.space/api/v0.1/countries/cities', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ country: countryName }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`city gazetteer request failed: HTTP ${res.status}`);
  const body = await res.json();
  if (body?.error || !Array.isArray(body?.data)) {
    throw new Error(body?.msg || `city gazetteer returned no data for ${countryName}`);
  }
  return body.data.map((city) => String(city).trim()).filter(Boolean);
}
