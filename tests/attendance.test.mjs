import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { attendanceStatus, hashNfcToken, verifyAttendance } from '../db/attendance.ts';
import { redeemGift } from '../db/gifts.ts';
import { login, digest } from '../admin/auth.ts';
import { enterRaffle } from '../db/raffle.ts';
import { listUsers, resetUser, userDetail } from '../db/admin.ts';

// Execute the production SQL against SQLite with the same transactional batch contract as D1.
class SqliteD1 {
  constructor(beforeGift3 = false) {
    this.sql = new DatabaseSync(':memory:');
    this.sql.exec('PRAGMA foreign_keys = ON');
    for (const name of readdirSync(new URL('../drizzle/', import.meta.url)).filter(name => name.endsWith('.sql')).sort()) {
      if (beforeGift3 && name.startsWith('0008_')) continue;
      this.sql.exec(readFileSync(new URL(`../drizzle/${name}`, import.meta.url), 'utf8'));
    }
  }
  prepare(sql) {
    const database = this.sql;
    return {
      sql, values: [],
      bind(...values) { this.values = values; return this; },
      async first() { return database.prepare(sql).get(...this.values) ?? null; },
      async run() { return database.prepare(sql).run(...this.values); },
    };
  }
  async batch(statements) {
    this.sql.exec('BEGIN');
    try {
      const result = statements.map(statement => {
        if (this.failRewards && statement.sql.includes('INSERT INTO event_rewards')) throw new Error('Simulated reward failure');
        return { results: this.sql.prepare(statement.sql).all(...statement.values) };
      });
      this.sql.exec('COMMIT');
      return result;
    } catch (error) { this.sql.exec('ROLLBACK'); throw error; }
  }
}
async function fixture(t, beforeGift3 = false) {
  const db = new SqliteD1(beforeGift3);
  t.after(() => db.sql.close());
  db.sql.exec("INSERT INTO registrations(id,name,phone) VALUES ('p1','테스트','01000000000'),('p2','다른참가자','01000000001')");
  const tokens = {};
  for (const room of ['101', '107']) {
    tokens[room] = (room === '101' ? 'a' : 'b').repeat(64);
    db.sql.prepare('INSERT INTO nfc_tags(id,token_hash,room) VALUES (?,?,?)').run(room, await hashNfcToken(tokens[room]), room);
  }
  const time = slot => db.sql.prepare('SELECT starts_at FROM event_sessions WHERE room = ? AND slot = ?').get('101', slot).starts_at;
  return { db, tokens, time };
}

test('rewards unlock at 2, 3 and 4 slots and stay single after the fifth and retries', async t => {
  const { db, tokens, time } = await fixture(t);
  assert.deepEqual(await attendanceStatus(db, 'p1'), { records: [], rewards: [], raffleEntry: null });
  let ticketId;
  for (let slot = 1; slot <= 5; slot++) {
    const status = await verifyAttendance(db, 'p1', tokens['101'], time(slot));
    assert.equal(status.records.length, slot);
    assert.equal(status.rewards.filter(r => r.kind === 'gift').length, slot >= 2 ? 1 : 0);
    assert.equal(status.rewards.filter(r => r.kind === 'gift3').length, slot >= 3 ? 1 : 0);
    assert.equal(status.rewards.filter(r => r.kind === 'ticket').length, slot >= 4 ? 1 : 0);
    if (slot === 4) ticketId = status.rewards.find(r => r.kind === 'ticket').id;
    const repeated = await verifyAttendance(db, 'p1', tokens['101'], time(slot) + 1);
    assert.deepEqual(status.checkin, { slot, isNew: true });
    assert.deepEqual(repeated.checkin, { slot, isNew: false });
    assert.deepEqual({ ...repeated, checkin: undefined }, { ...status, checkin: undefined });
  }
  const final = await attendanceStatus(db, 'p1');
  assert.equal(final.rewards.find(r => r.kind === 'ticket').id, ticketId);
  assert.equal(final.raffleEntry, null); // Four/five sessions alone must not enter the draw.
  assert.equal(final.rewards.find(r => r.kind === 'gift').redeemedAt, null);
  assert.deepEqual(await attendanceStatus(db, 'p2'), { records: [], rewards: [], raffleEntry: null });
});

