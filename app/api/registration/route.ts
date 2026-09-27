import { clearedSessionCookie, currentRegistration, endSession, register } from '../../../db/registration';

const noStore = { 'Cache-Control': 'no-store' };

export async function GET(request: Request) {
  try {
    return Response.json({ profile: await currentRegistration(request) }, { headers: noStore });
  } catch {
    return Response.json({ error: '로그인 정보를 확인하지 못했어요.' }, { status: 503, headers: noStore });
  }
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) {
    return Response.json({ error: '잘못된 요청입니다.' }, { status: 403, headers: noStore });
  }

  let input: unknown;
  try {
    const text = await request.text();
    if (text.length > 1024) return Response.json({ error: '입력값이 너무 깁니다.' }, { status: 413, headers: noStore });
    input = JSON.parse(text);
  } catch {
    return Response.json({ error: '입력값을 확인해주세요.' }, { status: 400, headers: noStore });
  }
  if (!input || typeof input !== 'object') return Response.json({ error: '입력값을 확인해주세요.' }, { status: 400, headers: noStore });
  const data = input as Record<string, unknown>;
  const name = typeof data.name === 'string' ? data.name.trim() : '';
  const phone = typeof data.phone === 'string' ? data.phone : '';
  if (!name || name.length > 50) return Response.json({ error: '이름을 확인해주세요.' }, { status: 400, headers: noStore });
  if (!/^010[0-9]{8}$/.test(phone)) return Response.json({ error: '휴대전화번호 11자리를 확인해주세요.' }, { status: 400, headers: noStore });

  try {
    const result = await register(name, phone, request);
    return Response.json({ profile: result.profile }, { headers: { ...noStore, 'Set-Cookie': result.cookie } });
  } catch {
    return Response.json({ error: '로그인 정보를 저장하지 못했어요. 다시 시도해주세요.' }, { status: 503, headers: noStore });
  }
}

export async function DELETE(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) {
    return Response.json({ error: '잘못된 요청입니다.' }, { status: 403, headers: noStore });
  }
  try {
    await endSession(request);
    return Response.json({ profile: null }, { headers: { ...noStore, 'Set-Cookie': clearedSessionCookie(request) } });
  } catch {
    return Response.json({ error: '로그아웃하지 못했어요.' }, { status: 503, headers: noStore });
  }
}
