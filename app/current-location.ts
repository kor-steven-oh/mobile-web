import type { LocationFix } from '../db/venue-location';

export function currentLocation(signal: AbortSignal): Promise<LocationFix> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new Error('위치 확인이 취소되었습니다.')); return; }
    if (!window.isSecureContext || !navigator.geolocation) {
      reject(new Error('현재 브라우저에서 위치를 확인할 수 없습니다. HTTPS 주소를 Safari 또는 Chrome에서 열어주세요.'));
      return;
    }
    const cancel = () => reject(new Error('위치 확인이 취소되었습니다.'));
    signal.addEventListener('abort', cancel, { once: true });
    navigator.geolocation.getCurrentPosition(position => {
      signal.removeEventListener('abort', cancel);
      resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy, timestamp: position.timestamp });
    }, error => {
      signal.removeEventListener('abort', cancel);
      reject(new Error(error.code === 1
        ? '위치 권한이 필요합니다. 브라우저 설정에서 위치 접근을 허용한 뒤 다시 시도해주세요.'
        : error.code === 3
          ? '위치 확인 시간이 초과되었습니다. 입구나 창가에서 다시 시도해주세요.'
          : '현재 위치를 확인하지 못했습니다. 휴대폰의 위치 서비스를 켜고 다시 시도해주세요.'));
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
  });
}
