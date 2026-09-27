import type { VenueBoundary } from './venue-location';

// Server-owned configuration: Samsung The UniverSE place pin.
// Source supplied by the organizer: https://maps.app.goo.gl/Z6d8Dp8VkaqN8qnn6
// Missing coordinates deliberately block check-in rather than skipping location validation.
export const venueBoundary: VenueBoundary = {
  latitude: 37.2349187,
  longitude: 127.0762349243164,
  radiusMeters: 200,
  maxAccuracyMeters: 100,
};
