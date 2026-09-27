import assert from 'node:assert/strict';
import test from 'node:test';
import { captureNfcLink, clearPendingNfc, pendingNfcSlot, pendingNfcToken } from '../app/nfc-pending.ts';

test('all 25 room/slot URL combinations survive the login redirect and clear after certification', () => {
  const previousWindow = globalThis.window;
  const previousStorage = globalThis.sessionStorage;
  const values = new Map();
  const location = { hash: '', pathname: '/event', search: '' };
  globalThis.window = { location, history: { replaceState() { location.hash = ''; } } };
  globalThis.sessionStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  };
  try {
    for (const char of ['a', 'b', 'c', 'd', 'e']) for (let slot = 1; slot <= 5; slot++) {
      const token = char.repeat(64);
      location.hash = `#checkin=${token}&slot=${slot}`;
      captureNfcLink();
      assert.equal(location.hash, '');
      location.pathname = '/';
      assert.equal(pendingNfcToken(), token);
      assert.equal(pendingNfcSlot(), slot);
      location.pathname = '/event';
      assert.equal(pendingNfcSlot(), slot);
      clearPendingNfc();
      assert.equal(pendingNfcToken(), null);
    }
    location.hash = `#checkin=${'a'.repeat(64)}`;
    captureNfcLink();
    assert.equal(pendingNfcSlot(), 1);
    location.hash = `#checkin=${'b'.repeat(64)}&slot=6`;
    captureNfcLink();
    assert.equal(pendingNfcToken(), null);
  } finally {
    if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow;
    if (previousStorage === undefined) delete globalThis.sessionStorage; else globalThis.sessionStorage = previousStorage;
  }
});
