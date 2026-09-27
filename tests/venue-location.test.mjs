import assert from 'node:assert/strict';
import test from 'node:test';
import { distanceMeters, verifyVenueLocation } from '../db/venue-location.ts';
import { venueBoundary } from '../db/venue-config.ts';

const now = Date.parse('2026-10-15T10:00:00+09:00');
const fix = { latitude: venueBoundary.latitude, longitude: venueBoundary.longitude, accuracy: 20, timestamp: now };
const north = meters => ({ ...fix, latitude: fix.latitude + meters / 6371000 * 180 / Math.PI });

test('confirmed venue and nearby readings are accepted within the 200m boundary', () => {
  assert.equal(venueBoundary.radiusMeters, 200);
  assert.doesNotThrow(() => verifyVenueLocation(fix, venueBoundary, now));
  assert.doesNotThrow(() => verifyVenueLocation(north(199), venueBoundary, now));
  assert.ok(Math.abs(distanceMeters(fix, north(150)) - 150) < 0.001);
});

test('outside locations cannot use an accuracy allowance to enter the boundary', () => {
  assert.throws(() => verifyVenueLocation(north(201), venueBoundary, now), { status: 422 });
  assert.throws(() => verifyVenueLocation({ ...north(250), accuracy: 100 }, venueBoundary, now), { status: 422 });
  assert.throws(() => verifyVenueLocation(north(10000), venueBoundary, now), { status: 422 });
});

test('missing, invalid, inaccurate or stale readings fail closed', () => {
  for (const invalid of [undefined, null, {}, { ...fix, latitude: '37' }, { ...fix, longitude: Infinity },
    { ...fix, latitude: 91 }, { ...fix, longitude: -181 }, { ...fix, accuracy: 0 }, { ...fix, accuracy: 101 },
    { ...fix, timestamp: now - 60001 }, { ...fix, timestamp: now + 10001 }]) {
    assert.throws(() => verifyVenueLocation(invalid, venueBoundary, now), { status: 422 });
  }
  assert.throws(() => verifyVenueLocation(fix, { ...venueBoundary, latitude: null }, now), { status: 503 });
});
