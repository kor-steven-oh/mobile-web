import { getD1 } from './index';

export type RegistrationProfile = { id: string; name: string; phone: string };

const COOKIE_NAME = 'sdd2026_session';
const SESSION_AGE_SECONDS = 60 * 60 * 24 * 180;

function sessionToken(request: Request): string | null {
  const entry = request.headers.get('cookie')?.split(';').map(value => value.trim()).find(value => value.startsWith(`${COOKIE_NAME}=`));
  const token = entry?.slice(COOKIE_NAME.length + 1);
  return token && /^[a-f0-9]{64}$/.test(token) ? token : null;
}

async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export function sessionCookie(token: string, request: Request): string {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_AGE_SECONDS}${secure}`;
}

export function clearedSessionCookie(request: Request): string {
  return sessionCookie('', request).replace(`Max-Age=${SESSION_AGE_SECONDS}`, 'Max-Age=0');
}

export async function currentRegistration(request: Request): Promise<RegistrationProfile | null> {
  const token = sessionToken(request);
  if (!token) return null;
  const db = await getD1();
  const hash = await hashToken(token);
  return await db.prepare(`
    SELECT registrations.id, registrations.name, registrations.phone
    FROM login_sessions
    JOIN registrations ON registrations.id = login_sessions.registration_id
    WHERE login_sessions.token_hash = ? AND login_sessions.expires_at > ?
  `).bind(hash, Date.now()).first<RegistrationProfile>();
}

export async function register(name: string, phone: string, request: Request): Promise<{ profile: RegistrationProfile; cookie: string }> {
  const db = await getD1();
  await db.prepare('INSERT INTO registrations (id, name, phone) VALUES (?, ?, ?) ON CONFLICT(name, phone) DO NOTHING')
    .bind(crypto.randomUUID(), name, phone).run();
  const registration = await db.prepare('SELECT id, name FROM registrations WHERE name = ? AND phone = ?')
    .bind(name, phone).first<{ id: string; name: string }>();
  if (!registration) throw new Error('Registration could not be loaded');

  const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
  await db.prepare('INSERT INTO login_sessions (token_hash, registration_id, expires_at) VALUES (?, ?, ?)')
    .bind(await hashToken(token), registration.id, Date.now() + SESSION_AGE_SECONDS * 1000).run();
  return { profile: { id: registration.id, name, phone }, cookie: sessionCookie(token, request) };
}

export async function endSession(request: Request): Promise<void> {
  const token = sessionToken(request);
  if (!token) return;
  const db = await getD1();
  await db.prepare('DELETE FROM login_sessions WHERE token_hash = ?').bind(await hashToken(token)).run();
}
