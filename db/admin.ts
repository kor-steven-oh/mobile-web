export type AdminUser = { id: string; name: string; phone: string; createdAt: string; attendanceCount: number; eventZoneVerifiedAt: number | null; giftIssued: number; giftRedeemedAt: number | null; gift3Issued: number; gift3RedeemedAt: number | null; raffleNumber: number | null; raffleVoidedAt: number | null };
export type ResetAction = 'event-zone' | 'attendance' | 'session' | 'gift' | 'raffle' | 'participation';
export class AdminError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}
const userSelect = `SELECT r.id, r.name, r.phone, r.created_at AS createdAt,
  (SELECT COUNT(*) FROM attendance WHERE registration_id=r.id) AS attendanceCount,
  (SELECT verified_at FROM event_zone_attendance WHERE registration_id=r.id) AS eventZoneVerifiedAt,
  EXISTS(SELECT 1 FROM event_rewards WHERE registration_id=r.id AND kind='gift') AS giftIssued,
  (SELECT redeemed_at FROM event_rewards WHERE registration_id=r.id AND kind='gift') AS giftRedeemedAt,
  EXISTS(SELECT 1 FROM event_rewards WHERE registration_id=r.id AND kind='gift3') AS gift3Issued,
  (SELECT redeemed_at FROM event_rewards WHERE registration_id=r.id AND kind='gift3') AS gift3RedeemedAt,
  e.number AS raffleNumber, e.voided_at AS raffleVoidedAt
  FROM registrations r LEFT JOIN raffle_entries e ON e.registration_id=r.id`;
export async function listUsers(db: D1Database, search: string, page: number) {
  const name = `%${search.replace(/[\\%_]/g, '\\$&')}%`;
  const phone = `%${search.replace(/[-\s]/g, '').replace(/[\\%_]/g, '\\$&')}%`;
  const where = ` WHERE r.name LIKE ? ESCAPE '\\' OR r.phone LIKE ? ESCAPE '\\'`;
  const result = await db.batch([
    db.prepare(userSelect + where + ' ORDER BY r.created_at DESC, r.id LIMIT 25 OFFSET ?').bind(name, phone, (page - 1) * 25),
    db.prepare('SELECT COUNT(*) AS total FROM registrations r' + where).bind(name, phone),
    db.prepare(`SELECT (SELECT COUNT(*) FROM registrations) AS users,
      (SELECT COUNT(*) FROM attendance) AS verifications,
      (SELECT COUNT(*) FROM event_rewards WHERE kind IN ('gift','gift3') AND redeemed_at IS NOT NULL) AS gifts,
      (SELECT COUNT(*) FROM raffle_entries WHERE voided_at IS NULL) AS entries,
      (SELECT COALESCE(MAX(number),0) FROM raffle_entries) AS maxNumber`),
  ]);
  return { users: result[0].results as AdminUser[], total: Number((result[1].results[0] as { total: number }).total), stats: result[2].results[0], page };
}
export async function userDetail(db: D1Database, id: string) {
  const result = await db.batch([
    db.prepare(userSelect + ' WHERE r.id=?').bind(id),
    db.prepare(`SELECT a.slot,a.session_id AS sessionId,s.title,s.room,a.verified_at AS verifiedAt FROM attendance a
      JOIN event_sessions s ON a.session_id=s.id WHERE a.registration_id=? ORDER BY a.slot`).bind(id),
    db.prepare('SELECT id,action,reason,created_at AS createdAt FROM admin_audit WHERE registration_id=? ORDER BY created_at DESC LIMIT 20').bind(id),
  ]);
  if (!result[0].results[0]) throw new AdminError('참가자를 찾을 수 없습니다.', 404);
  return { user: result[0].results[0] as AdminUser, attendance: result[1].results, audit: result[2].results };
}
export async function resetUser(db: D1Database, id: string, actor: string, input: { action: ResetAction; slot?: number }, now = Date.now()) {
  if (!['attendance','session','event-zone','gift','raffle','participation'].includes(input.action)) throw new AdminError('초기화 종류를 확인해주세요.');
  const person = await db.prepare('SELECT name FROM registrations WHERE id=?').bind(id).first<{ name: string }>();
  if (!person) throw new AdminError('참가자를 찾을 수 없습니다.', 404);
  if (input.action === 'session' && (!Number.isInteger(input.slot) || input.slot! < 1 || input.slot! > 5)) throw new AdminError('회차를 확인해주세요.');
  const statements = [db.prepare(`INSERT INTO admin_audit(id,actor,registration_id,action,reason,snapshot,created_at)
    SELECT ?,?,?,?, ?, json_object(
      'attendance',(SELECT json_group_array(json_object('slot',slot,'sessionId',session_id,'verifiedAt',verified_at)) FROM attendance WHERE registration_id=?),
      'eventZone',(SELECT verified_at FROM event_zone_attendance WHERE registration_id=?),
      'rewards',(SELECT json_group_array(json_object('id',id,'kind',kind,'redeemedAt',redeemed_at)) FROM event_rewards WHERE registration_id=?),
      'raffle',(SELECT json_group_array(json_object('number',number,'voidedAt',voided_at)) FROM raffle_entries WHERE registration_id=?)
    ),?`).bind(crypto.randomUUID(),actor,id,input.action+(input.action==='session'?`:${input.slot}`:''),'관리자 직접 초기화',id,id,id,id,now)];
  if (['event-zone','participation'].includes(input.action)) statements.push(db.prepare('DELETE FROM event_zone_attendance WHERE registration_id=?').bind(id));
  if (['attendance','session','participation'].includes(input.action)) {
    statements.push(input.action === 'session'
      ? db.prepare('DELETE FROM attendance WHERE registration_id=? AND slot=?').bind(id,input.slot!)
      : db.prepare('DELETE FROM attendance WHERE registration_id=?').bind(id));
  }
  if (['attendance','session','event-zone','participation'].includes(input.action)) {
    statements.push(db.prepare(`DELETE FROM event_rewards WHERE registration_id=? AND
      ((kind='gift' AND (SELECT COUNT(*) FROM attendance WHERE registration_id=?)<2)
      OR (kind='gift3' AND (SELECT COUNT(*) FROM attendance WHERE registration_id=?)<3)
      OR (kind='ticket' AND ((SELECT COUNT(*) FROM attendance WHERE registration_id=?)<4
        OR NOT EXISTS (SELECT 1 FROM event_zone_attendance WHERE registration_id=?))))`).bind(id,id,id,id,id));
    statements.push(db.prepare(`UPDATE raffle_entries SET voided_at=COALESCE(voided_at,?) WHERE registration_id=?
      AND ((SELECT COUNT(*) FROM attendance WHERE registration_id=?)<4
        OR NOT EXISTS (SELECT 1 FROM event_zone_attendance WHERE registration_id=?))`).bind(now,id,id,id));
  }
  if (input.action === 'gift') statements.push(db.prepare("UPDATE event_rewards SET redeemed_at=NULL WHERE registration_id=? AND kind IN ('gift','gift3')").bind(id));
  if (input.action === 'raffle') statements.push(db.prepare('UPDATE raffle_entries SET voided_at=COALESCE(voided_at,?) WHERE registration_id=?').bind(now,id));
  await db.batch(statements);
  return userDetail(db,id);
}


