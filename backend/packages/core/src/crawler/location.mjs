// Location verification for search hits.
//
// GitHub's `location:` search qualifier is a fuzzy free-text match, not a
// geocoded one: it returns any profile whose location string *contains* the
// token. So `location:"Arab"` (the city Arab, AL) also returns everyone in
// "Dubai, United Arab Emirates", `location:"Houston"` (Houston, AK) returns all
// of Houston, TX, and `location:"Petersburg"` (Petersburg, AK) returns
// Saint Petersburg, Russia. Without a second check every one of those lands in
// the lead list attributed to the wrong city.
//
// This module re-checks the fetched profile's own `location` string against the
// city the crawler is actually working on, using only data we already have — it
// costs no extra API calls.

import { readUsCities } from '../data/countries.mjs';

const US_STATES = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi',
  MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire',
  NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina',
  ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania',
  RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee',
  TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington',
  WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
  DC: 'District of Columbia',
  // Territories / freely-associated states that appear in the gazetteer.
  AS: 'American Samoa', FM: 'Micronesia', GU: 'Guam', MH: 'Marshall Islands',
  MP: 'Northern Mariana Islands', PR: 'Puerto Rico', PW: 'Palau',
  VI: 'Virgin Islands',
};

// Written by US devs to mean "I'm in the US". "USA" and "United States" are
// unambiguous in any case, but a bare "US" is matched case-sensitively — the
// pronoun "us" is far too common to treat as a country.
const US_MARKERS = [
  /\bU\.?S\.?A\.?\b/i,
  /\bUnited States\b/i,
  /\bU\.?S\.?\b/,
];

// Country names + the aliases people actually type. Used as a veto: a US city
// hit that names a foreign country is not in that US city. Deliberately covers
// the countries that collide with US place names (Arab/UAE, Alberta/Canada,
// Alexandria/Egypt, Petersburg/Russia, Wales/UK, Indian/India, Lebanon, Peru…).
const COUNTRIES = [
  'Afghanistan', 'Albania', 'Algeria', 'Andorra', 'Angola', 'Argentina', 'Armenia',
  'Australia', 'Austria', 'Azerbaijan', 'Bahamas', 'Bahrain', 'Bangladesh',
  'Barbados', 'Belarus', 'Belgium', 'Belize', 'Benin', 'Bhutan', 'Bolivia',
  'Bosnia', 'Botswana', 'Brazil', 'Brasil', 'Brunei', 'Bulgaria', 'Burkina Faso',
  'Burundi', 'Cambodia', 'Cameroon', 'Canada', 'Chad', 'Chile', 'China', 'Colombia',
  'Costa Rica', 'Croatia', 'Cuba', 'Cyprus', 'Czechia', 'Czech Republic', 'Denmark',
  'Dominican Republic', 'Ecuador', 'Egypt', 'El Salvador', 'Estonia', 'Ethiopia',
  'Fiji', 'Finland', 'France', 'Gabon', 'Gambia', 'Germany', 'Deutschland', 'Ghana',
  'Greece', 'Guatemala', 'Guinea', 'Guyana', 'Haiti', 'Honduras', 'Hong Kong',
  'Hungary', 'Iceland', 'India', 'Bharat', 'Indonesia', 'Iran', 'Iraq', 'Ireland',
  'Israel', 'Italy', 'Italia', 'Ivory Coast', 'Jamaica', 'Japan', 'Jordan',
  'Kazakhstan', 'Kenya', 'Kosovo', 'Kuwait', 'Kyrgyzstan', 'Laos', 'Latvia',
  'Lebanon', 'Liberia', 'Libya', 'Liechtenstein', 'Lithuania', 'Luxembourg',
  'Macau', 'Madagascar', 'Malawi', 'Malaysia', 'Maldives', 'Mali', 'Malta',
  'Mauritius', 'Mexico', 'México', 'Moldova', 'Monaco', 'Mongolia', 'Montenegro',
  'Morocco', 'Mozambique', 'Myanmar', 'Namibia', 'Nepal', 'Netherlands', 'Holland',
  'New Zealand', 'Nicaragua', 'Niger', 'Nigeria', 'North Korea', 'North Macedonia',
  'Macedonia', 'Norway', 'Oman', 'Pakistan', 'Palestine', 'Panama', 'Paraguay',
  'Peru', 'Philippines', 'Pilipinas', 'Poland', 'Polska', 'Portugal', 'Qatar',
  'Romania', 'Russia', 'Rossiya', 'Rwanda', 'Saudi Arabia', 'Senegal', 'Serbia',
  'Singapore', 'Slovakia', 'Slovenia', 'Somalia', 'South Africa', 'South Korea',
  'Korea', 'Spain', 'España', 'Sri Lanka', 'Sudan', 'Sweden', 'Sverige',
  'Switzerland', 'Syria', 'Taiwan', 'Tajikistan', 'Tanzania', 'Thailand', 'Togo',
  'Trinidad', 'Tunisia', 'Turkey', 'Türkiye', 'Turkmenistan', 'Uganda', 'Ukraine',
  'United Arab Emirates', 'UAE', 'United Kingdom', 'UK', 'Great Britain',
  'England', 'Scotland', 'Wales', 'Northern Ireland',
  'Uruguay', 'Uzbekistan', 'Venezuela',
  'Vietnam', 'Viet Nam', 'Yemen', 'Zambia', 'Zimbabwe',
];

