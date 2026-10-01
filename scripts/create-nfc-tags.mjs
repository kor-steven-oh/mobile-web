import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [originArgument, outputArgument, mode] = process.argv.slice(2);
if (!originArgument || !outputArgument) throw new Error('Usage: node scripts/create-nfc-tags.mjs https://your-site.example .wrangler/nfc-tags [--event-zone-only]');
if (mode && mode !== '--event-zone-only') throw new Error('Unknown option. Use --event-zone-only to add only an event-zone tag.');
const url = new URL(originArgument);
if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) throw new Error('Use HTTPS for event NFC links.');
const output = resolve(outputArgument);
// Exclusive directory creation avoids overwriting issued tag credentials.
mkdirSync(output, { mode: 0o700 });
const rooms = mode === '--event-zone-only' ? ['EVENT_ZONE'] : ['101', '107', '201', '206', '208', 'EVENT_ZONE'];
const tags = rooms.map(room => {
  const token = randomBytes(32).toString('hex');
  return { id: randomUUID(), room, hash: createHash('sha256').update(token).digest('hex'), url: `${url.origin}/gift#checkin=${token}` };
});
writeFileSync(resolve(output, 'tags.json'), JSON.stringify(tags.map(({ id, room, url }) => ({ id, room, url })), null, 2), { mode: 0o600, flag: 'wx' });
writeFileSync(resolve(output, 'register-tags.sql'), tags.map(tag => `INSERT INTO nfc_tags (id, room, token_hash, url) VALUES ('${tag.id}', '${tag.room}', '${tag.hash}', '${tag.url}');`).join('\n'), { mode: 0o600, flag: 'wx' });
console.log(`Created ${tags.length} NFC URLs and their database registration file in ${output}. URLs are not printed; keep tags.json private.`);