export type PreRegistrationGift = { phone: string; createdAt: number; redeemedAt: number | null };
export type PreRegistrationGiftList = { recipients: PreRegistrationGift[]; total: number; page: number };

function normalizePhone(value: string) {
  const phone = value.replace(/[-\s]/g, '');
  if (!/^010[0-9]{8}$/.test(phone)) throw new AdminError('010으로 시작하는 휴대전화번호 11자리를 확인해주세요.');
  return phone;
}

export async function hasPreRegistrationGift(db: D1Database, phone: string): Promise<boolean> {
  return Boolean(await db.prepare('SELECT 1 FROM pre_registration_gifts WHERE phone = ?').bind(phone).first());
}

export async function listPreRegistrationGifts(db: D1Database, query = '', page = 1): Promise<PreRegistrationGiftList> {
  if (!Number.isInteger(page) || page < 1 || page > 100000) throw new AdminError('페이지를 확인해주세요.');
  const search = `%${query.replace(/[-\s]/g, '').replace(/[\\%_]/g, '\\$&')}%`;
  const results = await db.batch([
    db.prepare("SELECT phone, created_at AS createdAt, redeemed_at AS redeemedAt FROM pre_registration_gifts WHERE phone LIKE ? ESCAPE '\\' ORDER BY created_at DESC, phone LIMIT 25 OFFSET ?").bind(search, (page - 1) * 25),
    db.prepare("SELECT COUNT(*) AS total FROM pre_registration_gifts WHERE phone LIKE ? ESCAPE '\\'").bind(search),
  ]);
  return { recipients: results[0].results as PreRegistrationGift[], total: (results[1].results[0] as { total: number }).total, page };
}

export async function updatePreRegistrationGift(db: D1Database, phoneInput: string, action: string, now = Date.now()) {
  const phone = normalizePhone(phoneInput);
  if (action === 'add') {
    await db.prepare('INSERT INTO pre_registration_gifts (phone, created_at) VALUES (?, ?) ON CONFLICT(phone) DO NOTHING').bind(phone, now).run();
  } else if (action === 'remove') {
    await db.prepare('DELETE FROM pre_registration_gifts WHERE phone = ? AND redeemed_at IS NULL').bind(phone).run();
    if (await db.prepare('SELECT 1 FROM pre_registration_gifts WHERE phone = ?').bind(phone).first()) throw new AdminError('지급 완료된 대상자는 지급 이력 보존을 위해 삭제할 수 없습니다.', 409);
  } else throw new AdminError('등록 또는 삭제를 선택해주세요.');
  return { phone };
}


export type AdminNfcTag = { id: string; room: string; active: boolean; url: string | null };
export async function listNfcTags(db: D1Database): Promise<AdminNfcTag[]> {
  const [result] = await db.batch([db.prepare('SELECT id, room, active, url, token_hash AS tokenHash FROM nfc_tags ORDER BY room, created_at, id')]);
  return Promise.all((result.results as { id: string; room: string; active: number; url: string | null; tokenHash: string }[]).map(async tag => {
    let url: string | null = null;
    if (tag.active && tag.url) {
      try {
        const parsed = new URL(tag.url);
        const token = new URLSearchParams(parsed.hash.slice(1)).get('checkin');
        const validOrigin = parsed.protocol === 'https:' || (parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname));
        if (validOrigin && !parsed.username && !parsed.password && token && /^[a-f0-9]{64}$/.test(token)) {
          const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
          const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
          if (hash === tag.tokenHash) url = `${parsed.origin}/gift#checkin=${token}`;
        }
      } catch { /* Legacy tags may not have a recoverable original URL. */ }
    }
    return { id: tag.id, room: tag.room, active: Boolean(tag.active), url };
  }));
}
