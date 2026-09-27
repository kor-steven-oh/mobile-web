import type { EventReward } from './attendance';

export class GiftRedemptionError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}

export async function redeemGift(db: D1Database, registrationId: string, pin: string, now = Date.now()) {
  if (!/^[0-9]{4}$/.test(pin)) throw new GiftRedemptionError('STAFF 인증번호 4자리를 입력해주세요.', 400);
  const gift = await db.prepare(`SELECT id, kind, issued_at AS issuedAt, redeemed_at AS redeemedAt FROM event_rewards
    WHERE registration_id = ? AND kind = 'gift'
    AND (SELECT COUNT(*) FROM attendance WHERE registration_id = ?) >= 2`)
    .bind(registrationId, registrationId).first<EventReward>();
  if (!gift) throw new GiftRedemptionError('세션을 2개 이상 인증해야 참여선물을 받을 수 있습니다.', 403);
  if (gift.redeemedAt !== null) return { reward: gift, alreadyRedeemed: true };
  if (pin !== '5555') throw new GiftRedemptionError('STAFF 인증번호가 일치하지 않습니다.', 403);
  const results = await db.batch([
    db.prepare(`UPDATE event_rewards SET redeemed_at = ?
      WHERE registration_id = ? AND kind = 'gift' AND redeemed_at IS NULL RETURNING id`)
      .bind(now, registrationId),
    db.prepare(`SELECT id, kind, issued_at AS issuedAt, redeemed_at AS redeemedAt FROM event_rewards
      WHERE registration_id = ? AND kind = 'gift'`).bind(registrationId),
  ]);
  return { reward: results[1].results[0] as EventReward, alreadyRedeemed: results[0].results.length === 0 };
}
