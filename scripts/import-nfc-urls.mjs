import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const [source, output] = process.argv.slice(2);
if (!source || !output) throw new Error('Usage: node scripts/import-nfc-urls.mjs private/tags.json private/import-urls.sql');
const tags = JSON.parse(readFileSync(source, 'utf8'));
if (!Array.isArray(tags) || !tags.length) throw new Error('Expected a non-empty tag list.');
const quote = value => `'${value.replaceAll("'", "''")}'`;
const statements = tags.map(tag => {
  if (typeof tag.id !== 'string' || !['101', '107', '201', '206', '208', 'EVENT_ZONE'].includes(tag.room)) throw new Error('Invalid tag metadata.');
  const url = new URL(tag.url);
  if (url.username || url.password || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))) throw new Error('Invalid NFC URL origin.');
  const token = new URLSearchParams(url.hash.slice(1)).get('checkin');
  if (!token || !/^[a-f0-9]{64}$/.test(token)) throw new Error('Invalid NFC token.');
  const hash = createHash('sha256').update(token).digest('hex');
  const normalized = `${url.origin}/gift#checkin=${token}`;
  // Restore only the matching tag. Never change or replace its authentication token.
  return `UPDATE nfc_tags SET url = ${quote(normalized)} WHERE id = ${quote(tag.id)} AND room = ${quote(tag.room)} AND token_hash = ${quote(hash)};`;
});
writeFileSync(output, statements.join('\n'), { mode: 0o600, flag: 'wx' });
console.log(`Prepared ${statements.length} URL updates. Private URLs are not printed.`);