// Foreign places that people name *without* naming their country, so the list
// above never fires on them. Every entry here was measured in the real corpus:
// "Saint-Petersburg" (1,503 rows harvested for Petersburg, AK), "Calgary,
// Alberta" (837) and "Edmonton, Alberta" (546) for Alberta, AL, "Cardiff,
// Wales" (192) for Wales, AK, "Central Java" (127) for Central, AK.
// Names that are ALSO real US cities in the gazetteer are deliberately absent
// (Alberta, Ontario, Toronto, Dublin, Manchester, Moscow, Cairo, Saint
// Petersburg, Andalusia, Piedmont, …). Vetoing on those would throw away
// legitimate residents of Moscow ID, Dublin OH or Saint Petersburg FL when
// their own city row is crawled. They are still caught: without a matching US
// state signal they fall through to 'other-state' or 'unconfirmed'.
const FOREIGN_PLACES = [
  // Canada
  'Quebec', 'British Columbia', 'Saskatchewan', 'Manitoba', 'Nova Scotia', 'Calgary',
  'Alberta', 'Ontario', 'Edmonton', 'Lethbridge', 'Toronto', 'Vancouver', 'Montreal',
  // UK / Ireland
  'Cardiff', 'Aberdeen', 'Sheffield', 'Leeds', 'Swansea', 'Glasgow', 'Edinburgh',
  'Belfast', 'Dublin', 'Manchester',
  // Russia / CIS
  'Sankt Peterburg', 'Sankt Petersburg', 'Saint Petersburg', 'Russian',
  'Novosibirsk', 'Yekaterinburg', 'Kyiv', 'Kiev', 'Minsk', 'Moscow',
  // Middle East
  'Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Riyadh', 'Jeddah', 'Doha', 'Beirut',
  // South / South-East Asia
  'Bengaluru', 'Bangalore', 'Mumbai', 'Kolkata', 'Chennai', 'Hyderabad', 'Pune',
  'Karachi', 'Lahore', 'Islamabad', 'Dhaka', 'Kathmandu', 'Colombo',
  'Central Java', 'West Java', 'East Java', 'Jakarta', 'Semarang', 'Surabaya',
  'Bandung', 'Yogyakarta', 'Indonesian', 'Borneo', 'Kuala Lumpur', 'Hanoi',
  'Ho Chi Minh',
  // Africa
  'Giza', 'Cairo', 'Alexandria Governorate', 'Lagos', 'Abuja', 'Nairobi', 'Accra',
  // East Asia
  'Shanghai', 'Beijing', 'Shenzhen', 'Guangzhou', 'Hangzhou', 'Tokyo', 'Osaka',
  'Seoul', 'Taipei', 'Bangkok',
  // Europe / LatAm hubs
  'Bavaria', 'Catalonia', 'Istanbul', 'Sao Paulo', 'Rio de Janeiro', 'Buenos Aires',
  // Longhand country forms and regions people write instead of a country
  'Russian Federation', 'Isle of Man', 'Great Britain', 'Europe', 'Central Europe',
  'Eastern Europe', 'Western Europe', 'Central America', 'South America',
  'Latin America', 'Middle East', 'Southeast Asia', 'South Asia', 'East Africa',
  'West Africa', 'North Africa',
];

// The gazetteer spells these out (473 rows: "Saint Petersburg", "Fort Worth",
// "Mount Vernon") but people type the short form. Folded to the long form on
// both sides so they compare equal. Never applied to the final token, so a
// street address ("123 Main St") keeps its "st".
const ABBREV = { st: 'saint', ste: 'sainte', mt: 'mount', ft: 'fort' };