test('parallel room attempts permit only one session per slot', async t => {
  const { db, tokens, time } = await fixture(t);
  const results = await Promise.allSettled([
    verifyAttendance(db, 'p1', tokens['101'], time(1)),
    verifyAttendance(db, 'p1', tokens['107'], time(1)),
  ]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(results.filter(r => r.status === 'rejected').length, 1);
  assert.equal((await attendanceStatus(db, 'p1')).records.length, 1);
});

test('invalid, revoked and out-of-window tags cannot grant attendance', async t => {
  const { db, tokens, time } = await fixture(t);
  await assert.rejects(verifyAttendance(db, 'p1', 'c'.repeat(64), time(1)), { status: 404 });
  await assert.rejects(verifyAttendance(db, 'p1', tokens['101'], time(1) - 1), { status: 409 });
  await assert.rejects(verifyAttendance(db, 'p1', tokens['101'], time(1) + 600000), { status: 409 });
  await assert.rejects(verifyAttendance(db, 'p1', tokens['101'], time(1) + 86400000), { status: 409 });
  db.sql.exec("UPDATE nfc_tags SET active=0 WHERE id='101'");
  await assert.rejects(verifyAttendance(db, 'p1', tokens['101'], time(1)), { status: 404 });
  assert.equal((await attendanceStatus(db, 'p1')).records.length, 0);
  const accepted = await verifyAttendance(db, 'p1', tokens['107'], time(1) + 599999);
  assert.equal(accepted.records.length, 1);
});

test('reward errors roll back attendance; a retry grants the reward exactly once', async t => {
  const { db, tokens, time } = await fixture(t);
  await verifyAttendance(db, 'p1', tokens['101'], time(1));
  db.failRewards = true;
  await assert.rejects(verifyAttendance(db, 'p1', tokens['101'], time(2)));
  assert.equal((await attendanceStatus(db, 'p1')).records.length, 1);
  db.failRewards = false;
  const results = await Promise.all([
    verifyAttendance(db, 'p1', tokens['101'], time(2)),
    verifyAttendance(db, 'p1', tokens['101'], time(2)),
  ]);
  assert.equal(results[0].rewards[0].id, results[1].rewards[0].id);
  assert.equal(results[0].records.length, 2);
  assert.equal(results.filter(result => result.checkin.isNew).length, 1);
  assert.ok(results.every(result => result.checkin.slot === 2));
});

test('database constraints reject an invalid slot and a mismatched session', async t => {
  const { db, time } = await fixture(t);
  assert.throws(() => db.sql.prepare('INSERT INTO event_sessions VALUES (?,?,?,?,?,?)').run(999, 6, '101', 'Invalid', time(1), time(1) + 1));
  assert.throws(() => db.sql.prepare('INSERT INTO attendance VALUES (?,?,?,?,?)').run('p1', 2, 10101, '101', time(1)));
  assert.deepEqual(db.sql.prepare('PRAGMA foreign_key_check').all(), []);
});

test('relaxed time policy allows all five chosen slots outside event hours without duplicating rewards', async t => {
  const { db, tokens } = await fixture(t);
  const now = Date.parse('2026-09-27T12:00:00+09:00');
  for (let slot = 1; slot <= 5; slot++) {
    const result = await verifyAttendance(db, 'p1', tokens['101'], now, { enforceTime: false, slot });
    assert.equal(result.records.length, slot);
    assert.equal(result.records.at(-1).sessionId, 10100 + slot);
    const retry = await verifyAttendance(db, 'p1', tokens['101'], now, { enforceTime: false, slot });
    assert.deepEqual(result.checkin, { slot, isNew: true });
    assert.deepEqual(retry.checkin, { slot, isNew: false });
    assert.deepEqual({ ...retry, checkin: undefined }, { ...result, checkin: undefined });
  }
  assert.equal((await attendanceStatus(db, 'p1')).rewards.length, 3);
  await assert.rejects(verifyAttendance(db, 'p1', tokens['107'], now, { enforceTime: false, slot: 1 }), { status: 409 });
  await assert.rejects(verifyAttendance(db, 'p1', tokens['101'], now, { enforceTime: false, slot: 6 }), { status: 400 });
});

test('strict time policy cannot be bypassed with a supplied slot', async t => {
  const { db, tokens, time } = await fixture(t);
  const result = await verifyAttendance(db, 'p1', tokens['101'], time(1), { enforceTime: true, slot: 4 });
  assert.equal(result.records[0].slot, 1);
});


test('gift redemption requires two sessions and the correct staff PIN, and preserves raffle tickets', async t => {
  const { db, tokens, time } = await fixture(t);
  await assert.rejects(redeemGift(db, 'p1', '5555'), { status: 403 });
  await verifyAttendance(db, 'p1', tokens['101'], time(1));
  await assert.rejects(redeemGift(db, 'p1', '5555'), { status: 403 });
  for (let slot=2;slot<=4;slot++) await verifyAttendance(db, 'p1', tokens['101'], time(slot));
  await assert.rejects(redeemGift(db, 'p1', '1234'), { status: 403 });
  assert.equal((await attendanceStatus(db,'p1')).rewards.find(r=>r.kind==='gift').redeemedAt,null);
  const result=await redeemGift(db,'p1','5555',time(5));
  assert.equal(result.alreadyRedeemed,false);
  assert.equal(result.reward.redeemedAt,time(5));
  const repeated=await redeemGift(db,'p1','5555',time(5)+1000);
  assert.equal(repeated.alreadyRedeemed,true);
  assert.equal(repeated.reward.redeemedAt,time(5));
  assert.equal((await attendanceStatus(db,'p1')).rewards.find(r=>r.kind==='ticket').redeemedAt,null);
});

test('parallel gift redemption marks only one request as newly redeemed', async t => {
  const { db, tokens, time } = await fixture(t);
  for (let slot=1;slot<=2;slot++) await verifyAttendance(db,'p1',tokens['101'],time(slot));
  const results=await Promise.all([redeemGift(db,'p1','5555',time(3)),redeemGift(db,'p1','5555',time(3)+1)]);
  assert.equal(results.filter(r=>!r.alreadyRedeemed).length,1);
  assert.equal(results[0].reward.redeemedAt,results[1].reward.redeemedAt);
});

test('wrong gift PINs never lock the participant or persist attempts', async t => {
  const { db, tokens, time } = await fixture(t);
  for (const slot of [1,2]) await verifyAttendance(db, 'p1', tokens['101'], time(slot));
  const now = time(3);
  const before = db.sql.prepare('SELECT total_changes() AS n').get().n;
  await assert.rejects(redeemGift(db, 'p1', '55', now), { status: 400 });
  for (let i=0; i<40; i++) await assert.rejects(redeemGift(db, 'p1', '0000', now), { status: 403 });
  assert.equal(db.sql.prepare('SELECT total_changes() AS n').get().n, before);
  assert.equal((await attendanceStatus(db,'p1')).rewards[0].redeemedAt, null);
  const result = await redeemGift(db, 'p1', '5555', now);
  assert.equal(result.alreadyRedeemed, false);
  assert.equal(result.reward.redeemedAt, now);
  assert.equal(db.sql.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name='gift_pin_attempts'").get().n, 0);
});

test('500 eligible participants can redeem without shared venue IP limits', async t => {
  const { db, time } = await fixture(t);
  const now = time(3);
  const ids = Array.from({ length: 500 }, (_, i) => `guest-${i}`);
  for (const [i, id] of ids.entries()) {
    db.sql.prepare('INSERT INTO registrations(id,name,phone) VALUES (?,?,?)').run(id, `참가자${i}`, `010${String(i).padStart(8,'0')}`);
    for (const slot of [1,2]) db.sql.prepare('INSERT INTO attendance VALUES (?,?,?,?,?)').run(id, slot, 10100 + slot, '101', now);
    db.sql.prepare('INSERT INTO event_rewards(id,registration_id,kind,issued_at) VALUES (?,?,?,?)').run(`gift-${i}`, id, 'gift', now);
  }
  const results = await Promise.all(ids.map(id => redeemGift(db, id, '5555', now)));
  assert.equal(results.filter(result => !result.alreadyRedeemed).length, 500);
  assert.equal(db.sql.prepare('SELECT COUNT(*) AS count FROM event_rewards WHERE redeemed_at IS NOT NULL').get().count, 500);
  const repeated = await redeemGift(db, ids[0], '5555', now + 1);
  assert.equal(repeated.alreadyRedeemed, true);
  assert.equal(repeated.reward.redeemedAt, now);
});

test('raffle requires four sessions and an explicit request; failed and repeated attempts consume no numbers', async t => {
  const { db, tokens, time } = await fixture(t);
  await assert.rejects(enterRaffle(db,'p1',time(1)),{status:403});
  for(let slot=1;slot<=3;slot++) await verifyAttendance(db,'p1',tokens['101'],time(slot));
  await assert.rejects(enterRaffle(db,'p1',time(3)),{status:403});
  await verifyAttendance(db,'p1',tokens['101'],time(4));
  assert.equal((await attendanceStatus(db,'p1')).raffleEntry,null);
  const first=await enterRaffle(db,'p1',time(4));
  assert.equal(first.entry.number,1);
  assert.equal(first.alreadyEntered,false);
  const repeated=await enterRaffle(db,'p1',time(4)+1);
  assert.equal(repeated.alreadyEntered,true);
  assert.deepEqual(repeated.entry,first.entry);
  await verifyAttendance(db,'p1',tokens['101'],time(5));
  assert.deepEqual((await attendanceStatus(db,'p1')).raffleEntry,first.entry);
  for(let slot=1;slot<=4;slot++) await verifyAttendance(db,'p2',tokens['101'],time(slot));
  assert.equal((await enterRaffle(db,'p2',time(5))).entry.number,2);
});

test('concurrent raffle requests produce exactly 1..N with one stable entry per participant', async t => {
  const { db, tokens, time } = await fixture(t);
  const ids=Array.from({length:12},(_,i)=>`draw-${i}`);
  for(const id of ids) {
    db.sql.prepare('INSERT INTO registrations(id,name,phone) VALUES (?,?,?)').run(id,id,'01000000003');
    for(let slot=1;slot<=4;slot++) await verifyAttendance(db,id,tokens['101'],time(slot));
  }
  const attempts=await Promise.all(ids.flatMap(id=>[enterRaffle(db,id,time(5)),enterRaffle(db,id,time(5)+1)]));
  assert.equal(attempts.filter(item=>!item.alreadyEntered).length,ids.length);
  const numbers=db.sql.prepare('SELECT number FROM raffle_entries ORDER BY number').all().map(row=>row.number);
  assert.deepEqual(numbers,ids.map((_,i)=>i+1));
  assert.equal(new Set(attempts.map(item=>item.entry.number)).size,ids.length);
  for(let i=0;i<ids.length;i++) assert.deepEqual(attempts[i*2].entry,attempts[i*2+1].entry);
});


test('admin reset preserves identity and raffle number, removes eligibility, and records the previous state',async t=>{
 const {db,tokens,time}=await fixture(t);
 for(let slot=1;slot<=4;slot++)await verifyAttendance(db,'p1',tokens['101'],time(slot));
 const entry=(await enterRaffle(db,'p1',time(4))).entry;
 await redeemGift(db,'p1','5555',time(4));
 await assert.rejects(resetUser(db,'p1','admin',{action:'unknown'}),{status:400});
 assert.equal((await attendanceStatus(db,'p1')).records.length,4);
 const detail=await resetUser(db,'p1','admin',{action:'participation'},time(5));
 assert.equal(detail.user.attendanceCount,0);
 assert.equal(detail.user.name,'테스트');
 assert.equal(detail.user.giftIssued,0);
 assert.equal(detail.user.raffleNumber,entry.number);
 assert.equal(detail.user.raffleVoidedAt,time(5));
 assert.equal(detail.audit.length,1);
 const snapshot=JSON.parse(db.sql.prepare('SELECT snapshot FROM admin_audit').get().snapshot);
 assert.equal(snapshot.attendance.length,4);
 assert.equal((await attendanceStatus(db,'p1')).raffleEntry,null);
 await assert.rejects(enterRaffle(db,'p1',time(5)),{status:403});
 for(let slot=1;slot<=4;slot++)await verifyAttendance(db,'p1',tokens['101'],time(slot));
 assert.equal((await attendanceStatus(db,'p1')).raffleEntry,null);
 assert.deepEqual((await enterRaffle(db,'p1',time(5))).entry,entry);
 assert.equal((await userDetail(db,'p1')).user.raffleVoidedAt,null);
});

test('admin can reset one session or gift receipt without altering unrelated participant data',async t=>{
 const {db,tokens,time}=await fixture(t);
 for(let slot=1;slot<=5;slot++)await verifyAttendance(db,'p1',tokens['101'],time(slot));
 await enterRaffle(db,'p1',time(5));
 await redeemGift(db,'p1','5555',time(5));
 await resetUser(db,'p1','admin',{action:'gift'},time(5));
 let detail=await userDetail(db,'p1');assert.equal(detail.user.giftRedeemedAt,null);assert.equal(detail.user.attendanceCount,5);
 await resetUser(db,'p1','admin',{action:'session',slot:5},time(5));
 detail=await userDetail(db,'p1');assert.equal(detail.user.attendanceCount,4);assert.equal(detail.user.raffleVoidedAt,null);
 await resetUser(db,'p1','admin',{action:'session',slot:4},time(5));
 detail=await userDetail(db,'p1');assert.equal(detail.user.attendanceCount,3);assert.ok(detail.user.raffleVoidedAt);
 assert.equal((await userDetail(db,'p2')).user.attendanceCount,0);
 const list=await listUsers(db,'010-0000-0000',1);assert.equal(list.total,1);assert.equal(list.users[0].id,'p1');
 assert.equal((await listUsers(db,'%',1)).total,0);
});


test('valid admin logins sharing one IP do not consume limits or get locked out', async t => {
  const db = new SqliteD1();
  t.after(() => db.sql.close());
  const hash = await digest('1111');
  for (let i = 0; i < 40; i++) assert.ok((await login(db, '1111', hash, 'venue')).token);
  assert.equal(db.sql.prepare('SELECT COUNT(*) AS n FROM admin_login_attempts').get().n, 0);
  for (let i = 0; i < 6; i++) {
    assert.equal((await login(db, 'wrong', hash, 'venue')).status, i < 5 ? 401 : 429);
  }
  assert.ok((await login(db, '1111', hash, 'venue')).token);
  assert.equal(db.sql.prepare('SELECT COUNT(*) AS n FROM admin_sessions').get().n, 41);
});

test('admin history uses the participant/date index without a temporary sort', t => {
  const db = new SqliteD1();
  t.after(() => db.sql.close());
  const plan = db.sql.prepare('EXPLAIN QUERY PLAN SELECT id,action,reason,created_at FROM admin_audit WHERE registration_id=? ORDER BY created_at DESC LIMIT 20').all('p1').map(row => row.detail).join(' ');
  assert.match(plan, /USING INDEX admin_audit_registration_created/);
  assert.doesNotMatch(plan, /SCAN admin_audit|TEMP B-TREE/);
});


test('admin raffle and attendance resets run without confirmation fields and retain audit history', async t => {
 const {db,tokens,time}=await fixture(t);
 for(let slot=1;slot<=4;slot++)await verifyAttendance(db,'p1',tokens['101'],time(slot));
 const entry=(await enterRaffle(db,'p1',time(4))).entry;
 let detail=await resetUser(db,'p1','admin',{action:'raffle'},time(4));
 assert.equal(detail.user.raffleNumber,entry.number);
 assert.equal(detail.user.raffleVoidedAt,time(4));
 assert.equal(detail.user.attendanceCount,4);
 detail=await resetUser(db,'p1','admin',{action:'attendance'},time(5));
 assert.equal(detail.user.attendanceCount,0);
 assert.equal(detail.audit.length,2);
 assert.ok(detail.audit.every(item=>item.reason==='관리자 직접 초기화'));
});


test('three-session gift enforces eligibility and PIN, redeems independently and stays single on retries', async t => {
  const { db, tokens, time } = await fixture(t);
  for (let slot=1;slot<=2;slot++) await verifyAttendance(db,'p1',tokens['101'],time(slot));
  await assert.rejects(redeemGift(db,'p1','5555',time(3),'gift3'), {status:403});
  await assert.rejects(redeemGift(db,'p1','5555',time(3),'ticket'), {status:400});
  await verifyAttendance(db,'p1',tokens['101'],time(3));
  await assert.rejects(redeemGift(db,'p1','1234',time(3),'gift3'), {status:403});
  const results = await Promise.all([
    redeemGift(db,'p1','5555',time(3),'gift3'),
    redeemGift(db,'p1','5555',time(3)+1,'gift3'),
  ]);
  assert.equal(results.filter(r=>!r.alreadyRedeemed).length,1);
  assert.equal(results[0].reward.redeemedAt,results[1].reward.redeemedAt);
  assert.equal(results[0].reward.kind,'gift3');
  assert.equal((await attendanceStatus(db,'p1')).rewards.find(r=>r.kind==='gift').redeemedAt,null);
  const original = await redeemGift(db,'p1','5555',time(4));
  assert.equal(original.reward.kind,'gift');
  assert.equal((await attendanceStatus(db,'p1')).rewards.find(r=>r.kind==='gift3').redeemedAt,time(3));
  assert.equal((await listUsers(db,'',1)).stats.gifts,2);
  await resetUser(db,'p1','admin',{action:'gift'},time(4));
  const detail = await userDetail(db,'p1');
  assert.equal(detail.user.giftRedeemedAt,null);
  assert.equal(detail.user.gift3RedeemedAt,null);
  assert.equal(detail.user.gift3Issued,1);
  assert.equal(detail.user.attendanceCount,3);
});

test('dropping below three sessions removes only the extra gift and records it in the audit', async t => {
  const { db, tokens, time } = await fixture(t);
  for (let slot=1;slot<=3;slot++) await verifyAttendance(db,'p1',tokens['101'],time(slot));
  await redeemGift(db,'p1','5555',time(3));
  await redeemGift(db,'p1','5555',time(3),'gift3');
  const detail = await resetUser(db,'p1','admin',{action:'session',slot:3},time(4));
  assert.equal(detail.user.giftIssued,1);
  assert.equal(detail.user.giftRedeemedAt,time(3));
  assert.equal(detail.user.gift3Issued,0);
  assert.equal(detail.user.gift3RedeemedAt,null);
  await assert.rejects(redeemGift(db,'p1','5555',time(4),'gift3'), {status:403});
  const snapshot=JSON.parse(db.sql.prepare('SELECT snapshot FROM admin_audit').get().snapshot);
  assert.equal(snapshot.rewards.find(r=>r.kind==='gift3').redeemedAt,time(3));
  await verifyAttendance(db,'p1',tokens['101'],time(3));
  assert.equal((await attendanceStatus(db,'p1')).rewards.find(r=>r.kind==='gift3').redeemedAt,null);
});

test('gift3 migration preserves prior gifts and raffle entries while backfilling only eligible attendees', async t => {
  const { db, time } = await fixture(t, true);
  for (const [id,count] of [['p1',4],['p2',2]]) {
    for (let slot=1;slot<=count;slot++) db.sql.prepare('INSERT INTO attendance VALUES (?,?,?,?,?)').run(id,slot,10100+slot,'101',time(slot));
  }
  db.sql.prepare('INSERT INTO event_rewards VALUES (?,?,?,?,?)').run('old-gift','p1','gift',time(2),time(3));
  db.sql.prepare('INSERT INTO event_rewards VALUES (?,?,?,?,?)').run('old-ticket','p1','ticket',time(4),null);
  db.sql.prepare('INSERT INTO raffle_entries(registration_id,issued_at) VALUES (?,?)').run('p1',time(4));
  const oldRewards = db.sql.prepare('SELECT * FROM event_rewards ORDER BY id').all();
  const oldEntries = db.sql.prepare('SELECT * FROM raffle_entries').all();
  db.sql.exec('BEGIN');
  db.sql.exec(readFileSync(new URL('../drizzle/0008_freezing_yellow_claw.sql', import.meta.url),'utf8'));
  db.sql.exec('COMMIT');
  assert.deepEqual(db.sql.prepare("SELECT * FROM event_rewards WHERE kind!='gift3' ORDER BY id").all(),oldRewards);
  assert.deepEqual(db.sql.prepare('SELECT * FROM raffle_entries').all(),oldEntries);
  const extra = db.sql.prepare("SELECT * FROM event_rewards WHERE kind='gift3'").all();
  assert.equal(extra.length,1);
  assert.equal(extra[0].registration_id,'p1');
  assert.equal(extra[0].redeemed_at,null);
  assert.equal((await redeemGift(db,'p1','5555',time(5),'gift3')).reward.redeemedAt,time(5));
  assert.deepEqual(db.sql.prepare('PRAGMA foreign_key_check').all(),[]);
});
