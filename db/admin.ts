export type AdminUser = { id: string; name: string; phone: string; createdAt: string; attendanceCount: number; giftIssued: number; giftRedeemedAt: number | null; gift3Issued: number; gift3RedeemedAt: number | null; raffleNumber: number | null; raffleVoidedAt: number | null };
export type ResetAction = 'attendance' | 'session' | 'gift' | 'raffle' | 'participation';
export class AdminError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}
const userSelect = `SELECT r.id, r.name, r.phone, r.created_at AS createdAt,
  (SELECT COUNT(*) FROM attendance WHERE registration_id=r.id) AS attendanceCount,
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
  if (!['attendance','session','gift','raffle','participation'].includes(input.action)) throw new AdminError('초기화 종류를 확인해주세요.');
  const person = await db.prepare('SELECT name FROM registrations WHERE id=?').bind(id).first<{ name: string }>();
  if (!person) throw new AdminError('참가자를 찾을 수 없습니다.', 404);
  if (input.action === 'session' && (!Number.isInteger(input.slot) || input.slot! < 1 || input.slot! > 5)) throw new AdminError('회차를 확인해주세요.');
  const statements = [db.prepare(`INSERT INTO admin_audit(id,actor,registration_id,action,reason,snapshot,created_at)
    SELECT ?,?,?,?, ?, json_object(
      'attendance',(SELECT json_group_array(json_object('slot',slot,'sessionId',session_id,'verifiedAt',verified_at)) FROM attendance WHERE registration_id=?),
      'rewards',(SELECT json_group_array(json_object('id',id,'kind',kind,'redeemedAt',redeemed_at)) FROM event_rewards WHERE registration_id=?),
      'raffle',(SELECT json_group_array(json_object('number',number,'voidedAt',voided_at)) FROM raffle_entries WHERE registration_id=?)
    ),?`).bind(crypto.randomUUID(),actor,id,input.action+(input.action==='session'?`:${input.slot}`:''),'관리자 직접 초기화',id,id,id,now)];
  if (['attendance','session','participation'].includes(input.action)) {
    statements.push(input.action === 'session'
      ? db.prepare('DELETE FROM attendance WHERE registration_id=? AND slot=?').bind(id,input.slot!)
      : db.prepare('DELETE FROM attendance WHERE registration_id=?').bind(id));
    statements.push(db.prepare(`DELETE FROM event_rewards WHERE registration_id=? AND
      ((kind='gift' AND (SELECT COUNT(*) FROM attendance WHERE registration_id=?)<2)
      OR (kind='gift3' AND (SELECT COUNT(*) FROM attendance WHERE registration_id=?)<3)
      OR (kind='ticket' AND (SELECT COUNT(*) FROM attendance WHERE registration_id=?)<4))`).bind(id,id,id,id));
    statements.push(db.prepare(`UPDATE raffle_entries SET voided_at=COALESCE(voided_at,?) WHERE registration_id=?
      AND (SELECT COUNT(*) FROM attendance WHERE registration_id=?)<4`).bind(now,id,id));
  }
  if (input.action === 'gift') statements.push(db.prepare("UPDATE event_rewards SET redeemed_at=NULL WHERE registration_id=? AND kind IN ('gift','gift3')").bind(id));
  if (input.action === 'raffle') statements.push(db.prepare('UPDATE raffle_entries SET voided_at=COALESCE(voided_at,?) WHERE registration_id=?').bind(now,id));
  await db.batch(statements);
  return userDetail(db,id);
}