// Diacritics folded and punctuation collapsed so "Saint-Petersburg," and
// "saint petersburg" compare equal.
function norm(s) {
  const words = String(s ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ');
  return words
    .map((w, i) => (i < words.length - 1 && Object.hasOwn(ABBREV, w) ? ABBREV[w] : w))
    .join(' ');
}

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Whole-token phrase test on the normalised string, so "Arab" matches
// "United Arab Emirates" (it is a token there) but "Ark" does not match "Arkansas".
function hasPhrase(normalised, phrase) {
  const p = norm(phrase);
  if (!p) return false;
  return new RegExp(`(^| )${escape(p)}( |$)`).test(normalised);
}

// Half the state codes are also ordinary English words (IN, OR, ME, HI, OK, LA,
// DE, MA, MS, MD, MT, PA), so a naive case-insensitive match reads "Hope in
// Africa" as Hope, Indiana. A code counts only when it is written the way people
// actually write a state:
//   - UPPERCASE anywhere      "Houston, TX, USA"
//   - trailing, any case      "Fairbanks, Ak"   "anchorage, ak"
// The trailing form tolerates a following US marker ("Sterling, va, usa").
function hasStateCode(raw, code) {
  const s = String(raw ?? '');
  if (new RegExp(`\\b${code}\\b`).test(s)) return true;
  return new RegExp(`[,\\s]${code}\\b[\\s,.]*(U\\.?S\\.?A?\\.?|United States)?[\\s,.]*$`, 'i').test(s);
}

function hasUsMarker(raw) {
  return US_MARKERS.some((re) => re.test(String(raw ?? '')));
}

// Foreign countries/places named in the location, ignoring any whose name IS
// the place we're crawling — Wales AK, Alberta AL, Lebanon PA, Peru IN, Moscow
// ID and Mexico MO are real US cities and must not veto themselves.
function foreignNamed(normalised, ...selfNames) {
  const self = new Set(selfNames.filter(Boolean).map(norm));
  for (const list of [COUNTRIES, FOREIGN_PLACES]) {
    const hit = list.find((c) => !self.has(norm(c)) && hasPhrase(normalised, c));
    if (hit) return hit;
  }
  return null;
}

const isUsState = (state) => Object.hasOwn(US_STATES, String(state ?? '').toUpperCase());

// State codes that are ALSO ISO 3166 country codes. Only these need a second
// opinion — "Central NJ" is unambiguously New Jersey, but "Berlin, DE" is
// Deutschland, not Delaware.
const ISO_AMBIGUOUS = new Set([
  'AL', 'AR', 'AZ', 'CA', 'CO', 'DE', 'GA', 'ID', 'IL', 'IN', 'KY', 'LA', 'MA',
  'MD', 'ME', 'MN', 'MO', 'MS', 'MT', 'NC', 'NE', 'PA', 'SC', 'SD', 'TN', 'VA',
]);

// The gazetteer settles the ambiguous ones: "Dover, DE" names a real Delaware
// city, "Berlin, DE" does not. Built once, lazily, and degrades to "can't tell"
// if the CSV is missing rather than breaking a crawl.
let _byState = null;
function usCitiesByState() {
  if (_byState) return _byState;
  const m = new Map();
  try {
    for (const { city, state } of readUsCities()) {
      const k = String(state).toUpperCase();
      if (!m.has(k)) m.set(k, new Set());
      m.get(k).add(norm(city));
    }
  } catch {
    // CSV not present — callers fall back to treating the code as unconfirmed.
  }
  _byState = m;
  return m;
}

// Does the location name a real city of `code`? Checked as 1–4 token phrases,
// which is enough for "Salt Lake City" and "Saint Petersburg".
function namesCityIn(normalised, code) {
  const set = usCitiesByState().get(code);
  if (!set?.size) return false;
  const toks = normalised.split(' ');
  for (let i = 0; i < toks.length; i++) {
    for (let len = 1; len <= 4 && i + len <= toks.length; len++) {
      if (set.has(toks.slice(i, i + len).join(' '))) return true;
    }
  }
  return false;
}

/**
 * Does `location` (a GitHub profile's free-text location) actually correspond to
 * the work-list city we are crawling?
 *
 * US cities (state is a 2-letter code) demand positive confirmation — the state
 * code, the full state name, or a US marker — because the 29.8k-row gazetteer is
 * full of short, ambiguous names ("Arab", "Central", "Indian", "Circle"). A bare
 * "Houston" is genuinely ambiguous between Houston AK and Houston TX, so it is
 * rejected here and picked up when its own city row is crawled.
 *
 * Non-US cities are curated hubs (Budapest, Lisbon, Warsaw) and globally
 * unambiguous, so the country name is not required — only the absence of a
 * conflicting country or US signal.
 *
 * `strict` (the default) also rejects a location that confirms nothing either
 * way — a bare "Indian" or "Central". Pass strict:false to keep those; measured
 * on the live corpus that is where most of the remaining junk lives.
 *
 * @returns {{ok: boolean, reason: string}} reason is a short tag for the log.
 */
export function locationMatches(location, city, state, { strict = true } = {}) {
  const raw = String(location ?? '').trim();
  // GitHub only returns profiles whose location matched the qualifier, so this
  // is a data anomaly rather than a normal case; treat it as unconfirmed.
  if (!raw) return { ok: !strict, reason: 'no-location' };

  const n = norm(raw);
  if (!hasPhrase(n, city)) return { ok: false, reason: 'city-absent' };

  if (isUsState(state)) {
    const code = String(state).toUpperCase();
    const name = US_STATES[code];

    // Spelled-out state name is unambiguous — accept before any veto runs, so
    // "Moscow, Idaho" and "Saint Petersburg, Florida" survive.
    if (hasPhrase(n, name)) return { ok: true, reason: 'state' };

    // A *different* US state means the same-named city elsewhere (Akron OH vs
    // Akron AL). Checked before the US marker, or "Anderson, Indiana, US" would
    // pass as Anderson, AK. Not lost — harvested under their own city row.
    for (const [c, nm] of Object.entries(US_STATES)) {
      if (c === code) continue;
      if (hasStateCode(raw, c) || hasPhrase(n, nm)) return { ok: false, reason: `other-state:${c}` };
    }

    // A named foreign country/hub beats a bare 2-letter code, because several
    // codes double as ISO country codes (IN=India, DE=Germany, PL, PT, BR).
    const foreign = foreignNamed(n, city, name);
    if (foreign) return { ok: false, reason: `foreign:${foreign}` };

    if (hasStateCode(raw, code)) return { ok: true, reason: 'state' };
    if (hasUsMarker(raw)) return { ok: true, reason: 'us' };
    return { ok: !strict, reason: 'unconfirmed' };
  }

  // Curated (non-US) country: `state` holds the country name.
  const country = String(state ?? '');
  if (hasPhrase(n, country)) return { ok: true, reason: 'country' };

  const foreign = foreignNamed(n, city, country);
  if (foreign) return { ok: false, reason: `foreign:${foreign}` };
  if (hasUsMarker(raw)) return { ok: false, reason: 'foreign:United States' };
  for (const [c, nm] of Object.entries(US_STATES)) {
    if (hasStateCode(raw, c) || hasPhrase(n, nm)) return { ok: false, reason: `other-state:${c}` };
  }
  // A curated hub named on its own (plain "Budapest") is unambiguous enough.
  return { ok: true, reason: 'city-only' };
}

/**
 * Is this free-text location in the United States, ignoring which city row
 * produced it? Answers the separate question "should this lead be in a US-only
 * list at all" — `locationMatches` answers "is it in THIS city", so it rejects
 * "Houston, TX" under Houston AK even though that person is plainly in the US.
 *
 * @returns {{us: boolean|null, reason: string}} us === null means undecidable
 *   (a bare "Anchorage", "Indian", "Central") — the caller decides what to do
 *   with those rather than having a guess baked in here.
 */
export function isUnitedStates(location) {
  const raw = String(location ?? '').trim();
  if (!raw) return { us: null, reason: 'no-location' };
  const n = norm(raw);

  // A spelled-out state name or an explicit USA marker settles it before the
  // foreign veto, so "Cardiff-by-the-Sea, California" stays US.
  for (const [code, name] of Object.entries(US_STATES)) {
    if (hasPhrase(n, name)) return { us: true, reason: `state:${code}` };
  }
  if (hasUsMarker(raw)) return { us: true, reason: 'us-marker' };

  // A code that is not also an ISO country code is decisive on its own, and is
  // tested before the veto so "Panama City, FL" doesn't read as Panama.
  let ambiguousCode = null;
  for (const code of Object.keys(US_STATES)) {
    if (!hasStateCode(raw, code)) continue;
    if (!ISO_AMBIGUOUS.has(code)) return { us: true, reason: `state:${code}` };
    ambiguousCode ??= code;
  }

  // A country spelled out beats a gazetteer-confirmed ambiguous code: "E 88 -
  // AL DHAID - UNITED ARAB EMIRATES" has an uppercase AL and contains "Arab"
  // (a real Alabama city), which would otherwise confirm Alabama.
  const country = COUNTRIES.find((c) => hasPhrase(n, c));
  if (country) return { us: false, reason: `foreign:${country}` };

  if (ambiguousCode && namesCityIn(n, ambiguousCode)) {
    return { us: true, reason: `state:${ambiguousCode}` };
  }

  const foreign = foreignNamed(n);
  if (foreign) return { us: false, reason: `foreign:${foreign}` };

  // Code with no matching city — "Berlin, DE" (Deutschland), "Mumbai, IN"
  // (India). Undecidable rather than foreign: the code really might be a state.
  if (ambiguousCode) return { us: null, reason: `ambiguous-code:${ambiguousCode}` };
  return { us: null, reason: 'unknown' };
}
