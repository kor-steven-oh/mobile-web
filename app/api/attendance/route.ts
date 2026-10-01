import { currentRegistration } from '../../../db/registration';
import { getD1 } from '../../../db';
import { attendancePolicy } from '../../attendance-policy';
import { venueBoundary } from '../../../db/venue-config';
import { VenueLocationError, verifyVenueLocation } from '../../../db/venue-location';
import { AttendanceError, attendanceStatus, verifyAttendance } from '../../../db/attendance';

const headers = { 'Cache-Control': 'no-store' };
const error = (message: string, status: number) => Response.json({ error: message }, { status, headers });

export async function GET(request: Request) {
  try {
    const profile = await currentRegistration(request);
    if (!profile) return error('로그인이 필요합니다.', 401);
    return Response.json(await attendanceStatus(await getD1(), profile.id), { headers });
  } catch { return error('인증 현황을 불러오지 못했습니다. 다시 시도해주세요.', 503); }
}

export async function POST(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) return error('잘못된 요청입니다.', 403);
  try {
    const profile = await currentRegistration(request);
    if (!profile) return error('로그인이 필요합니다.', 401);
    // Bound the actual body, including requests without Content-Length.
    const reader = request.body?.getReader();
    if (!reader) return error('NFC 태그 정보가 필요합니다.', 400);
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 512) { await reader.cancel(); return error('요청이 너무 큽니다.', 413); }
      chunks.push(value);
    }
    let input: unknown;
    try {
      const body = new Uint8Array(length);
      let offset = 0;
      for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length; }
      input = JSON.parse(new TextDecoder().decode(body));
    } catch { return error('NFC 태그 정보를 확인해주세요.', 400); }
    if (!input || typeof input !== 'object' || !('token' in input) || typeof input.token !== 'string' || !/^[a-f0-9]{64}$/.test(input.token)) {
      return error('입구의 NFC 태그로 접속해주세요.', 400);
    }
    if (attendancePolicy.enforceLocation) verifyVenueLocation('location' in input ? input.location : undefined, venueBoundary);
    const slot = 'slot' in input ? input.slot : 1;
    if (!attendancePolicy.enforceTime && (typeof slot !== 'number' || !Number.isInteger(slot) || slot < 1 || slot > 5)) return error('인증할 회차를 1~5 중에서 선택해주세요.', 400);
    return Response.json(await verifyAttendance(await getD1(), profile.id, input.token, Date.now(), {
      enforceTime: attendancePolicy.enforceTime, slot: typeof slot === 'number' ? slot : undefined,
    }), { headers });
  } catch (cause) {
    if (cause instanceof AttendanceError || cause instanceof VenueLocationError) return error(cause.message, cause.status);
    return error('참여 인증을 저장하지 못했습니다. 다시 시도해주세요.', 503);
  }
}
