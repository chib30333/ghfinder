
const str = (v) => (v == null ? '' : String(v));

const NOISE = new Set([
  'my', 'the', 'a', 'an', 'is', 'are', 'was', 'best', 'great', 'good', 'cool',
  'awesome', 'available', 'active', 'online', 'open', 'here', 'there', 'also',
  'just', 'not', 'no', 'yes', 'and', 'or', 'me', 'you', 'for', 'to', 'on', 'at',
  'in', 'discord', 'telegram', 'username', 'user', 'id', 'handle', 'tag', 'name',
]);
const notNoise = (h) => (h && !NOISE.has(h.replace(/^@/, '').toLowerCase()) ? h : null);

function findTelegram(text) {
  const link = text.match(
    /(?:https?:\/\/)?(?:www\.)?(?:t\.me|telegram\.me|telegram\.dog)\/(?:s\/)?@?([A-Za-z][A-Za-z0-9_]{3,31})\b/i
  );
  if (link && !/^(joinchat|share|proxy)$/i.test(link[1])) return link[1];

  const domain = text.match(/tg:\/\/resolve\?domain=([A-Za-z][A-Za-z0-9_]{3,31})/i);
  if (domain) return domain[1];

  const labelled = text.match(
    /\b(?:telegram|tg)\b(?:\s+(?:id|user(?:name)?|handle))?\s*(?:\bis\b|[:=])\s*@?([A-Za-z][A-Za-z0-9_]{3,31})\b/i
  );
  if (labelled) return notNoise(labelled[1]);

  return null;
}

function findDiscord(text) {
  const invite = text.match(
    /(?:https?:\/\/)?(?:www\.)?(?:discord\.gg|discord(?:app)?\.com\/invite)\/[A-Za-z0-9-]+/i
  );
  if (invite) return invite[0].replace(/^https?:\/\//i, '');

  const userLink = text.match(/(?:https?:\/\/)?(?:www\.)?discord(?:app)?\.com\/users\/\d+/i);
  if (userLink) return userLink[0].replace(/^https?:\/\//i, '');

  const labelled = text.match(
    /\bdiscord\b(?:\s+(?:id|user(?:name)?|handle|tag))?\s*(?:\bis\b|[:=])\s*@?([A-Za-z0-9_.]{2,32}(?:#\d{4})?)\b/i
  );
  if (labelled && notNoise(labelled[1])) return labelled[1];

  const keyworded = text.match(
    /\bdiscord\s+(?:id|user(?:name)?|handle|tag)\s+@?([A-Za-z0-9_.]{2,32}(?:#\d{4})?)\b/i
  );
  if (keyworded && notNoise(keyworded[1])) return keyworded[1];

  const legacyTag = text.match(/\b([A-Za-z0-9_.]{2,32}#\d{4})\b/);
  if (legacyTag) return legacyTag[1];

  return null;
}

export function extractSocialLinks(fields) {
  const text = fields.map(str).filter(Boolean).join('\n');
  if (!text) return { telegram: null, discord: null };
  return { telegram: findTelegram(text), discord: findDiscord(text) };
}
