import assert from 'node:assert/strict';
import test from 'node:test';
import {sessions,halls,hallLocations,filterSessions,nextSavedSession} from '../app/data.ts';
const {default:worker}=await import('../dist/server/index.js');
const render=path=>worker.fetch(new Request(`http://localhost${path}`,{headers:{accept:'text/html'}}),{ASSETS:{fetch:async()=>new Response('Not found',{status:404})}},{waitUntil(){},passThroughOnException(){}});
for(const [path,content] of [['/','로그인하고 시작하기'],['/home','MY NEXT SESSION'],['/program','101 AP'],['/event','나의 수강 인증'],['/mypage','저장한 세션']]){
 test(`renders ${path} with site metadata and navigation`,async()=>{const response=await render(path);assert.equal(response.status,200);const html=await response.text();assert.ok(html.includes(content));assert.match(html,/<title>SDD 2026/);assert.doesNotMatch(html,/codex-preview|react-loading-skeleton/);if(path!=='/')for(const route of ['home','program','event','mypage'])assert.ok(html.includes(`href="/${route}"`));});
}
test('unknown page returns 404',async()=>assert.equal((await render('/missing')).status,404));
test('admin route renders its own screen without participant navigation',async()=>{
 const response=await render('/admin');
 assert.equal(response.status,200);
 const html=await response.text();
 assert.match(html,/class="admin-app"/);
 assert.match(html,/관리자 세션 확인 중/);
 assert.match(html,/<title>SDD 2026 · 관리자<\/title>/);
 assert.doesNotMatch(html,/class="bottom-nav"/);
});
test('registration rejects incomplete phone numbers and cross-origin submissions',async()=>{
 const invalid=await worker.fetch(new Request('http://localhost/api/registration',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:'테스트',phone:'0101234567'})}),{},{});
 assert.equal(invalid.status,400);
 const foreign=await worker.fetch(new Request('http://localhost/api/registration',{method:'POST',headers:{origin:'https://example.com','content-type':'application/json'},body:JSON.stringify({name:'테스트',phone:'01012345678'})}),{},{});
 assert.equal(foreign.status,403);
});
test('session details identify the building, floor and room',()=>{
 assert.deepEqual(halls.map(hall=>hallLocations[hall]),[
  'The UniverSE 1층 · 101호 (AP)',
  'The UniverSE 1층 · 107호 (CP)',
  'The UniverSE 2층 · 201호 (LSI)',
  'The UniverSE 2층 · 206호 (Sensor)',
  'The UniverSE 2층 · 208호 (직속)',
 ]);
});
test('five rooms each contain five chronological sessions',()=>{
 assert.deepEqual(halls,['101 AP','107 CP','201 LSI','206 Sensor','208 직속']);
 assert.equal(sessions.length,25);
 assert.equal(new Set(sessions.map(s=>s.id)).size,25);
 for(const hall of halls){
  const result=filterSessions(hall,'');
  assert.equal(result.length,5);
  assert.ok(result.every(s=>s.hall===hall));
  assert.deepEqual(result.map(s=>s.start),result.map(s=>s.start).sort());
  assert.deepEqual(result.map(s=>[s.start,s.end]),[['10:00','10:40'],['11:00','11:40'],['13:30','14:10'],['14:30','15:10'],['15:30','16:10']]);
  assert.ok(result.every((s,i)=>s.end>s.start&&(i===0||result[i-1].end<=s.start)));
 }
});
test('room search handles title, speaker, whitespace and no results',()=>{
 assert.deepEqual(filterSessions('107 CP','  EXYNOS  ').map(s=>s.id),[10701]);
 assert.deepEqual(filterSessions('201 LSI','김학송').map(s=>s.id),[20101]);
 assert.deepEqual(filterSessions('101 AP','엄준기').map(s=>s.id),[10101]);
 assert.deepEqual(filterSessions('101 AP','no-matching-session'),[]);
});
test('program offers five room buttons instead of date controls',async()=>{
 const html=await (await render('/program')).text();
 for(const hall of halls)assert.ok(html.includes(`aria-label="${hall}"`));
 assert.equal((html.match(/class="session-row"/g)||[]).length,25);
 assert.equal((html.match(/class="hall-panel"/g)||[]).length,5);
 assert.equal((html.match(/ inert=""/g)||[]).length,4);
 assert.match(html,/좌우로 밀어 다른 강연장을/);
 assert.match(html,/<h3>협상의 기술<\/h3><span class="session-presenter"><strong>엄준기 PL<\/strong><span>Custom SOC개발팀<\/span><\/span>/);
 assert.doesNotMatch(html,/class="session-type"|>강연<\/span>/);
 assert.doesNotMatch(html,/날짜 선택|day-selector|Main Stage|Room A|Room B/);
});

