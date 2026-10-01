import { getD1 } from '../../../db';
import { currentRegistration } from '../../../db/registration';
import { preRegistrationGiftStatus, GiftRedemptionError, redeemPreRegistrationGift } from '../../../db/gifts';

const headers = { 'Cache-Control': 'no-store' };

export async function GET(request: Request) {
  try {
    const profile = await currentRegistration(request);
    if (!profile) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401, headers });
    return Response.json(await preRegistrationGiftStatus(await getD1(), profile.id), { headers });
  } catch {
    return Response.json({ error: '사전등록 선물 정보를 확인하지 못했습니다.' }, { status: 503, headers });
  }
}

const error = (message: string, status: number) => Response.json({ error: message }, { status, headers });

export async function POST(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) return error('잘못된 요청입니다.', 403);
  try {
    const profile = await currentRegistration(request);
    if (!profile) return error('로그인이 필요합니다.', 401);
    const reader = request.body?.getReader();
    if (!reader) return error('STAFF 인증번호를 입력해주세요.', 400);
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 128) { await reader.cancel(); return error('요청이 너무 큽니다.', 413); }
      chunks.push(value);
    }
    let input: unknown;
    try {
      const bytes = new Uint8Array(length);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      input = JSON.parse(new TextDecoder().decode(bytes));
    } catch { return error('STAFF 인증번호를 확인해주세요.', 400); }
    if (!input || typeof input !== 'object' || !('pin' in input) || typeof input.pin !== 'string') return error('STAFF 인증번호 4자리를 입력해주세요.', 400);
    return Response.json(await redeemPreRegistrationGift(await getD1(), profile.id, input.pin), { headers });
  } catch (cause) {
    if (cause instanceof GiftRedemptionError) return error(cause.message, cause.status);
    return error('수령 처리를 완료하지 못했습니다. 다시 시도해주세요.', 503);
  }
}
