import type { EventReward } from './attendance';

const STAFF_PIN = '5555';

export class GiftRedemptionError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}

export async function redeemGift(db: D1Database, registrationId: string, pin: string, now = Date.now(), kind: 'gift' | 'gift3' = 'gift') {
  if (kind !== 'gift' && kind !== 'gift3') throw new GiftRedemptionError('선물 종류를 확인해주세요.', 400);
  const threshold = kind === 'gift3' ? 3 : 2;
  if (!/^[0-9]{4}$/.test(pin)) throw new GiftRedemptionError('STAFF 인증번호 4자리를 입력해주세요.', 400);
  const gift = await db.prepare(`SELECT id, kind, issued_at AS issuedAt, redeemed_at AS redeemedAt FROM event_rewards
    WHERE registration_id = ? AND kind = ?
    AND (SELECT COUNT(*) FROM attendance WHERE registration_id = ?) >= ?`)
    .bind(registrationId, kind, registrationId, threshold).first<EventReward>();
  if (!gift) throw new GiftRedemptionError(`세션을 ${threshold}개 이상 인증해야 참여선물을 받을 수 있습니다.`, 403);
  if (gift.redeemedAt !== null) return { reward: gift, alreadyRedeemed: true };
  if (pin !== STAFF_PIN) throw new GiftRedemptionError('STAFF 인증번호가 일치하지 않습니다.', 403);
  const results = await db.batch([
    db.prepare(`UPDATE event_rewards SET redeemed_at = ?
      WHERE registration_id = ? AND kind = ? AND redeemed_at IS NULL
      AND (SELECT COUNT(*) FROM attendance WHERE registration_id = ?) >= ? RETURNING id`)
      .bind(now, registrationId, kind, registrationId, threshold),
    db.prepare(`SELECT id, kind, issued_at AS issuedAt, redeemed_at AS redeemedAt FROM event_rewards
      WHERE registration_id = ? AND kind = ?`).bind(registrationId, kind),
  ]);
  const reward = results[1].results[0] as EventReward | undefined;
  if (!reward || reward.redeemedAt === null) throw new GiftRedemptionError('선물 수령 자격이 변경되었습니다. 인증 현황을 다시 확인해주세요.', 403);
  return { reward, alreadyRedeemed: results[0].results.length === 0 };
}


export type PreRegistrationGiftStatus = { eligible: boolean; redeemedAt: number | null };

function preGiftQuery(db: D1Database, registrationId: string) {
  return db.prepare(`SELECT g.redeemed_at AS redeemedAt FROM pre_registration_gifts g
    JOIN registrations r ON r.phone = g.phone WHERE r.id = ?`).bind(registrationId);
}

export async function preRegistrationGiftStatus(db: D1Database, registrationId: string): Promise<PreRegistrationGiftStatus> {
  const gift = await preGiftQuery(db, registrationId).first<{ redeemedAt: number | null }>();
  return { eligible: Boolean(gift), redeemedAt: gift?.redeemedAt ?? null };
}

export async function redeemPreRegistrationGift(db: D1Database, registrationId: string, pin: string, now = Date.now()) {
  if (!/^[0-9]{4}$/.test(pin)) throw new GiftRedemptionError('STAFF 인증번호 4자리를 입력해주세요.', 400);
  const gift = await preRegistrationGiftStatus(db, registrationId);
  if (!gift.eligible) throw new GiftRedemptionError('사전등록 선물 지급 대상자가 아닙니다.', 403);
  if (gift.redeemedAt !== null) return { ...gift, alreadyRedeemed: true };
  if (pin !== STAFF_PIN) throw new GiftRedemptionError('STAFF 인증번호가 일치하지 않습니다.', 403);
  // One receipt per registered phone, even if multiple attendee accounts share it.
  const results = await db.batch([
    db.prepare(`UPDATE pre_registration_gifts SET redeemed_at = ?
      WHERE phone = (SELECT phone FROM registrations WHERE id = ?) AND redeemed_at IS NULL
      RETURNING redeemed_at`).bind(now, registrationId),
    preGiftQuery(db, registrationId),
  ]);
  const receipt = results[1].results[0] as { redeemedAt: number | null } | undefined;
  if (!receipt || receipt.redeemedAt === null) throw new GiftRedemptionError('선물 지급 대상이 변경되었습니다. Home에서 다시 확인해주세요.', 403);
  return { eligible: true, redeemedAt: receipt.redeemedAt, alreadyRedeemed: results[0].results.length === 0 };
}
