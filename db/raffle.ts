export type RaffleEntry = { number: number; issuedAt: number };

export class RaffleEntryError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}

export async function enterRaffle(db: D1Database, registrationId: string, now = Date.now()) {
  // Eligibility and absence of an entry are checked inside the INSERT transaction.
  // Do not use INSERT OR IGNORE: duplicate attempts must not consume sequence values.
  const results = await db.batch([
    db.prepare(`INSERT INTO raffle_entries (registration_id, issued_at)
      SELECT ?, ? WHERE (SELECT COUNT(*) FROM attendance WHERE registration_id = ?) >= 4
      AND NOT EXISTS (SELECT 1 FROM raffle_entries WHERE registration_id = ?)
      RETURNING number`).bind(registrationId, now, registrationId, registrationId),
    db.prepare(`UPDATE raffle_entries SET voided_at = NULL WHERE registration_id = ? AND voided_at IS NOT NULL
      AND (SELECT COUNT(*) FROM attendance WHERE registration_id = ?) >= 4 RETURNING number`).bind(registrationId, registrationId),
    db.prepare('SELECT number, issued_at AS issuedAt FROM raffle_entries WHERE registration_id = ? AND voided_at IS NULL').bind(registrationId),
  ]);
  const entry = results[2].results[0] as RaffleEntry | undefined;
  if (!entry) throw new RaffleEntryError('세션을 4개 이상 인증해야 럭키드로우에 응모할 수 있습니다.', 403);
  return { entry, alreadyEntered: results[0].results.length === 0 && results[1].results.length === 0 };
}
