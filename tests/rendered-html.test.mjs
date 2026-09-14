import assert from 'node:assert/strict';
import test from 'node:test';
import {sessions,filterSessions} from '../app/data.ts';
const {default:worker}=await import('../dist/server/index.js');
const render=path=>worker.fetch(new Request(`http://localhost${path}`,{headers:{accept:'text/html'}}),{ASSETS:{fetch:async()=>new Response('Not found',{status:404})}},{waitUntil(){},passThroughOnException(){}});
for(const [path,content] of [['/','Get started'],['/home','A More Open'],['/program','Main Stage'],['/event','Hello, developers.'],['/mypage','나만의 SDD 2026']]){
 test(`renders ${path} with site metadata and navigation`,async()=>{const response=await render(path);assert.equal(response.status,200);const html=await response.text();assert.ok(html.includes(content));assert.match(html,/<title>SDD 2026/);assert.doesNotMatch(html,/codex-preview|react-loading-skeleton/);if(path!=='/')for(const route of ['home','program','event','mypage'])assert.ok(html.includes(`href="/${route}"`));});
}
test('unknown page returns 404',async()=>assert.equal((await render('/missing')).status,404));
test('every hall and day filter stays chronological and excludes other halls',()=>{for(const day of [21,22,23])for(const hall of ['전체','Main Stage','Room A','Room B']){const result=filterSessions(day,hall,'');assert.ok(result.length>0);assert.ok(result.every(s=>s.day===day&&(hall==='전체'||s.hall===hall)));assert.deepEqual(result.map(s=>s.start),result.map(s=>s.start).sort());}});
test('search combines with date and hall and handles no matches',()=>{assert.deepEqual(filterSessions(21,'Room A','  GALAXY  ').map(s=>s.id),[2]);assert.deepEqual(filterSessions(21,'Room B','박서연'),[]);assert.deepEqual(filterSessions(22,'전체','김민준').map(s=>s.id),[7]);assert.deepEqual(filterSessions(21,'전체','no-matching-session'),[]);assert.equal(new Set(sessions.map(s=>s.id)).size,sessions.length);});
