import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { attendanceStatus, hashNfcToken, verifyAttendance } from '../db/attendance.ts';
import { giftPinHash, redeemGift } from '../db/gifts.ts';
import { enterRaffle } from '../db/raffle.ts';
import { listUsers, resetUser, userDetail } from '../db/admin.ts';

// Execute the production SQL against SQLite with the same transactional batch contract as D1.
class SqliteD1 {
  constructor() {
    this.sql = new DatabaseSync(':memory:');
    this.sql.exec('PRAGMA foreign_keys = ON');
    for (const name of readdirSync(new URL('../drizzle/', import.meta.url)).filter(name => name.endsWith('.sql')).sort()) {
      this.sql.exec(readFileSync(new URL(`../drizzle/${name}`, import.meta.url), 'utf8'));
    }
  }
  prepare(sql) {
    const database = this.sql;
    return {
      sql, values: [],
      bind(...values) { this.values = values; return this; },
      async first() { return database.prepare(sql).get(...this.values) ?? null; },
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
async function fixture(t) {
  const db = new SqliteD1();
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

test('rewards unlock at 2 and 4 slots and stay single after the fifth and retries', async t => {
  const { db, tokens, time } = await fixture(t);
  assert.deepEqual(await attendanceStatus(db, 'p1'), { records: [], rewards: [], raffleEntry: null });
  let ticketId;
  for (let slot = 1; slot <= 5; slot++) {
    const status = await verifyAttendance(db, 'p1', tokens['101'], time(slot));
    assert.equal(status.records.length, slot);
    assert.equal(status.rewards.filter(r => r.kind === 'gift').length, slot >= 2 ? 1 : 0);
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
  assert.equal((await attendanceStatus(db, 'p1')).rewards.length, 2);
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
  const hash = await giftPinHash('5555');
  await assert.rejects(redeemGift(db, 'p1', '5555', hash, 'test-ip'), { status: 403 });
  await verifyAttendance(db, 'p1', tokens['101'], time(1));
  await assert.rejects(redeemGift(db, 'p1', '5555', hash, 'test-ip'), { status: 403 });
  for (let slot=2;slot<=4;slot++) await verifyAttendance(db, 'p1', tokens['101'], time(slot));
  await assert.rejects(redeemGift(db, 'p1', '1234', hash, 'test-ip'), { status: 403 });
  assert.equal((await attendanceStatus(db,'p1')).rewards.find(r=>r.kind==='gift').redeemedAt,null);
  const result=await redeemGift(db,'p1','5555',hash,'test-ip',time(5));
  assert.equal(result.alreadyRedeemed,false);
  assert.equal(result.reward.redeemedAt,time(5));
  const repeated=await redeemGift(db,'p1','5555',hash,'test-ip',time(5)+1000);
  assert.equal(repeated.alreadyRedeemed,true);
  assert.equal(repeated.reward.redeemedAt,time(5));
  assert.equal((await attendanceStatus(db,'p1')).rewards.find(r=>r.kind==='ticket').redeemedAt,null);
});

test('parallel gift redemption marks only one request as newly redeemed', async t => {
  const { db, tokens, time } = await fixture(t);
  for (let slot=1;slot<=2;slot++) await verifyAttendance(db,'p1',tokens['101'],time(slot));
  const hash=await giftPinHash('5555');
  const results=await Promise.all([redeemGift(db,'p1','5555',hash,'ip',time(3)),redeemGift(db,'p1','5555',hash,'ip',time(3)+1)]);
  assert.equal(results.filter(r=>!r.alreadyRedeemed).length,1);
  assert.equal(results[0].reward.redeemedAt,results[1].reward.redeemedAt);
});

test('gift PIN attempts are limited persistently and recover after 15 minutes', async t => {
  const { db, tokens, time } = await fixture(t);
  for(let slot=1;slot<=2;slot++) await verifyAttendance(db,'p1',tokens['101'],time(slot));
  const hash=await giftPinHash('5555');
  const now=time(3);
  await assert.rejects(redeemGift(db,'p1','5555',undefined,'ip',now),{status:503});
  await assert.rejects(redeemGift(db,'p1','55',hash,'ip',now),{status:400});
  for(let i=0;i<5;i++) await assert.rejects(redeemGift(db,'p1','0000',hash,'ip',now),{status:403});
  await assert.rejects(redeemGift(db,'p1','5555',hash,'ip',now+1),{status:429});
  assert.equal((await attendanceStatus(db,'p1')).rewards[0].redeemedAt,null);
  assert.equal((await redeemGift(db,'p1','5555',hash,'ip',now+15*60*1000)).alreadyRedeemed,false);
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
 await redeemGift(db,'p1','5555',await giftPinHash('5555'),'ip',time(4));
 await assert.rejects(resetUser(db,'p1','admin',{action:'participation',reason:'테스트',confirmName:'틀린이름'}),{status:400});
 assert.equal((await attendanceStatus(db,'p1')).records.length,4);
 const detail=await resetUser(db,'p1','admin',{action:'participation',reason:'참가자 요청',confirmName:'테스트'},time(5));
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
 await redeemGift(db,'p1','5555',await giftPinHash('5555'),'ip',time(5));
 await resetUser(db,'p1','admin',{action:'gift',reason:'오입력 정정',confirmName:'테스트'},time(5));
 let detail=await userDetail(db,'p1');assert.equal(detail.user.giftRedeemedAt,null);assert.equal(detail.user.attendanceCount,5);
 await resetUser(db,'p1','admin',{action:'session',slot:5,reason:'잘못된 인증',confirmName:'테스트'},time(5));
 detail=await userDetail(db,'p1');assert.equal(detail.user.attendanceCount,4);assert.equal(detail.user.raffleVoidedAt,null);
 await resetUser(db,'p1','admin',{action:'session',slot:4,reason:'잘못된 인증',confirmName:'테스트'},time(5));
 detail=await userDetail(db,'p1');assert.equal(detail.user.attendanceCount,3);assert.ok(detail.user.raffleVoidedAt);
 assert.equal((await userDetail(db,'p2')).user.attendanceCount,0);
 const list=await listUsers(db,'010-0000-0000',1);assert.equal(list.total,1);assert.equal(list.users[0].id,'p1');
 assert.equal((await listUsers(db,'%',1)).total,0);
});
