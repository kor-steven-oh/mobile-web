import { currentRegistration } from '../../../db/registration';
import { getD1 } from '../../../db';
import { GiftRedemptionError, redeemGift } from '../../../db/gifts';

const headers = { 'Cache-Control': 'no-store' };
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
    const kind = 'kind' in input ? input.kind : 'gift';
    if (kind !== 'gift' && kind !== 'gift3') return error('선물 종류를 확인해주세요.', 400);
    return Response.json(await redeemGift(await getD1(), profile.id, input.pin, Date.now(), kind), { headers });
  } catch (cause) {
    if (cause instanceof GiftRedemptionError) return error(cause.message, cause.status);
    return error('수령 처리를 완료하지 못했습니다. 다시 시도해주세요.', 503);
  }
}
