import { config } from '../config.mjs';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
const { DatabaseSync } = await import('node:sqlite');

const dir = dirname(config.dbPath);
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

export const db = new DatabaseSync(config.dbPath);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA busy_timeout = 5000;

  CREATE TABLE IF NOT EXISTS cities (
    id          INTEGER PRIMARY KEY,
    city        TEXT NOT NULL,
    state       TEXT NOT NULL,
    query       TEXT NOT NULL,   -- base location qualifier, e.g. location:"Adak"
    status      TEXT NOT NULL DEFAULT 'pending', -- pending | active | done | skipped
    updated_at  TEXT,
    UNIQUE (city, state)
  );

  CREATE TABLE IF NOT EXISTS segments (
    id          INTEGER PRIMARY KEY,
    city_id     INTEGER NOT NULL,
    q           TEXT NOT NULL,   -- full query incl. optional created: window
    date_from   TEXT,            -- 'YYYY-MM-DD' or NULL (unbounded root)
    date_to     TEXT,
    granularity TEXT NOT NULL,   -- all | year | month | week | day
    status      TEXT NOT NULL DEFAULT 'pending', -- pending|active|done|split|capped
    next_page   INTEGER NOT NULL DEFAULT 1,
    total_found INTEGER,
    UNIQUE (city_id, q)
  );

  CREATE TABLE IF NOT EXISTS users (
    id              INTEGER PRIMARY KEY,
    login           TEXT UNIQUE NOT NULL,
    name            TEXT,
    company         TEXT,
    blog            TEXT,
    location        TEXT,
    email           TEXT,
    bio             TEXT,
    twitter         TEXT,
    public_repos    INTEGER,
    public_gists    INTEGER,
    followers       INTEGER,
    following       INTEGER,
    hireable        INTEGER,
    type            TEXT,
    html_url        TEXT,
    created_at      TEXT,
    updated_at      TEXT,
    source_city_id  INTEGER,
    fetched_at      TEXT,
    email_source    TEXT,            -- 'readme' | 'profile' | 'commits' | NULL
    telegram        TEXT,            -- handle or t.me link, if found; else NULL
    discord         TEXT,            -- handle or invite link, if found; else NULL
    raw             TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_users_location ON users(location);
  CREATE INDEX IF NOT EXISTS idx_users_source_city ON users(source_city_id);
  CREATE INDEX IF NOT EXISTS idx_cities_status ON cities(status);
  CREATE INDEX IF NOT EXISTS idx_cities_state ON cities(state);
  CREATE INDEX IF NOT EXISTS idx_seg_city ON segments(city_id, status);
`);

// emailed_at: ISO timestamp of the last time we actually sent an email to this
// address (NULL = never contacted). The sender writes it after Gmail confirms a
// real send, and `recipients` filters on it, so a recipient is never mailed twice.
for (const col of ['email_source', 'telegram', 'discord', 'emailed_at']) {
  try { db.exec(`ALTER TABLE users ADD COLUMN ${col} TEXT`); } catch { }
}

const stmts = {
  insertCity: db.prepare(`INSERT OR IGNORE INTO cities (city, state, query) VALUES (?, ?, ?)`),
  nextCity: db.prepare(
    `SELECT * FROM cities WHERE status NOT IN ('done', 'skipped') ORDER BY id LIMIT 1`
  ),
  setCityStatus: db.prepare(`UPDATE cities SET status=?, updated_at=? WHERE id=?`),
  cityStatus: db.prepare(`SELECT status FROM cities WHERE id = ?`),

  insertSegment: db.prepare(`
    INSERT OR IGNORE INTO segments (city_id, q, date_from, date_to, granularity)
    VALUES (@city_id, @q, @date_from, @date_to, @granularity)
  `),
  nextSegment: db.prepare(`
    SELECT * FROM segments
    WHERE city_id=? AND status IN ('pending','active')
    ORDER BY id LIMIT 1
  `),
  setSegmentProgress: db.prepare(
    `UPDATE segments SET status=?, next_page=?, total_found=? WHERE id=?`
  ),

  hasUser: db.prepare(`SELECT 1 FROM users WHERE login=?`),
  deleteUser: db.prepare(`DELETE FROM users WHERE login=?`),
  // Stamp every row that shares this address as contacted, so duplicate logins
  // for the same person (scraped from different cities) are all retired at once.
  markEmailed: db.prepare(
    `UPDATE users SET emailed_at=? WHERE LOWER(TRIM(email))=LOWER(TRIM(?))`
  ),
  // Clear the contacted stamp on every row sharing this address, returning the
  // lead to the `recipients` work list. Inverse of markEmailed.
  unmarkEmailed: db.prepare(
    `UPDATE users SET emailed_at=NULL WHERE LOWER(TRIM(email))=LOWER(TRIM(?))`
  ),
  // Stamp/clear a single login. Used for leads with no email, where there is no
  // address to match duplicates on.
  setEmailedByLogin: db.prepare(`UPDATE users SET emailed_at=? WHERE login=?`),
  // Purge every row with this address — used to drop leads whose email hard-bounced.
  deleteByEmail: db.prepare(`DELETE FROM users WHERE LOWER(TRIM(email))=LOWER(TRIM(?))`),
  upsertUser: db.prepare(`
    INSERT INTO users (
      id, login, name, company, blog, location, email, bio, twitter,
      public_repos, public_gists, followers, following, hireable, type,
      html_url, created_at, updated_at, source_city_id, fetched_at, email_source,
      telegram, discord, raw
    ) VALUES (
      @id, @login, @name, @company, @blog, @location, @email, @bio, @twitter,
      @public_repos, @public_gists, @followers, @following, @hireable, @type,
      @html_url, @created_at, @updated_at, @source_city_id, @fetched_at, @email_source,
      @telegram, @discord, @raw
    )
    ON CONFLICT(login) DO UPDATE SET
      name=excluded.name, location=excluded.location, email=excluded.email,
      followers=excluded.followers, public_repos=excluded.public_repos,
      updated_at=excluded.updated_at, fetched_at=excluded.fetched_at,
      email_source=excluded.email_source,
      telegram=excluded.telegram, discord=excluded.discord, raw=excluded.raw
  `),

  usersByCity: db.prepare(`
    SELECT u.name, u.email, c.city, c.state
    FROM users u JOIN cities c ON c.id = u.source_city_id
    ORDER BY u.source_city_id, u.id
  `),

  usersWithLinks: db.prepare(`
    SELECT name, telegram, discord FROM users
    WHERE telegram IS NOT NULL OR discord IS NOT NULL
    ORDER BY id
  `),

  usersWithEmail: db.prepare(`
    SELECT name, email FROM users
    WHERE email IS NOT NULL AND TRIM(email) != ''
    GROUP BY LOWER(TRIM(email))
    ORDER BY id
  `),

  recipients: db.prepare(`
    SELECT email, name, login FROM users
    WHERE email IS NOT NULL AND TRIM(email) != '' AND emailed_at IS NULL
    GROUP BY LOWER(TRIM(email))
    ORDER BY id
    LIMIT ? OFFSET ?
  `),

  counts: db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM cities)                          AS cities_total,
      (SELECT COUNT(*) FROM cities WHERE status='done')      AS cities_done,
      (SELECT COUNT(*) FROM cities WHERE status='active')    AS cities_active,
      (SELECT COUNT(*) FROM segments)                        AS seg_total,
      (SELECT COUNT(*) FROM segments WHERE status='split')   AS seg_split,
      (SELECT COUNT(*) FROM segments WHERE status='capped')  AS seg_capped,
      (SELECT COUNT(*) FROM users)                           AS users_total
  `),

  cityCountsByState: db.prepare(`SELECT state, COUNT(*) AS n FROM cities GROUP BY state`),
};

