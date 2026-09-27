export type VenueBoundary = {
  latitude: number | null;
  longitude: number | null;
  radiusMeters: number;
  maxAccuracyMeters: number;
};

export type LocationFix = { latitude: number; longitude: number; accuracy: number; timestamp: number };

export class VenueLocationError extends Error {
  status: number;
  constructor(message: string, status = 422) { super(message); this.status = status; }
}

export function distanceMeters(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const rad = (value: number) => value * Math.PI / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.max(0, Math.min(1, h))));
}

export function verifyVenueLocation(value: unknown, venue: VenueBoundary, now = Date.now()): void {
  if (venue.latitude === null || venue.longitude === null || !Number.isFinite(venue.latitude) || !Number.isFinite(venue.longitude)
    || Math.abs(venue.latitude) > 90 || Math.abs(venue.longitude) > 180
    || !Number.isFinite(venue.radiusMeters) || venue.radiusMeters <= 0
    || !Number.isFinite(venue.maxAccuracyMeters) || venue.maxAccuracyMeters <= 0) {
    throw new VenueLocationError('행사장 위치가 아직 설정되지 않았습니다. 운영자에게 문의해주세요.', 503);
  }
  if (!value || typeof value !== 'object') throw new VenueLocationError('수강 인증을 위해 현재 위치 확인이 필요합니다. 위치 권한을 허용하고 다시 시도해주세요.');
  const fix = value as Partial<LocationFix>;
  if (typeof fix.latitude !== 'number' || !Number.isFinite(fix.latitude) || Math.abs(fix.latitude) > 90
    || typeof fix.longitude !== 'number' || !Number.isFinite(fix.longitude) || Math.abs(fix.longitude) > 180
    || typeof fix.accuracy !== 'number' || !Number.isFinite(fix.accuracy) || fix.accuracy <= 0
    || typeof fix.timestamp !== 'number' || !Number.isFinite(fix.timestamp)) {
    throw new VenueLocationError('위치 정보를 확인하지 못했습니다. 위치를 다시 확인해주세요.');
  }
  if (now - fix.timestamp > 60000 || fix.timestamp - now > 10000) {
    throw new VenueLocationError('위치 정보가 오래되었거나 기기의 시간이 맞지 않습니다. 현재 위치를 다시 확인해주세요.');
  }
  if (fix.accuracy > venue.maxAccuracyMeters) {
    throw new VenueLocationError('위치 오차가 커서 확인하기 어렵습니다. 정확한 위치 사용을 켜고 입구나 창가에서 다시 시도해주세요.');
  }
  // Accuracy never expands the allowed radius: an imprecise fix cannot admit an offsite location.
  if (distanceMeters({ latitude: fix.latitude, longitude: fix.longitude }, { latitude: venue.latitude, longitude: venue.longitude }) > venue.radiusMeters) {
    throw new VenueLocationError(`행사장 반경 ${venue.radiusMeters}m 안에서만 인증할 수 있습니다. 행사장에 도착한 후 다시 시도해주세요.`);
  }
}
