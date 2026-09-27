import { currentRegistration } from '../../../db/registration';
import { getD1 } from '../../../db';
import { enterRaffle, RaffleEntryError } from '../../../db/raffle';

const headers = { 'Cache-Control': 'no-store' };
const error = (message: string, status: number) => Response.json({ error: message }, { status, headers });

export async function POST(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) return error('잘못된 요청입니다.', 403);
  try {
    const profile = await currentRegistration(request);
    if (!profile) return error('로그인이 필요합니다.', 401);
    // No client-provided participant ID, eligibility or ticket number is accepted.
    return Response.json(await enterRaffle(await getD1(), profile.id), { headers });
  } catch (cause) {
    if (cause instanceof RaffleEntryError) return error(cause.message, cause.status);
    return error('응모권을 발급하지 못했습니다. 다시 시도해주세요.', 503);
  }
}