// How many cities are currently in the work list, grouped by the `state` column
// (the country name for curated/remote countries; a 2-letter code for US cities).
// Used to show the real loaded count on the Countries page rather than the
// static curated-shortlist size.
export const cityCountsByState = () => {
  const out = {};
  for (const r of stmts.cityCountsByState.all()) out[r.state] = r.n;
  return out;
};

export const loadCitiesTx = (rows) => {
  db.exec('BEGIN');
  try {
    let inserted = 0;
    for (const r of rows) inserted += stmts.insertCity.run(r.city, r.state, r.query).changes;
    db.exec('COMMIT');
    return inserted;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
};

// Next non-done city to crawl, in work order (city id). Pass `states` to scope
// the crawl to a single country's cities (e.g. the US 2-letter codes) so the
// Discovery country the operator is viewing is what actually gets crawled.
export const nextCity = (states) => {
  if (Array.isArray(states) && states.length) {
    const ph = states.map(() => '?').join(', ');
    return db
      .prepare(`SELECT * FROM cities WHERE status NOT IN ('done', 'skipped') AND state IN (${ph}) ORDER BY id LIMIT 1`)
      .get(...states);
  }
  return stmts.nextCity.get();
};
export const setCityStatus = (id, status) =>
  stmts.setCityStatus.run(status, new Date().toISOString(), id);
// Live status of a city, read fresh from disk — the crawler runs in a separate
// process, so it polls this to notice a 'skipped' write made by the server.
export const cityStatus = (id) => stmts.cityStatus.get(id)?.status ?? null;
// Mark a city skipped so it drops out of the crawl work list (`nextCity`) and the
// crawler aborts it if it happens to be the one in progress. Returns false if no
// such city exists.
export const skipCity = (id) => stmts.setCityStatus.run('skipped', new Date().toISOString(), id).changes > 0;

export const insertSegment = (seg) => stmts.insertSegment.run(seg);
export const nextSegment = (cityId) => stmts.nextSegment.get(cityId);
export const setSegmentProgress = (id, status, nextPage, totalFound) =>
  stmts.setSegmentProgress.run(status, nextPage, totalFound ?? null, id);

export const userExists = (login) => !!stmts.hasUser.get(login);
export const upsertUser = (u) => stmts.upsertUser.run(u);
// Hard-delete a harvested lead by its unique login. Returns true if a row went.
export const deleteUser = (login) => stmts.deleteUser.run(login).changes > 0;

// Record that an email was sent to this address (default: now). Marks every row
// with the address so it — and any duplicates — drop out of `recipients` and are
// never contacted again. Returns the number of rows stamped.
export const markEmailed = (email, at = new Date().toISOString()) =>
  stmts.markEmailed.run(at, String(email ?? '')).changes;

// Un-contact an address: clears emailed_at on every row sharing it, so the lead
// comes back into `recipients` and can be mailed again. Returns rows cleared.
export const unmarkEmailed = (email) => stmts.unmarkEmailed.run(String(email ?? '')).changes;

// A lead is 'done' once it carries an emailed_at stamp (the sender writes it on a
// confirmed Gmail send) and 'active' while it is still an open, mailable lead.
// Operators flip this by hand from the Leads table — marking a lead done retires
// it from `recipients`, marking it active puts it back in the queue.
// Keyed by login, but applied by email when the lead has one, so the duplicate
// logins a single person can produce across cities all move together.
export function setLeadStatus(login, status) {
  const row = db.prepare(`SELECT login, email FROM users WHERE login=?`).get(login);
  if (!row) return null;
  const at = status === 'done' ? new Date().toISOString() : null;
  const email = String(row.email ?? '').trim();
  const changes = email
    ? (at ? stmts.markEmailed.run(at, email) : stmts.unmarkEmailed.run(email)).changes
    : stmts.setEmailedByLogin.run(at, row.login).changes;
  return { login: row.login, email: email || null, status, emailed_at: at, changes };
}

// Hard-delete every lead with this address. Used to prune recipients whose email
// permanently bounced ("Address not found" / NXDOMAIN). Returns rows removed.
export const deleteByEmail = (email) => stmts.deleteByEmail.run(String(email ?? '')).changes;

// A well-formed address is local@domain.tld with no whitespace. The crawler
// sometimes scrapes junk (a bare blog like "adam.fr", a truncated address); such
// rows are unsendable, so callers use this to skip and prune them.
const VALID_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const isValidEmail = (email) => VALID_EMAIL_RE.test(String(email ?? '').trim());

// Some harvested `name` values are organisations, not people — a company
// ("TaylorMade Software, Inc."), a group/community/team, a civic or education
// body, or a bot. On those, {{firstName}} renders a brand word ("Hi, TaylorMade")
// and the mail lands in a shared/corporate inbox, so callers skip and prune them.
// Kept high-precision: each token below essentially never occurs as a real
// person's given/family name. (Ambiguous short forms like a bare "Co" are handled
// by the punctuation rules below, NOT as tokens, so surnames like "Jane Co" pass.)
const ORG_TOKENS = new Set([
  // legal / company designators
  'inc', 'incorporated', 'llc', 'llp', 'ltd', 'limited', 'corp', 'corporation',
  'company', 'plc', 'gmbh', 'pvt', 'sarl', 'srl',
  // business descriptors
  'software', 'technologies', 'technology', 'solutions', 'systems', 'consulting',
  'consultancy', 'studios', 'studio', 'labs', 'laboratories', 'analytics',
  'interactive', 'robotics', 'automation', 'innovations', 'ventures', 'holdings',
  'enterprises', 'networks', 'network', 'industries', 'agency', 'agencies',
  'media', 'digital', 'services', 'partners', 'marketing', 'works',
  // group / organisation / community
  'group', 'team', 'teams', 'community', 'collective', 'foundation',
  'organization', 'organisation', 'org', 'association', 'society', 'committee',
  'council', 'union', 'alliance', 'coalition', 'cooperative', 'club',
  'initiative', 'movement', 'project', 'projects', 'nonprofit',
  // civic / education
  'institute', 'university', 'college', 'school', 'academy', 'department',
  'ministry', 'commission',
  // automation / brand accounts
  'bot', 'official',
]);
export const looksLikeOrg = (name) => {
  const s = String(name ?? '').trim();
  if (!s) return false;
  // A GitHub bot suffix, trademark mark, or ampersand ("Smith & Co") — never a person.
  if (/\[bot\]|[&™®]/i.test(s)) return true;
  // A URL or bare domain used as a display name is a brand, not a person.
  if (/(?:https?:\/\/|www\.)/i.test(s) || /\b[a-z0-9-]+\.(?:com|io|org|net|dev|ai|co)\b/i.test(s)) return true;
  // A legal abbreviation written with a trailing period ("Widgets Co.", "Foo Inc.").
  if (/\b(?:co|inc|corp|ltd|llc|llp|plc|gmbh)\.(?:\s|$)/i.test(s)) return true;
  // A legal designator after a comma ("Something, Inc").
  if (/,\s*(?:inc|incorporated|llc|l\.l\.c\.?|ltd|limited|corp|corporation|co|gmbh|plc|llp)\b/i.test(s)) return true;
  // Any unmistakably organisational word among the tokens.
  const tokens = s.toLowerCase().replace(/[^a-z0-9&\s]/g, ' ').split(/\s+/).filter(Boolean);
  return tokens.some((t) => ORG_TOKENS.has(t));
};
export const usersByCity = () => stmts.usersByCity.all();
export const usersWithLinks = () => stmts.usersWithLinks.all();
export const usersWithEmail = () => stmts.usersWithEmail.all();
export const recipients = ({ offset = 0, limit = -1 } = {}) =>
  stmts.recipients.all(limit, offset);
export const counts = () => stmts.counts.get();

export function dashboardStats() {
  return db
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM cities)                        AS cities_total,
        (SELECT COUNT(*) FROM cities WHERE status='done')    AS cities_done,
        (SELECT COUNT(*) FROM cities WHERE status='active')  AS cities_active,
        (SELECT COUNT(*) FROM cities WHERE status='pending') AS cities_pending,
        (SELECT COUNT(*) FROM segments)                      AS seg_total,
        (SELECT COUNT(*) FROM segments WHERE status='split') AS seg_split,
        (SELECT COUNT(*) FROM segments WHERE status='capped') AS seg_capped,
        (SELECT COUNT(*) FROM users)                         AS users_total,
        (SELECT COUNT(*) FROM users
           WHERE email IS NOT NULL AND TRIM(email) != '')    AS users_with_email,
        (SELECT COUNT(*) FROM users
           WHERE telegram IS NOT NULL OR discord IS NOT NULL) AS users_with_social`
    )
    .get();
}

const USER_SORT_COLUMNS = new Set([
  'fetched_at', 'followers', 'public_repos', 'created_at', 'login', 'name',
]);

export function listUsers(opts = {}) {
  const {
    search, hasEmail, hasSocial, hireable, emailSource, city,
    sort = 'fetched_at', order = 'desc', limit = 50, offset = 0,
  } = opts;

  const where = [];
  const params = [];
  if (search) {
    where.push('(u.login LIKE ? OR u.name LIKE ? OR u.email LIKE ?)');
    const like = `%${search}%`;
    params.push(like, like, like);
  }
  if (hasEmail) where.push("u.email IS NOT NULL AND TRIM(u.email) != ''");
  if (hasSocial) where.push('(u.telegram IS NOT NULL OR u.discord IS NOT NULL)');
  if (hireable) where.push('u.hireable = 1');
  if (emailSource) { where.push('u.email_source = ?'); params.push(emailSource); }
  if (city) { where.push('c.city = ?'); params.push(city); }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const sortCol = USER_SORT_COLUMNS.has(sort) ? sort : 'fetched_at';
  const sortDir = String(order).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const lim = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const off = Math.max(Number(offset) || 0, 0);

  const rows = db
    .prepare(
      `SELECT u.id, u.login, u.name, u.company, u.location, u.email, u.email_source,
              u.followers, u.public_repos, u.hireable, u.telegram, u.discord,
              u.html_url, u.type, u.fetched_at, u.created_at, u.emailed_at,
              c.city AS source_city, c.state AS source_state
       FROM users u
       LEFT JOIN cities c ON c.id = u.source_city_id
       ${whereSql}
       ORDER BY u.${sortCol} ${sortDir}
       LIMIT ? OFFSET ?`
    )
    .all(...params, lim, off);

  const { total } = db
    .prepare(
      `SELECT COUNT(*) AS total
       FROM users u
       LEFT JOIN cities c ON c.id = u.source_city_id
       ${whereSql}`
    )
    .get(...params);

  return { rows, total, limit: lim, offset: off };
}

export function getUserByLogin(login) {
  return (
    db
      .prepare(
        `SELECT u.*, c.city AS source_city, c.state AS source_state
         FROM users u
         LEFT JOIN cities c ON c.id = u.source_city_id
         WHERE u.login = ?`
      )
      .get(login) ?? null
  );
}

const CITY_STATUSES = new Set(['pending', 'active', 'done', 'skipped']);

export function listCities(opts = {}) {
  const { status, search, state, states, limit = 100, offset = 0 } = opts;
  const where = [];
  const params = [];
  if (status && CITY_STATUSES.has(status)) { where.push('c.status = ?'); params.push(status); }
  if (search) { where.push('c.city LIKE ?'); params.push(`%${search}%`); }
  if (Array.isArray(states) && states.length) {
    where.push(`c.state IN (${states.map(() => '?').join(', ')})`);
    params.push(...states);
  } else if (state) { where.push('c.state = ?'); params.push(state); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const lim = Math.min(Math.max(Number(limit) || 100, 1), 500);
  const off = Math.max(Number(offset) || 0, 0);

  const rows = db
    .prepare(
      `SELECT c.id, c.city, c.state, c.status, c.updated_at,
              (SELECT COUNT(*) FROM users u WHERE u.source_city_id = c.id) AS leads_found
       FROM cities c
       ${whereSql}
       ORDER BY c.id
       LIMIT ? OFFSET ?`
    )
    .all(...params, lim, off);

  const { total } = db.prepare(`SELECT COUNT(*) AS total FROM cities c ${whereSql}`).get(...params);
  return { rows, total, limit: lim, offset: off };
}
