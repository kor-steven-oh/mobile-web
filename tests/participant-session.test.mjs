import assert from 'node:assert/strict';
import test from 'node:test';

const profile = { id: 'participant-1', name: '테스트', phone: '01012345678' };
const key = 'sdd2026-profile';
let instance = 0;
async function setup(t, stored) {
  const values = new Map(stored === undefined ? [] : [[key, stored]]);
  const oldStorage = globalThis.localStorage, oldWindow = globalThis.window, oldFetch = globalThis.fetch;
  globalThis.localStorage = { getItem: k => values.get(k) ?? null, setItem: (k,v) => values.set(k,v), removeItem: k => values.delete(k) };
  globalThis.window = new EventTarget();
  t.after(() => { globalThis.localStorage = oldStorage; globalThis.window = oldWindow; globalThis.fetch = oldFetch; });
  return { session: await import(`../app/participant-session.ts?test=${instance++}`), values };
}

test('persisted profile survives a fresh module/page load without any server lookup', async t => {
  const { session } = await setup(t, JSON.stringify(profile));
  globalThis.fetch = async () => { throw new Error('Unexpected server lookup'); };
  assert.deepEqual(await session.loadParticipant(), profile);
  assert.deepEqual(await session.loadParticipant(), profile);
});

test('missing or malformed cache recovers once and shares concurrent lookups', async t => {
  const { session, values } = await setup(t, '{broken');
  let requests = 0;
  globalThis.fetch = async () => { requests++; return Response.json({ profile }); };
  const results = await Promise.all([session.loadParticipant(), session.loadParticipant()]);
  assert.deepEqual(results, [profile,profile]);
  assert.deepEqual(await session.loadParticipant(), profile);
  assert.equal(requests, 1);
  assert.deepEqual(JSON.parse(values.get(key)), profile);
});

test('expired participant API session clears cache, requests login, and preserves pending NFC', async t => {
  const { session, values } = await setup(t, JSON.stringify(profile));
  await session.loadParticipant();
  values.set('sdd2026-pending-nfc', 'pending');
  let expired = 0;
  window.addEventListener(session.SESSION_EXPIRED, () => expired++);
  globalThis.fetch = async () => new Response(null, { status: 401 });
  assert.equal((await session.participantFetch('/api/attendance')).status, 401);
  assert.equal(await session.loadParticipant(), null);
  assert.equal(values.has(key), false);
  assert.equal(values.get('sdd2026-pending-nfc'), 'pending');
  assert.equal(expired, 1);
});

test('server failures preserve cached identity and logout cannot be undone by an old lookup', async t => {
  const { session, values } = await setup(t);
  let resolve;
  globalThis.fetch = () => new Promise(r => { resolve = r; });
  const request = session.loadParticipant();
  session.saveParticipant(null);
  resolve(Response.json({ profile }));
  assert.equal(await request, null);
  assert.equal(values.has(key), false);
  session.saveParticipant(profile);
  globalThis.fetch = async () => new Response(null, { status: 503 });
  await session.participantFetch('/api/attendance');
  assert.deepEqual(await session.loadParticipant(), profile);
});

test('disabled browser storage still reuses profile within the current page lifetime', async t => {
  const { session } = await setup(t);
  globalThis.localStorage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  let requests = 0;
  globalThis.fetch = async () => { requests++; return Response.json({ profile }); };
  assert.deepEqual(await session.loadParticipant(), profile);
  assert.deepEqual(await session.loadParticipant(), profile);
  assert.equal(requests, 1);
});
