import { timingSafeEqual } from 'node:crypto';
const COOKIE = 'sdd2026_admin';
const AGE = 12 * 60 * 60;
export async function digest(value: string) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash), x => x.toString(16).padStart(2, '0')).join('');
}
function token(request: Request) {
  const value = request.headers.get('cookie')?.split(';').map(x => x.trim()).find(x => x.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  return value && /^[a-f0-9]{64}$/.test(value) ? value : null;
}
export function cookie(request: Request, value = '', expires = false) {
  return `${COOKIE}=${value}; HttpOnly; SameSite=Strict; Path=/admin/api; Max-Age=${expires ? 0 : AGE}${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`;
}
export async function authenticate(db: D1Database, request: Request) {
  const value = token(request);
  return value ? db.prepare('SELECT id FROM admin_sessions WHERE token_hash = ? AND expires_at > ?').bind(await digest(value), Date.now()).first<{ id: string }>() : null;
}
export async function logout(db: D1Database, request: Request) {
  const value = token(request);
  if (value) await db.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').bind(await digest(value)).run();
}
export async function login(db: D1Database, password: string, hash: string | undefined, ip: string) {
  if (!hash || !/^[a-f0-9]{64}$/.test(hash)) return { error: '관리자 비밀번호가 설정되지 않았습니다.', status: 503 };
  const now = Date.now();
  const limits = [{ key: `ip:${await digest(ip)}`, max: 5 }, { key: 'global', max: 30 }];
  const result = await db.batch<{ attempts: number }>(limits.map(({ key }) => db.prepare(`
    INSERT INTO admin_login_attempts (key, attempts, window_started_at) VALUES (?, 1, ?)
    ON CONFLICT(key) DO UPDATE SET attempts = CASE WHEN window_started_at <= ? THEN 1 ELSE attempts+1 END,
    window_started_at = CASE WHEN window_started_at <= ? THEN excluded.window_started_at ELSE window_started_at END
    RETURNING attempts`).bind(key, now, now - 900000, now - 900000)));
  if (result.some((r, i) => r.results[0].attempts > limits[i].max)) return { error: '시도 횟수를 초과했습니다. 15분 후 다시 시도해주세요.', status: 429 };
  if (!timingSafeEqual(new TextEncoder().encode(await digest(password)), new TextEncoder().encode(hash))) return { error: '비밀번호가 일치하지 않습니다.', status: 401 };
  const value = Array.from(crypto.getRandomValues(new Uint8Array(32)), x => x.toString(16).padStart(2, '0')).join('');
  await db.prepare('INSERT INTO admin_sessions(id, token_hash, expires_at) VALUES (?,?,?)').bind(crypto.randomUUID(), await digest(value), now + AGE * 1000).run();
  return { token: value };
}
