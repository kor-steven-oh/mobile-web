import { timingSafeEqual } from 'node:crypto';
import type { EventReward } from './attendance';

export class GiftRedemptionError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}

export async function giftPinHash(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function redeemGift(db: D1Database, registrationId: string, pin: string, configuredHash: string | undefined, ip: string, now = Date.now()) {
  if (!/^[0-9]{4}$/.test(pin)) throw new GiftRedemptionError('STAFF 인증번호 4자리를 입력해주세요.', 400);
  const gift = await db.prepare(`SELECT id, kind, issued_at AS issuedAt, redeemed_at AS redeemedAt FROM event_rewards
    WHERE registration_id = ? AND kind = 'gift'
    AND (SELECT COUNT(*) FROM attendance WHERE registration_id = ?) >= 2`)
    .bind(registrationId, registrationId).first<EventReward>();
  if (!gift) throw new GiftRedemptionError('세션을 2개 이상 인증해야 참여선물을 받을 수 있습니다.', 403);
  if (gift.redeemedAt !== null) return { reward: gift, alreadyRedeemed: true };
  if (!configuredHash || !/^[a-f0-9]{64}$/.test(configuredHash)) throw new GiftRedemptionError('STAFF 인증번호가 아직 설정되지 않았습니다. 운영자에게 문의해주세요.', 503);

  // Shared, persistent counters prevent retries or parallel requests bypassing the limit.
  const limits = [{ key: `participant:${registrationId}`, max: 5 }, { key: `ip:${await giftPinHash(ip)}`, max: 30 }];
  const attempts = await db.batch<{ attempts: number }>(limits.map(limit => db.prepare(`
    INSERT INTO gift_pin_attempts (key, attempts, window_started_at) VALUES (?, 1, ?)
    ON CONFLICT(key) DO UPDATE SET
      attempts = CASE WHEN window_started_at <= ? THEN 1 ELSE attempts + 1 END,
      window_started_at = CASE WHEN window_started_at <= ? THEN excluded.window_started_at ELSE window_started_at END
    RETURNING attempts
  `).bind(limit.key, now, now - 15 * 60 * 1000, now - 15 * 60 * 1000)));
  if (attempts.some((result, index) => Number(result.results[0]?.attempts) > limits[index].max)) {
    throw new GiftRedemptionError('인증 시도 횟수를 초과했습니다. 15분 후 다시 시도해주세요.', 429);
  }
  const suppliedHash = await giftPinHash(pin);
  if (!timingSafeEqual(new TextEncoder().encode(suppliedHash), new TextEncoder().encode(configuredHash))) {
    throw new GiftRedemptionError('STAFF 인증번호가 일치하지 않습니다.', 403);
  }
  const results = await db.batch([
    db.prepare(`UPDATE event_rewards SET redeemed_at = ?
      WHERE registration_id = ? AND kind = 'gift' AND redeemed_at IS NULL RETURNING id`)
      .bind(now, registrationId),
    db.prepare(`SELECT id, kind, issued_at AS issuedAt, redeemed_at AS redeemedAt FROM event_rewards
      WHERE registration_id = ? AND kind = 'gift'`).bind(registrationId),
  ]);
  return { reward: results[1].results[0] as EventReward, alreadyRedeemed: results[0].results.length === 0 };
}
