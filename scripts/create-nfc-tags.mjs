import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [originArgument, outputArgument] = process.argv.slice(2);
if (!originArgument || !outputArgument) throw new Error('Usage: node scripts/create-nfc-tags.mjs https://your-site.example .wrangler/nfc-tags');
const url = new URL(originArgument);
if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) throw new Error('Use HTTPS for event NFC links.');
const output = resolve(outputArgument);
// Exclusive directory creation avoids overwriting issued tag credentials.
mkdirSync(output, { mode: 0o700 });
const tags = ['101', '107', '201', '206', '208'].map(room => {
  const token = randomBytes(32).toString('hex');
  return { id: randomUUID(), room, hash: createHash('sha256').update(token).digest('hex'), url: `${url.origin}/gift#checkin=${token}` };
});
writeFileSync(resolve(output, 'tags.json'), JSON.stringify(tags.map(({ id, room, url }) => ({ id, room, url })), null, 2), { mode: 0o600, flag: 'wx' });
writeFileSync(resolve(output, 'register-tags.sql'), tags.map(tag => `INSERT INTO nfc_tags (id, room, token_hash) VALUES ('${tag.id}', '${tag.room}', '${tag.hash}');`).join('\n'), { mode: 0o600, flag: 'wx' });
console.log(`Created 5 NFC URLs and their database registration file in ${output}. URLs are not printed; keep tags.json private.`);