test('next saved session uses start time instead of bookmark order',()=>{
 const before=Date.parse('2026-10-15T09:00:00+09:00');
 assert.equal(nextSavedSession([10103,10102,10101],before)?.id,10101);
 assert.equal(nextSavedSession([10103,10102],Date.parse('2026-10-15T11:00:00+09:00'))?.id,10102);
 assert.equal(nextSavedSession([10103,10102],Date.parse('2026-10-15T11:00:01+09:00'))?.id,10103);
});
test('next session handles empty, expired, unknown and simultaneous bookmarks',()=>{
 const before=Date.parse('2026-10-15T09:00:00+09:00');
 assert.equal(nextSavedSession([],before),undefined);
 assert.equal(nextSavedSession([999],before),undefined);
 assert.equal(nextSavedSession([10101,10102],Date.parse('2026-10-15T12:00:00+09:00')),undefined);
 assert.equal(nextSavedSession([10701,10101],before)?.id,10101);
});

test('event page explains attendance thresholds and renders five slots',async()=>{
 const html=await (await render('/event')).text();
 assert.match(html,/나의 수강 인증/);
 assert.match(html,/2개 이상 인증/);
 assert.match(html,/4개 이상 인증/);
 assert.match(html,/럭키드로우 응모권/);
 assert.equal((html.match(/class="stamp-circle"/g)||[]).length,5);
 assert.doesNotMatch(html,/SDD26-/);
 assert.doesNotMatch(html,/attendance-slot|attendance-test-controls|선택한 회차 인증/);
});
test('attendance endpoints require a session and reject foreign origins',async()=>{
 const get=await worker.fetch(new Request('http://localhost/api/attendance'),{},{});
 assert.equal(get.status,401);
 const post=await worker.fetch(new Request('http://localhost/api/attendance',{method:'POST',headers:{origin:'http://localhost','content-type':'application/json'},body:JSON.stringify({token:'a'.repeat(64)})}),{},{});
 assert.equal(post.status,401);
 const foreign=await worker.fetch(new Request('http://localhost/api/attendance',{method:'POST',headers:{origin:'https://example.com'}}),{},{});
 assert.equal(foreign.status,403);
});

test('gift redemption requires login and same-origin requests',async()=>{
 const url='http://localhost/api/gift-redemption';
 const anon=await worker.fetch(new Request(url,{method:'POST',headers:{origin:'http://localhost','content-type':'application/json'},body:JSON.stringify({pin:'5555'})}),{},{});
 assert.equal(anon.status,401);
 const foreign=await worker.fetch(new Request(url,{method:'POST',headers:{origin:'https://example.com'}}),{},{});
 assert.equal(foreign.status,403);
 const html=await (await render('/event')).text();
 assert.match(html,/2개 인증 후 수령 가능/);
 assert.doesNotMatch(html,/5555/);
});

test('raffle entry is protected and shown as an explicit application button',async()=>{
 const url='http://localhost/api/raffle-entry';
 const anon=await worker.fetch(new Request(url,{method:'POST',headers:{origin:'http://localhost'}}),{},{});
 assert.equal(anon.status,401);
 const foreign=await worker.fetch(new Request(url,{method:'POST',headers:{origin:'https://example.com'}}),{},{});
 assert.equal(foreign.status,403);
 const html=await (await render('/event')).text();
 assert.match(html,/응모하기/);
 assert.doesNotMatch(html,/자동 발급돼요|SDD26-/);
});


test('registration stops reading oversized streaming bodies before consuming the entire request', async () => {
 let chunks = 0;
 const body = new ReadableStream({
  pull(controller) { chunks++; controller.enqueue(new Uint8Array(600)); if (chunks === 100) controller.close(); },
 });
 const response = await worker.fetch(new Request('http://localhost/api/registration', { method: 'POST', body, duplex: 'half' }), {}, {});
 assert.equal(response.status, 413);
 // The router may prefetch a few chunks through its cloned request stream.
 assert.ok(chunks < 10);
});

test('registration body limit counts UTF-8 bytes instead of characters', async () => {
 const body = JSON.stringify({ name: '가'.repeat(400), phone: '01012345678' });
 assert.ok(body.length < 1024);
 const response = await worker.fetch(new Request('http://localhost/api/registration', { method: 'POST', body }), {}, {});
 assert.equal(response.status, 413);
});
