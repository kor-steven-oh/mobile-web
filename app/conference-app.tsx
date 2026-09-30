'use client';
import Link from 'next/link';
import Image from 'next/image';
import {useRouter} from 'next/navigation';
import {useState,useEffect,useRef,type ReactNode} from 'react';
import {ArrowUpRight,ArrowRight,ArrowLeft,Bookmark,CalendarDays,Check,ChevronRight,Clock3,House,MapPin,Search,Sparkles,Gift,UserRound,UsersRound,X} from 'lucide-react';
import {sessions,halls,hallLocations,filterSessions,nextSavedSession,type Session} from './data';
import RegistrationForm from './registration-form';
import {loadParticipant,saveParticipant,PROFILE_KEY,SESSION_EXPIRED} from './participant-session';
import HallPager from './hall-pager';
import EventAttendance from './event-attendance';
import EventZone from './event-zone';
import {captureNfcLink,pendingNfcToken} from './nfc-pending';
const nav=[{id:'home',label:'Home',Icon:House},{id:'program',label:'Program',Icon:CalendarDays},{id:'gift',label:'Gift',Icon:Gift},{id:'event',label:'Event',Icon:Sparkles},{id:'mypage',label:'My page',Icon:UserRound}];
function readPreferences(profile:{id:string;name:string;phone:string}){
 try{
  const key=`sdd2026-preferences:${profile.id}`;
  const cached=JSON.parse(localStorage.getItem('sdd2026-profile')||'null');
  const previousKey=`sdd2026-preferences:${profile.phone}`;
  const previous=cached?.name===profile.name&&cached?.phone===profile.phone?localStorage.getItem(previousKey):null;
  const legacy=localStorage.getItem('sdd2026-preferences');
  const value=JSON.parse(localStorage.getItem(key)||previous||legacy||'{}');
  if(previous){localStorage.setItem(key,JSON.stringify(value));localStorage.removeItem(previousKey);}
  if(legacy)localStorage.removeItem('sdd2026-preferences');
  return {
   sessions:Array.isArray(value.sessions)?value.sessions.filter((id:unknown)=>sessions.some(s=>s.id===id)):[] as number[],
  };
 }catch{return {sessions:[] as number[]};}
}
function Cube({className='',label}:{className?:string;label?:string}){return <span aria-hidden={label?undefined:true} className={`cube jelly ${className}`}><span className="jelly-surface"/>{label&&<span className="cube-label">{label}</span>}</span>;}
function Badge({kind}:{kind:string}){return <div aria-hidden="true" className={`object-badge jelly ${kind}`}><span className="jelly-surface"/></div>;}
function SectionTitle({children,href}:{children:ReactNode;href?:string}){return <div className="section-title"><h2>{children}</h2>{href&&<Link href={href}>View all<ArrowUpRight size={15}/></Link>}</div>;}
function Modal({title,children,onClose}:{title:string;children:ReactNode;onClose:()=>void}){const ref=useRef<HTMLDialogElement>(null);useEffect(()=>{const d=ref.current;d?.showModal();return()=>d?.close();},[]);return <dialog aria-label={title} ref={ref} className="modal" onCancel={onClose} onClick={e=>{if(e.target===e.currentTarget)onClose();}}><div className="modal-heading"><span className="eyebrow">SDD 2026</span><button className="icon-button" onClick={onClose} aria-label="닫기"><X/></button></div><h2>{title}</h2>{children}</dialog>;}
export default function ConferenceApp({page}:{page:string}){
 const router=useRouter();
 const [profile,setProfile]=useState<{id:string;name:string;phone:string}|null>(null),[authStatus,setAuthStatus]=useState<'checking'|'authenticated'|'anonymous'|'error'>('checking'),[registrationOpen,setRegistrationOpen]=useState(false);
 const [saved,setSaved]=useState<number[]>([]),[ready,setReady]=useState(false);
 const [hall,setHall]=useState<string>(halls[0]),[search,setSearch]=useState(''),[searchOpen,setSearchOpen]=useState(false);
 const [now,setNow]=useState<number|null>(null);
 const [selected,setSelected]=useState<Session|null>(null),[locationOpen,setLocationOpen]=useState(false);
 useEffect(()=>{
  let active=true;
  const legacyNfcLink=page==='event'&&new URLSearchParams(window.location.hash.slice(1)).has('checkin');
  captureNfcLink();
  if(legacyNfcLink&&pendingNfcToken()){router.replace(`/gift${window.location.hash}`);return;}
  loadParticipant()
   .then(current=>{
    if(!active)return;
    if(current){const prefs=readPreferences(current);setSaved(prefs.sessions);setReady(true);setProfile(current);setAuthStatus('authenticated');if(page==='start')router.replace(pendingNfcToken()?`/gift${window.location.hash}`:'/home');}
    else{setProfile(null);setAuthStatus('anonymous');saveParticipant(null);if(page!=='start')router.replace('/');}
   })
   .catch(()=>{if(active)setAuthStatus('error');});
  return()=>{active=false;};
 },[page,router]);
 useEffect(()=>{
  const expired=()=>{setProfile(null);setReady(false);setSaved([]);setAuthStatus('anonymous');setRegistrationOpen(true);router.replace('/');};
  const changed=(event:StorageEvent)=>{if(event.key===PROFILE_KEY||event.key===null)window.location.reload();};
  window.addEventListener(SESSION_EXPIRED,expired);
  window.addEventListener('storage',changed);
  return()=>{window.removeEventListener(SESSION_EXPIRED,expired);window.removeEventListener('storage',changed);};
 },[router]);
 const login=async(name:string,phone:string)=>{
  const response=await fetch('/api/registration',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({name,phone})});
  const data=await response.json() as {profile?:{id:string;name:string;phone:string};error?:string};
  if(!response.ok||!data.profile)throw new Error(data.error||'로그인하지 못했어요. 다시 시도해주세요.');
  const prefs=readPreferences(data.profile);setSaved(prefs.sessions);setReady(true);setProfile(data.profile);setAuthStatus('authenticated');setRegistrationOpen(false);
  saveParticipant(data.profile);
  router.push(pendingNfcToken()?`/gift${window.location.hash}`:'/home');
 };
 const logout=async()=>{
  try{
   const response=await fetch('/api/registration',{method:'DELETE',credentials:'same-origin'});
   if(!response.ok)throw new Error();
   saveParticipant(null);
   setReady(false);setSaved([]);setProfile(null);setAuthStatus('anonymous');router.replace('/');
  }catch{setAuthStatus('error');}
 };

 useEffect(()=>{if(ready&&profile){try{localStorage.setItem(`sdd2026-preferences:${profile.id}`,JSON.stringify({sessions:saved}));}catch{}}},[saved,ready,profile]);
 useEffect(()=>{
  if(page!=='home')return;
  const refresh=()=>setNow(Date.now());
  refresh();
  const timer=window.setInterval(refresh,30000);
  window.addEventListener('focus',refresh);
  document.addEventListener('visibilitychange',refresh);
  return()=>{window.clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);};
 },[page]);
 const nextSession=now===null?undefined:nextSavedSession(saved,now);
 const cardLoading=!ready||now===null;
 const nextCardContent=<><span className="eyebrow">MY NEXT SESSION</span><h2>{cardLoading?'내 세션을 확인하고 있어요':nextSession?nextSession.title:saved.length?'예정된 세션이 없어요':'나의 첫 세션을 저장해보세요'}</h2><p>{cardLoading?'잠시만 기다려주세요.':nextSession?`${nextSession.speaker} · ${nextSession.role}`:saved.length?'저장한 세션이 모두 시작되었어요.':'관심 있는 세션을 저장하면 여기에 보여드려요.'}</p><span className="keynote-time">{cardLoading?'':nextSession?`10월 ${nextSession.day}일 · ${nextSession.start} · ${nextSession.hall}`:'프로그램 둘러보기'}</span><div className="orb"/><Cube/>{!cardLoading&&<span className="round-arrow"><ArrowUpRight size={24}/></span>}</>;
 const toggleSave=(id:number)=>setSaved(v=>v.includes(id)?v.filter(x=>x!==id):[...v,id]);
 const sessionRow=(s:Session,showDate=false)=><article className="session-row" key={s.id}><div className="session-time">{showDate&&<b>10/{s.day}</b>}<span>{s.start}</span><span>{s.end}</span></div><span className={`timeline-dot ${s.color}`}/><button className="session-info" onClick={()=>setSelected(s)}><h3>{s.title}</h3><span className="session-presenter"><strong>{s.speaker}</strong><span>{s.role}</span></span>{showDate&&<span className="session-location"><MapPin size={12}/>{s.hall}</span>}</button><button className={`save-button ${saved.includes(s.id)?'saved':''}`} onClick={()=>toggleSave(s.id)} aria-label={`${s.title} ${saved.includes(s.id)?'저장 취소':'저장'}`} aria-pressed={saved.includes(s.id)}><Bookmark size={19}/></button></article>;
 return <div className={`site-shell ${page==='start'?'is-start':''}`}><aside className="desktop-brand"><Link href="/" className="wordmark">SDD <span>2026</span></Link><div className="desktop-message"><span className="eyebrow">S.LSI DEVELOPER DAY</span><h2>Ideas meet.<br/>Possibilities<br/><em>begin.</em></h2><p>같은 호기심으로 연결되어,<br/>함께 만드는 더 밝은 내일.</p><div className="desktop-art"><Cube/><Badge kind="connect"/></div></div><span className="desktop-foot">DEVELOP TOGETHER. BUILD TOMORROW.</span></aside>
 <div className="app-surface">{page==='start'?<main className="start-page"><header className="start-header"><span>SAMSUNG<br/>DEVELOPER DAY</span><span>DEVELOP<br/>CONNECT<br/>BUILD<br/>TOGETHER</span></header><div className="start-top-art"><Badge kind="code"/><Cube className="floating-one"/><span className="dotted-line"/></div><div className="start-main"><div className="start-logo-space"><div className="start-logo" role="img" aria-label="SDD 2026"><div className="start-symbol" aria-hidden="true"><img src="/sdd-original.png" alt="" width={772} height={768} fetchPriority="high" /></div><div className="start-year" aria-hidden="true"><span>2</span><span>0</span><span>2</span><span>6</span></div></div></div><h1>Developers<br/>Make a Brighter<br/>Tomorrow</h1></div><div className="start-bottom-art"><Badge kind="build"/><Badge kind="connect"/><Cube className="floating-two"/><span className="start-orbit" aria-hidden="true"/><div className="start-date"><span>2026. 10. 15 · 10:00</span><span>The UniverSE</span></div></div><button type="button" className="primary-button black" onClick={()=>profile?router.push('/home'):setRegistrationOpen(true)} disabled={authStatus==='checking'}>로그인하고 시작하기<ArrowRight size={22}/></button><footer className="start-footer"><span>IDEAS<br/>PEOPLE<br/>OPEN SOURCE<br/>A BRIGHTER TOMORROW <b>—</b></span></footer></main>:<>
 <header className="app-header">{page==='home'?<Link href="/home" className="wordmark">SDD <span>2026</span></Link>:<h1>{page==='program'?'Program':page==='gift'?'Gift':page==='event'?'Event':page==='speakers'?'Speakers':'My page'}</h1>}{page==='program'?<button className="icon-button" aria-label="세션 검색" onClick={()=>setSearchOpen(v=>!v)}><Search size={24}/></button>:profile&&<p className="home-greeting">{profile.name}님 반갑습니다 :)</p>}</header>
 <main className={`page-content ${page}`}>
 {page==='home'&&<><section className="home-hero"><h1>More<br/>Developers<br/><span>Together.</span></h1><Cube label="BUILD"/><p className="home-subtitle">Come Together. Share Build Connect</p></section><div className="event-date"><span className="event-date-item"><CalendarDays size={17}/>10월 15일 · 오전 10시</span><span className="event-date-item"><MapPin size={17}/>The UniverSE</span></div>{cardLoading?<div className="keynote-card next-session-card" aria-busy="true">{nextCardContent}</div>:nextSession?<button className="keynote-card next-session-card" onClick={()=>setSelected(nextSession)} aria-label={`${nextSession.title} 세션 상세보기`}>{nextCardContent}</button>:<Link href="/program" className="keynote-card next-session-card">{nextCardContent}</Link>}<div className="quick-links"><Link href="/program"><CalendarDays/><span>Program</span></Link><Link href="/speakers"><UsersRound/><span>Speakers</span></Link><button onClick={()=>setLocationOpen(true)}><MapPin/><span>Location</span></button><Link href="/gift"><Gift/><span>Gift</span></Link></div><SectionTitle href="/event">Event Zone</SectionTitle><Link href="/event" className="featured-card"><div className="mini-pattern"><i/><i/><i/><i/></div><div><span className="eyebrow">PLAY & CONNECT</span><h3>이벤트존에서 즐겨주세요</h3><p>현장에서 즐기는 다양한 이벤트</p></div><ChevronRight size={21}/></Link><SectionTitle>Lunch Concert</SectionTitle><figure className="lunch-concert-card"><div className="lunch-concert-photo"><Image src="/concert.webp" alt="Lunch Concert 출연진 단체 사진" width={1926} height={822} unoptimized/></div><figcaption><span className="eyebrow">MUSIC & CONNECTION</span><h3>음악과 함께하는 점심시간</h3><p>잠시 쉬어가며 즐기는 Lunch Concert</p><div className="lunch-concert-time"><Clock3 size={16} aria-hidden="true"/><span>12:00–13:00</span></div></figcaption></figure><p className="sample-note">강연 일정은 2026년 10월 15일 기준입니다.</p></>}
 {page==='program'&&<>{searchOpen&&<div className="search-field"><Search size={19}/><input autoFocus aria-label="세션명 또는 연사 검색" placeholder="세션명 또는 연사 검색" value={search} onChange={e=>setSearch(e.target.value)}/>{search&&<button aria-label="검색어 지우기" onClick={()=>setSearch('')}><X size={17}/></button>}</div>}<div className="room-selector" aria-label="강연장 선택">{halls.map(h=><button key={h} onClick={()=>setHall(h)} className={hall===h?'active':''} aria-label={h} aria-pressed={hall===h}><b>{h.split(' ')[0]}</b><span>{h.split(' ')[1]}</span></button>)}</div><p className="swipe-hint">좌우로 밀어 다른 강연장을 둘러보세요 <span aria-hidden="true">↔</span></p><span className="sr-only" role="status">현재 강연장 {hall}</span><HallPager hall={hall} onHallChange={setHall}>{room=>{const shown=filterSessions(room,search);return <><div className="schedule-heading"><span>{room}<b>{shown.length} sessions</b></span><span><Clock3 size={12}/> KST</span></div><div className="session-list">{shown.map(s=>sessionRow(s))}</div>{shown.length===0&&<div className="empty-state"><Search/><h3>검색된 세션이 없어요</h3><p>다른 검색어 또는 강연장을 선택해주세요.</p><button onClick={()=>setSearch('')}>필터 초기화</button></div>}</>;}}</HallPager><p className="sample-note">2026년 10월 15일 강연 프로그램</p></>}
 {page==='speakers'&&<><Link href="/home" className="speakers-back"><ArrowLeft size={16}/> Home</Link><div className="speakers-heading"><h2>강연자 소개</h2><span>총 {sessions.length}명 · 가나다순</span></div><ul className="speakers-list">{[...sessions].sort((a,b)=>a.speaker.localeCompare(b.speaker,'ko')).map(s=><li key={s.id}><button className="speaker-card" onClick={()=>setSelected(s)} aria-label={`${s.speaker} · ${s.title} 세션 상세보기`}><span className="speaker-card-avatar" aria-hidden="true"><UserRound size={23}/></span><span className="speaker-card-info"><strong>{s.speaker}</strong><span className="speaker-card-department">{s.role}</span><span className="speaker-card-title">{s.title}</span></span><ChevronRight size={18} aria-hidden="true"/></button></li>)}</ul></>}
 {page==='gift'&&<EventAttendance participantId={authStatus==='authenticated'?profile?.id:undefined}/>}
 {page==='event'&&<EventZone/>}
 {page==='mypage'&&<><section className="profile-summary" aria-label="내 프로필"><span className="profile-summary-eyebrow">HELLO, DEVELOPER</span><div className="profile-summary-icon" aria-hidden="true"><UserRound size={24}/></div><div><h2>{profile?`${profile.name}님`:'내 프로필'}</h2>{profile&&<p>{profile.phone.slice(0,3)}-{profile.phone.slice(3,7)}-{profile.phone.slice(7)}</p>}</div><p className="profile-summary-message">관심 있는 세션을 한곳에 모아보세요</p></section><div className="saved-sessions-heading"><h2>저장한 세션</h2><span>{saved.length}개</span></div>{saved.length?<div className="session-list">{sessions.filter(s=>saved.includes(s.id)).sort((a,b)=>a.day-b.day||a.start.localeCompare(b.start)).map(s=>sessionRow(s,true))}</div>:<div className="empty-state"><Bookmark/><h3>어떤 이야기가 궁금하세요?</h3><p>관심 있는 세션의 북마크를 눌러<br/>나만의 프로그램을 만들어보세요.</p><Link href="/program">프로그램 둘러보기 <ArrowRight size={17}/></Link></div>}<div className="local-info"><Check size={15}/><p>저장한 세션은 이 브라우저에 보관됩니다.</p></div><button className="back-start" onClick={()=>void logout()}><ArrowLeft size={16}/> 로그아웃</button></>}
 </main><nav className="bottom-nav" aria-label="메인 메뉴">{nav.map(({id,label,Icon})=><Link key={id} href={`/${id}`} className={page===id?'active':''} aria-current={page===id?'page':undefined}><Icon size={23} strokeWidth={1.7}/><span>{label}</span>{page===id&&<i/>}</Link>)}</nav></>}
 </div><aside className="desktop-caption"><span>2026</span><p>MORE DEVELOPERS.<br/>MORE POSSIBILITIES.</p><div className="caption-line"/><span className="vertical-text">The UniverSE · OCTOBER 15</span></aside>
 {registrationOpen&&<Modal title="SDD 2026 로그인" onClose={()=>setRegistrationOpen(false)}><RegistrationForm onSubmit={login}/></Modal>}
 {page!=='start'&&authStatus!=='authenticated'&&<div className="auth-overlay"><p>{authStatus==='error'?'로그인 상태를 확인하지 못했어요.':'로그인 확인 중...'}</p>{authStatus==='error'&&<button onClick={()=>window.location.reload()}>다시 시도</button>}</div>}
 {selected&&<Modal title={selected.title} onClose={()=>setSelected(null)}>{selected.description&&<p className="detail-description">{selected.description}</p>}<div className="detail-meta"><p><CalendarDays size={18}/>2026. 10. {selected.day}</p><p><Clock3 size={18}/>{selected.start}–{selected.end} (KST)</p><p><MapPin size={18}/>{hallLocations[selected.hall]}</p></div><div className="speaker"><div className="speaker-avatar"><UserRound/></div><div><b>{selected.speaker}</b><p>{selected.role}</p></div></div><button className="primary-button" onClick={()=>toggleSave(selected.id)}>{saved.includes(selected.id)?'저장한 세션':'세션 저장하기'}{saved.includes(selected.id)?<Check size={20}/>:<Bookmark size={20}/>}</button></Modal>}
 {locationOpen&&<Modal title="Location" onClose={()=>setLocationOpen(false)}><p className="detail-description">개발자의 아이디어가 더 밝은 내일로 이어지는 곳. S.LSI Developer Day에 오신 것을 환영합니다.</p><div className="detail-meta"><p><CalendarDays size={18}/>2026. 10. 15 · 오전 10시 시작</p><p><MapPin size={18}/>The UniverSE</p></div><section className="shuttle-info" aria-labelledby="shuttle-title"><h3 id="shuttle-title">셔틀버스 배차 안내</h3><ul className="shuttle-routes"><li><span>행사장으로</span><p>DSR C타워 <ArrowRight size={16} aria-label="출발, 도착"/> The UniverSE</p></li><li><span>DSR로</span><p>The UniverSE <ArrowRight size={16} aria-label="출발, 도착"/> DSR</p></li></ul><p className="shuttle-schedule"><Clock3 size={16} aria-hidden="true"/>배차 시간표는 추후 안내됩니다.</p></section><button className="primary-button" onClick={()=>setLocationOpen(false)}>확인<Check size={20}/></button></Modal>}
 </div>;
}
