import assert from 'node:assert/strict';
import test from 'node:test';
import {sessions,halls,filterSessions,nextSavedSession} from '../app/data.ts';
const {default:worker}=await import('../dist/server/index.js');
const render=path=>worker.fetch(new Request(`http://localhost${path}`,{headers:{accept:'text/html'}}),{ASSETS:{fetch:async()=>new Response('Not found',{status:404})}},{waitUntil(){},passThroughOnException(){}});
for(const [path,content] of [['/','Get Started'],['/home','MY NEXT SESSION'],['/program','101 AP'],['/event','Hello, developers.'],['/mypage','나만의 SDD 2026']]){
 test(`renders ${path} with site metadata and navigation`,async()=>{const response=await render(path);assert.equal(response.status,200);const html=await response.text();assert.ok(html.includes(content));assert.match(html,/<title>SDD 2026/);assert.doesNotMatch(html,/codex-preview|react-loading-skeleton/);if(path!=='/')for(const route of ['home','program','event','mypage'])assert.ok(html.includes(`href="/${route}"`));});
}
test('unknown page returns 404',async()=>assert.equal((await render('/missing')).status,404));
test('five rooms each contain five chronological sessions',()=>{
 assert.deepEqual(halls,['101 AP','102 CP','201 LSI','206 Sensor','208 직속']);
 assert.equal(sessions.length,25);
 assert.equal(new Set(sessions.map(s=>s.id)).size,25);
 for(const hall of halls){
  const result=filterSessions(hall,'');
  assert.equal(result.length,5);
  assert.ok(result.every(s=>s.hall===hall));
  assert.deepEqual(result.map(s=>s.start),result.map(s=>s.start).sort());
  assert.ok(result.every((s,i)=>s.end>s.start&&(i===0||result[i-1].end<=s.start)));
 }
});
test('room search handles title, speaker, whitespace and no results',()=>{
 assert.deepEqual(filterSessions('102 CP','  GALAXY  ').map(s=>s.id),[2]);
 assert.deepEqual(filterSessions('201 LSI','박서연'),[]);
 assert.deepEqual(filterSessions('101 AP','김민준').map(s=>s.id),[1,7]);
 assert.deepEqual(filterSessions('101 AP','no-matching-session'),[]);
});
test('program offers five room buttons instead of date controls',async()=>{
 const html=await (await render('/program')).text();
 for(const hall of halls)assert.ok(html.includes(`aria-label="${hall}"`));
 assert.equal((html.match(/class="session-row"/g)||[]).length,5);
 assert.doesNotMatch(html,/날짜 선택|day-selector|Main Stage|Room A|Room B/);
});

test('next saved session uses start time instead of bookmark order',()=>{
 const before=Date.parse('2026-10-15T09:00:00+09:00');
 assert.equal(nextSavedSession([12,7,4],before)?.id,4);
 assert.equal(nextSavedSession([12,4],Date.parse('2026-10-15T11:00:00+09:00'))?.id,4);
 assert.equal(nextSavedSession([12,4],Date.parse('2026-10-15T11:00:01+09:00'))?.id,12);
});
test('next session handles empty, expired, unknown and simultaneous bookmarks',()=>{
 const before=Date.parse('2026-10-15T09:00:00+09:00');
 assert.equal(nextSavedSession([],before),undefined);
 assert.equal(nextSavedSession([999],before),undefined);
 assert.equal(nextSavedSession([1,4],Date.parse('2026-10-15T12:00:00+09:00')),undefined);
 assert.equal(nextSavedSession([2,1],before)?.id,1);
});
