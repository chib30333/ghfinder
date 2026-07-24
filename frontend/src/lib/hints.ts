export const HINTS = {
  dashPage: 'Live snapshot of harvesting and outreach — lead totals, crawl coverage, sending volume, and GitHub API budget.',
  statTotalLeads: 'Every developer profile harvested into the database across all crawled cities.',
  statWithEmail: 'Leads that have a public email address — the ones you can actually contact. Percent is of all leads.',
  statSocial: 'Leads with a social link (Telegram, Discord, blog, or Twitter) found during enrichment.',
  statCities: 'US cities the crawler has finished, versus the total work list.',
  statSentToday: 'Emails sent so far today across all sender accounts, against the combined daily cap.',
  statApi: 'GitHub API requests left in the current rate-limit window, and when the window resets.',
  dashCrawl: "Per-city harvest progress. Each bar shows how much of that city's developers have been pulled.",
  dashActivity: 'The most recent crawl events — cities being harvested and leads found — newest first.',

  countriesPage: 'Pick a country to seed its major cities into the Discovery work list, then crawl GitHub across them.',
  countriesRegions: 'Countries grouped by region. Select one to load its cities — Europe, North America, Asia-Pacific, and Latin America.',
  countriesRun: 'Search all cities pulls in the selected country’s complete city list (not just the major hubs); Load cities seeds only the hubs. Either opens Discovery filtered to that country — start the crawler there.',

  discPage: 'The harvester engine. Crawl GitHub by city and enrich each profile with emails and social links.',
  discCities: 'The queue of cities to crawl. Filter, sort, and load more cities into the work list.',
  discRun: 'Start or stop the crawler and tune how many profiles it pulls and which enrichment steps run.',
  discLog: 'Live output streamed from the crawler process as it works — one line per event, newest at the bottom.',

  cityViewPage: 'Browse every city loaded for a country — search across the full list, page through it, and see each city’s crawl status and lead count.',
  cityViewCities: 'The complete city list for the selected country. Pick a country above, then search or page through its cities.',

  leadsPage: 'Every harvested developer. Search, filter by email / hireable / source, sort, and open a profile for full detail.',

  campPage: 'Compose a personalized cold-email campaign and send it across your rotating Gmail accounts.',
  campTemplate: 'Subject and body of the email. Use tokens like {name} to personalize each message per recipient.',
  campPreview: 'How the email renders for a real sample recipient, including the required identity and unsubscribe footer.',
  campScope: 'Which harvested leads receive this campaign — everyone from a start index, or a fixed count.',
  campSenders: 'Which Gmail accounts send this run, and the per-account daily cap. Sending rotates across them.',
  campPreflight: 'Readiness checks that must pass before launch — template, recipients, accounts, and Chrome connection.',
  campMode: 'Draft only writes to Gmail drafts; Send delivers for real. Sending is irreversible.',

  sendTally: 'Per-account send counts for this run — how many each Gmail account has sent against its cap.',
  sendLog: 'Live output from the sender process — one line per message attempt, with errors shown in red.',

  acctPage: 'Gmail sender accounts driven over Chrome DevTools Protocol. Sending rotates round-robin across enabled accounts.',
  acctRotation: 'Preview of how recipients split across the enabled accounts before a run, balanced round-robin.',
  acctProfile: 'Your operator profile — the identity behind ghfinder. Separate from the Gmail sender mailboxes on the Accounts page.',

  expPage: 'Generated artifacts — batch user files, social-link CSVs, and GES payloads. Download them or copy their paths.',

  setPage: 'Credentials, storage, and enrichment defaults for the harvester and sender.',
  setGithub: 'Your GitHub personal access token — used to authenticate every crawl request against the API.',
  setStorage: 'Where the SQLite database and export files live, and how many users go in each export file.',
  setEnrichment: 'Default enrichment steps applied to every new crawl. Override them per run from the Discovery page.',
  setAppearance: 'Switch between the dark and light theme.',
} as const;
