// Browser display cache only. Participant APIs still authorize the HttpOnly cookie.
export type ParticipantProfile = { id: string; name: string; phone: string };
export const PROFILE_KEY = 'sdd2026-profile';
export const SESSION_EXPIRED = 'sdd2026-session-expired';
let cached: ParticipantProfile | null | undefined;
let pending: Promise<ParticipantProfile | null> | undefined;
let revision = 0;

function isProfile(value: unknown): value is ParticipantProfile {
  if (!value || typeof value !== 'object') return false;
  const profile = value as Partial<ParticipantProfile>;
  return typeof profile.id === 'string' && profile.id.length > 0
    && typeof profile.name === 'string' && profile.name.trim().length > 0 && profile.name.length <= 50
    && typeof profile.phone === 'string' && /^010[0-9]{8}$/.test(profile.phone);
}

export function saveParticipant(profile: ParticipantProfile | null) {
  revision++;
  cached = profile;
  pending = undefined;
  try {
    if (profile) localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    else localStorage.removeItem(PROFILE_KEY);
  } catch { /* Retain the in-memory cache when browser storage is unavailable. */ }
}

export async function loadParticipant(): Promise<ParticipantProfile | null> {
  if (cached !== undefined) return cached;
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null');
    if (isProfile(stored)) { cached = stored; return stored; }
  } catch { /* Recover from missing or malformed storage using the session cookie. */ }
  if (pending) return pending;
  const started = revision;
  const request = (async () => {
    const response = await fetch('/api/registration', { credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) throw new Error('로그인 상태를 확인하지 못했어요.');
    const data = await response.json() as { profile?: unknown };
    if (data.profile !== null && !isProfile(data.profile)) throw new Error('로그인 정보를 확인해주세요.');
    if (revision === started) saveParticipant(data.profile);
    return cached ?? null;
  })();
  pending = request;
  try { return await request; }
  finally { if (pending === request) pending = undefined; }
}

export async function participantFetch(url: string, init?: RequestInit) {
  const started = revision;
  const response = await fetch(url, init);
  if (response.status === 401 && started === revision) {
    saveParticipant(null);
    window.dispatchEvent(new Event(SESSION_EXPIRED));
  }
  return response;
}
