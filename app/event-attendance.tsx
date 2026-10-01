'use client';

import { participantFetch } from './participant-session';

import { useCallback, useEffect, useState } from 'react';
import { Check, Gift, Nfc, RefreshCw, Ticket } from 'lucide-react';
import { sessions } from './data';
import GiftRedemption from './gift-redemption';
import RaffleEntryCard from './raffle-entry';
import { attendancePolicy } from './attendance-policy';
import { currentLocation } from './current-location';
import { captureNfcLink, clearPendingNfc, pendingNfcSlot, pendingNfcToken } from './nfc-pending';
import AttendanceCelebration from './attendance-celebration';
import type { AttendanceCheckinResult, AttendanceStatus } from '../db/attendance';

const slots = sessions.filter(session => session.hall === '101 AP');

export default function EventAttendance({ participantId }: { participantId?: string }) {
  const [celebration, setCelebration] = useState<{ participantId: string; slot: number | null; count: number; title: string } | null>(null);
  const dismissCelebration = useCallback(() => setCelebration(null), []);
  const [status, setStatus] = useState<AttendanceStatus | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  const [checkingLocation, setCheckingLocation] = useState(false);
  const [retryCheckin, setRetryCheckin] = useState(false);
  const [refresh, setRefresh] = useState<{ revision: number; celebrateFor?: string }>({ revision: 0 });
  const [locationNote, setLocationNote] = useState('');

  useEffect(() => {
    const onHash = () => { captureNfcLink(); setRefresh(value => ({ revision: value.revision + 1 })); };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (!participantId) return;
    const controller = new AbortController();
    let active = true;
    async function load() {
      setBusy(true); setError(''); setMessage(''); setCelebration(null);
      captureNfcLink();
      const token = pendingNfcToken();
      const slot = pendingNfcSlot();
      setRetryCheckin(Boolean(token));
      try {
        if (token) {
          try {
          setRetryCheckin(true); setCheckingLocation(true); setLocationNote('위치를 확인하고 있어요.');
          const locationRequest = currentLocation(controller.signal).then(location => {
            if (active) { setCheckingLocation(false); setLocationNote('위치 조회 완료' + (attendancePolicy.enforceLocation ? '' : ' · 현재는 인증 조건에 반영하지 않습니다.')); }
            return location;
          }, cause => {
            if (active) { setCheckingLocation(false); setLocationNote(attendancePolicy.enforceLocation ? '위치 확인이 필요합니다.' : '위치를 확인하지 못했지만 인증은 진행됩니다.'); }
            if (attendancePolicy.enforceLocation) throw cause;
            return undefined;
          });
          // With location checks paused, permission prompts and timeouts never delay attendance.
          const location = attendancePolicy.enforceLocation ? await locationRequest : undefined;
          if (!active) return;
          const response = await participantFetch('/api/attendance', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin', signal: controller.signal, body: JSON.stringify({ token, location, slot }),
          });
          if (response.status === 401) return;
          const result = await response.json() as AttendanceCheckinResult & { error?: string };
          if (!active) return;
          if (response.ok) {
            clearPendingNfc(); setRetryCheckin(false); setStatus(result);
            setMessage(result.checkin?.slot === null ? (result.checkin.isNew ? '이벤트존 참여 인증이 완료되었습니다.' : '이미 이벤트존 참여를 인증했습니다.') : result.checkin?.isNew ? '수강 인증이 완료되었습니다.' : '이미 인증한 세션입니다. 인증 내역은 그대로 유지됩니다.');
            const record = result.records.find(item => item.slot === result.checkin?.slot);
            if (result.checkin?.slot === null && result.eventZoneVerifiedAt !== null && participantId) {
              setCelebration({ participantId, slot: null, count: result.records.length, title: '이벤트존 참여를 인증했어요.' });
            } else if (record && participantId) {
              setCelebration({ participantId, slot: record.slot, count: result.records.length, title: record.title });
            }
            return;
          }
          if ([400, 404, 409].includes(response.status)) { clearPendingNfc(); setRetryCheckin(false); }
          setError(result.error || '인증하지 못했습니다. 다시 시도해주세요.');
          } catch (cause) {
            if (!active) return;
            setError(cause instanceof Error ? cause.message : '현재 위치를 확인하지 못했습니다.');
          }
        }
        const response = await participantFetch('/api/attendance', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
        const result = await response.json() as AttendanceStatus & { error?: string };
        if (!response.ok) throw new Error(result.error || '인증 현황을 불러오지 못했습니다.');
        if (active) {
          setStatus(result);
          // Only the in-page refresh button replays an existing certification.
          // Failed NFC attempts must not show a success animation from this fallback GET.
          if (!token && participantId && refresh.celebrateFor === participantId) {
            const record = result.records.length ? result.records.reduce((latest, item) => item.verifiedAt > latest.verifiedAt ? item : latest) : undefined;
            if (result.eventZoneVerifiedAt != null && (!record || result.eventZoneVerifiedAt >= record.verifiedAt)) {
              setCelebration({ participantId, slot: null, count: result.records.length, title: '이벤트존 참여를 인증했어요.' });
            } else if (record) {
              setCelebration({ participantId, slot: record.slot, count: result.records.length, title: record.title });
            }
          }
        }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : '다시 시도해주세요.');
      } finally { if (active) setBusy(false); }
    }
    void load();
    return () => { active = false; controller.abort(); };
  }, [participantId, refresh]);

  const count = status?.records.length;
  const eventZoneVerified = status?.eventZoneVerifiedAt != null;
  const raffleEligible = (count ?? 0) >= 4 && eventZoneVerified;
  const raffleEntry = status?.raffleEntry ?? null;
  return (
    <section className="attendance-event" aria-labelledby="attendance-title">
      {celebration?.participantId === participantId && celebration && <AttendanceCelebration kind={celebration.slot === null ? 'event-zone' : 'session'} count={celebration.count} eventZoneVerified={eventZoneVerified} title={celebration.title} onDismiss={dismissCelebration}/>}
      <div className="attendance-heading"><span className="eyebrow">LEARN & WIN</span><Nfc size={26} aria-hidden="true" /></div>
      <h2 id="attendance-title">배움이 쌓이면, <span>행운도 함께.</span></h2>
      <p className="attendance-intro">강연장 입구에서 NFC 태깅으로 수강을 인증하세요.<br/>2개·3개 인증마다 참여선물!<br/>강의 세션 4개 및 이벤트존 참여하면 럭키드로우!</p>
      <div className="attendance-progress">
        <div className="attendance-progress-heading"><h3>나의 수강 인증</h3><span><b>{count ?? '–'}</b> / 5</span></div>
        <p>시간대별 1개씩, 최대 5개 인증</p>
        <ol className="attendance-stamps" aria-label="시간대별 인증 현황">
          {slots.map((session, index) => {
            const record = status?.records.find(item => item.slot === index + 1);
            const lecture = record ? sessions.find(item => item.id === record.sessionId) : undefined;
            return <li key={session.id} className={[record ? 'verified' : '', celebration?.participantId === participantId && celebration?.slot === index + 1 ? 'just-verified' : ''].filter(Boolean).join(' ')}>
              <span className="stamp-circle" aria-label={`${index + 1}회차 ${record ? '인증 완료' : status ? '미인증' : '확인 중'}`}>{record ? <Check size={22}/> : index + 1}</span>
              <div className="attendance-session-summary">
                <div className="attendance-session-meta"><span>{session.start}–{session.end}</span><span className="attendance-session-status">{record ? '인증 완료' : status ? '미인증' : '확인 중'}</span></div>
                <h4>{record ? record.title : status ? '아직 인증한 강연이 없어요' : '인증 정보를 불러오고 있어요'}</h4>
                {record ? <p className="attendance-session-presenter" title={`${record.room}호${lecture ? ` · ${lecture.speaker} · ${lecture.role}` : ''}`}>{record.room}호{lecture && <> · {lecture.speaker} · {lecture.role}</>}</p> : <p>이 시간대의 강연을 수강하고 인증해주세요.</p>}
              </div>
            </li>;
          })}
        </ol>
        <button className="attendance-refresh" disabled={busy} onClick={() => setRefresh(value => ({ revision: value.revision + 1, celebrateFor: participantId }))}><RefreshCw size={15}/>{busy ? (checkingLocation && attendancePolicy.enforceLocation ? '행사장 위치 확인 중…' : '인증 현황 확인 중…') : retryCheckin ? '인증 다시 시도' : '인증 현황 새로고침'}</button>
        {locationNote && <p className="attendance-location-note" role="status">{locationNote}</p>}
        {message && <p className="attendance-success" role="status">{message}</p>}
        {error && <p className="registration-error" role="alert">{error}</p>}
      </div>
      <div className="attendance-progress event-zone-progress">
        <div className="attendance-progress-heading"><h3>이벤트존 참여 인증</h3><span><b>{status ? eventZoneVerified ? 1 : 0 : '–'}</b> / 1</span></div>
        <p>이벤트존에 참여한 뒤 현장의 NFC 태그로 인증해주세요.</p>
        <ol className="attendance-stamps" aria-label="이벤트존 참여 인증 현황">
          <li className={[eventZoneVerified ? 'verified' : '', celebration?.participantId === participantId && celebration?.slot === null ? 'just-verified' : ''].filter(Boolean).join(' ')}>
            <span className="stamp-circle" aria-label={eventZoneVerified ? '이벤트존 인증 완료' : status ? '이벤트존 미인증' : '확인 중'}>{eventZoneVerified ? <Check size={22}/> : <Nfc size={22}/>}</span>
            <div className="attendance-session-summary">
              <div className="attendance-session-meta"><span>EVENT ZONE</span><span className="attendance-session-status">{eventZoneVerified ? '인증 완료' : status ? '미인증' : '확인 중'}</span></div>
              <h4>{eventZoneVerified ? '이벤트존 참여를 인증했어요' : '이벤트존에서 즐기고 인증해주세요'}</h4>
              <p>{eventZoneVerified ? '강의 세션 4개도 인증하면 럭키드로우에 응모할 수 있어요.' : '이벤트존 NFC 태깅 시 참여 인증이 완료됩니다.'}</p>
            </div>
          </li>
        </ol>
      </div>
      {([2, 3] as const).map(threshold => {
        const gift = status?.rewards.find(reward => reward.kind === (threshold === 2 ? 'gift' : 'gift3'));
        const title = threshold === 2 ? '참여선물' : '추가 참여선물';
        return <div key={threshold} className={`attendance-reward ${gift ? 'unlocked' : ''}`}>
          <div className="reward-icon"><Gift size={25}/></div>
          <div><span className="reward-threshold">{threshold}개 이상 인증</span><h3>{title}</h3><p>{gift ? gift.redeemedAt ? `${title} 수령 완료` : '이 화면을 STAFF에게 제출하세요.' : count === undefined ? '인증 현황을 확인하고 있어요.' : `${Math.max(0, threshold - count)}개 더 인증하면 받을 수 있어요.`}</p></div>
          {gift && <Check className="reward-check" size={20}/>}
          <GiftRedemption threshold={threshold} gift={gift} onRedeemed={reward => setStatus(current => current ? { ...current, rewards: current.rewards.map(item => item.id === reward.id ? reward : item) } : current)}/>
        </div>;
      })}
      <div className={`attendance-reward lucky-reward ${raffleEligible ? 'unlocked' : ''}`}>
        <div className="reward-icon"><Ticket size={25}/></div>
        <div><span className="reward-threshold">강의 세션 4개 + 이벤트존 참여 인증</span><h3>럭키드로우 응모권</h3><p>{raffleEntry ? '응모권 발급 완료! 추첨 현장 안내를 확인해주세요.' : raffleEligible ? '응모하기를 누르고 나만의 번호를 받으세요.' : count === undefined ? '인증 현황을 확인하고 있어요.' : count < 4 ? `강의 세션 ${4 - count}개${eventZoneVerified ? '를' : '와 이벤트존 참여를'} 더 인증하면 응모할 수 있어요.` : '이벤트존 참여를 인증하면 응모할 수 있어요.'}</p></div>
        {raffleEntry && <Check className="reward-check" size={20}/>}
        <RaffleEntryCard eligible={raffleEligible} entry={raffleEntry} onEntered={entry => setStatus(current => current ? { ...current, raffleEntry: entry } : current)}/>
      </div>
      <div className="attendance-instructions"><h3><Nfc size={19}/> 이렇게 참여하세요</h3><ol><li>강연 시작 시 입구의 NFC 태그에 휴대폰을 가까이 대세요.</li><li>{attendancePolicy.enforceLocation ? '태그의 링크를 열고 로그인한 뒤 위치 권한을 허용해주세요. 행사장 반경 200m 안인지 확인한 후 인증됩니다.' : '태그의 링크를 열고 로그인해주세요. 위치는 조회하지만 허용 여부나 위치 결과에 관계없이 인증됩니다.'}</li><li>{attendancePolicy.enforceTime ? '각 강연 시작 후 10분 이내에 인증해주세요.' : '현재는 강연 시간과 관계없이 URL에 지정된 강연이 자동 인증됩니다.'} 같은 시간대의 다른 강연은 추가 인증할 수 없습니다.</li><li>이벤트존에 참여하고 현장의 NFC 태그로 참여를 인증해주세요. 강의 세션 4개 이상과 이벤트존 참여 인증을 모두 완료하면 럭키드로우에 응모할 수 있습니다.</li></ol><p>현재 위치는 인증할 때만 확인하며 좌표는 저장하지 않습니다. 수강·이벤트존 참여 인증과 응모권은 로그인한 참가자 정보로 보관됩니다. 선물 수령과 추첨 일정은 현장 안내를 확인해주세요.</p></div>
    </section>
  );
}
