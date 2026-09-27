import type { RaffleEntry } from './raffle';
export type AttendanceRecord = { slot: number; sessionId: number; title: string; room: string; verifiedAt: number };
export type EventReward = { id: string; kind: 'gift' | 'ticket'; issuedAt: number; redeemedAt: number | null };
export type AttendanceStatus = { records: AttendanceRecord[]; rewards: EventReward[]; raffleEntry: RaffleEntry | null };

export type AttendanceCheckinResult = AttendanceStatus & { checkin: { slot: number; isNew: boolean } };

export class AttendanceError extends Error {
  status: number;
  constructor(message: string, status = 409) { super(message); this.status = status; }
}

export async function hashNfcToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

function statusQueries(db: D1Database, registrationId: string) {
  return [
    db.prepare(`SELECT a.slot, a.session_id AS sessionId, s.title, s.room, a.verified_at AS verifiedAt
      FROM attendance a JOIN event_sessions s ON s.id = a.session_id
      WHERE a.registration_id = ? ORDER BY a.slot`).bind(registrationId),
    db.prepare(`SELECT id, kind, issued_at AS issuedAt, redeemed_at AS redeemedAt
      FROM event_rewards WHERE registration_id = ? ORDER BY issued_at`).bind(registrationId),
    db.prepare('SELECT number, issued_at AS issuedAt FROM raffle_entries WHERE registration_id = ? AND voided_at IS NULL').bind(registrationId),
  ];
}

function statusFromResults([records, rewards, raffle]: D1Result[]): AttendanceStatus {
  return { records: records.results as AttendanceRecord[], rewards: rewards.results as EventReward[], raffleEntry: (raffle.results[0] as RaffleEntry | undefined) ?? null };
}

export async function attendanceStatus(db: D1Database, registrationId: string): Promise<AttendanceStatus> {
  return statusFromResults(await db.batch(statusQueries(db, registrationId)));
}

// The clock is supplied by the server, never by the request body.
export async function verifyAttendance(db: D1Database, registrationId: string, token: string, now = Date.now(), options: { enforceTime?: boolean; slot?: number } = {}) {
  const enforceTime = options.enforceTime !== false;
  const slot = options.slot ?? 1;
  if (!enforceTime && (!Number.isInteger(slot) || slot < 1 || slot > 5)) {
    throw new AttendanceError('인증할 회차를 1~5 중에서 선택해주세요.', 400);
  }
  // LEFT JOIN distinguishes an invalid tag from a valid room with no active session.
  const condition = enforceTime ? 's.starts_at <= ? AND s.closes_at > ?' : 's.slot = ?';
  const session = await db.prepare(`SELECT t.id AS tagId, s.id, s.slot FROM nfc_tags t
    LEFT JOIN event_sessions s ON s.room = t.room AND ${condition}
    WHERE t.token_hash = ? AND t.active = 1`)
    .bind(...(enforceTime ? [now, now] : [slot]), await hashNfcToken(token))
    .first<{ tagId: string; id: number | null; slot: number | null }>();
  if (!session) throw new AttendanceError('유효하지 않은 NFC 태그입니다. 입구에서 다시 태깅해주세요.', 404);
  if (session.id === null || session.slot === null) throw new AttendanceError('지금은 인증 가능한 시간이 아닙니다. 강연 시작 후 10분 이내에 태깅해주세요.');

  // D1 batch is a transaction: attendance and reward eligibility commit together.
  // A ticket reward is only eligibility; enterRaffle issues the actual numbered entry.
  // Unique constraints also protect retries and concurrent requests across rooms.
  const inserted = await db.batch([
    db.prepare(`INSERT INTO attendance (registration_id, slot, session_id, tag_id, verified_at)
      SELECT ?, ?, ?, id, ? FROM nfc_tags WHERE id = ? AND active = 1
      ON CONFLICT(registration_id, slot) DO NOTHING RETURNING slot`).bind(registrationId, session.slot, session.id, now, session.tagId),
    ...(['gift', 'ticket'] as const).map(kind => db.prepare(`
      INSERT INTO event_rewards (id, registration_id, kind, issued_at)
      SELECT ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM attendance WHERE registration_id = ?) >= ?
      ON CONFLICT(registration_id, kind) DO NOTHING
    `).bind(crypto.randomUUID(), registrationId, kind, now, registrationId, kind === 'gift' ? 2 : 4)),
    ...statusQueries(db, registrationId),
  ]);
  const status = statusFromResults(inserted.slice(3));
  const recorded = status.records.find(record => record.slot === session.slot);
  if (!recorded) throw new AttendanceError('인증하지 못했습니다. 입구의 NFC 태그를 다시 확인해주세요.');
  if (recorded.sessionId !== session.id) throw new AttendanceError('이 시간대에는 이미 다른 강연을 인증했습니다. 시간대별 1개만 인증할 수 있습니다.');
  return { ...status, checkin: { slot: session.slot, isNew: inserted[0].results.length > 0 } } satisfies AttendanceCheckinResult;
}
