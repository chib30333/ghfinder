import {
  loadCities,
  run,
  countryStateFilter,
  counts,
  usersByCity,
  usersWithLinks,
  usersWithEmail,
  regenerateAllUserFiles,
  regenerateLinkFile,
  migrateCityFilesToBatches,
  loadTemplate,
  buildBatches,
  templatePath,
  importTextUsersToDb,
} from '@ghfinder/core';

function flag(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

const cmd = process.argv[2];

switch (cmd) {
  case 'init-cities': {
    const mode = flag('query-mode', 'city');
    const inserted = loadCities(mode);
    const c = counts();
    console.error(`Loaded cities (query-mode=${mode}); +${inserted} new, ${c.cities_total} total.`);
    break;
  }
  case 'run': {
    const limit = Number(flag('limit', Infinity));
    const maxProfiles = Number(flag('max-profiles', 0));
    const country = flag('country', '');
    const states = country ? countryStateFilter(country) : null;
    if (country && (!states || !states.length)) {
      console.error(`[warn] unknown country "${country}" — crawling the full work list.`);
    } else if (states) {
      console.error(`[scope] restricting crawl to ${country} (${states.length} state bucket(s)).`);
    }
    await run({ limit, maxProfiles, states });
    break;
  }
  case 'export': {
    const files = regenerateAllUserFiles(usersByCity());
    const links = regenerateLinkFile(usersWithLinks());
    console.error(
      `Rewrote ${files} batch files ({fullname, email}) and ${links} link rows ` +
      `({fullname, telegram, discord}) into link.csv.`
    );
    break;
  }
  case 'ges': {
    const size = Math.max(1, Number(flag('size', 20)) || 20);
    const tpl = loadTemplate();
    if (tpl._created) {
      console.error(
        `Created a starter template at ${templatePath}.\n` +
        `Edit its "subject"/"message" (use {{firstName}} to personalise), then re-run.`
      );
    }
    const rows = usersWithEmail();
    const { recipients, files, dir } = buildBatches(rows, tpl, size);
    console.error(
      `Wrote ${files} GES batch file(s) (${size}/file, ${recipients} recipients) into ${dir}.\n` +
      `Paste one batch_NNNN.json into the GES popup per run.`
    );
    break;
  }
  case 'migrate': {
    const { records, files, legacy } = migrateCityFilesToBatches();
    console.error(
      `Migrated ${records} emailed records from ${legacy} per-city files ` +
      `into ${files} batch files (users_NNNN.txt).`
    );
    break;
  }
  case 'import-text': {
    const r = importTextUsersToDb();
    console.error(
      `Imported text batches into SQLite: files=${r.files}, rows=${r.rows}, ` +
      `matched=${r.matched}, inserted=${r.inserted}, skipped=${r.skipped}, ` +
      `malformed=${r.malformed}.`
    );
    break;
  }
  case 'stats': {
    const c = counts();
    console.error(
      `cities:   ${c.cities_done}/${c.cities_total} done (${c.cities_active} active)\n` +
      `segments: ${c.seg_total} total (${c.seg_split} split, ${c.seg_capped} capped)\n` +
      `users:    ${c.users_total} stored`
    );
    break;
  }
  default:
    console.error(`Usage:
  node apps/cli/src/cli.mjs init-cities [--query-mode city|city-state]
  node apps/cli/src/cli.mjs run [--limit N] [--max-profiles N] [--country US|"United States"|DE|...]
  node apps/cli/src/cli.mjs export
  node apps/cli/src/cli.mjs ges [--size N]
  node apps/cli/src/cli.mjs migrate
  node apps/cli/src/cli.mjs import-text
  node apps/cli/src/cli.mjs stats`);
    process.exit(cmd ? 1 : 0);
}
