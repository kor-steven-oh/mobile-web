'use client';

import { useEffect, useState } from 'react';
import { Copy, Nfc, RefreshCw } from 'lucide-react';
import type { AdminNfcTag } from '../db/admin';
import { attendancePolicy } from '../app/attendance-policy';

const rooms = [['101', '101호 · AP'], ['107', '107호 · CP'], ['201', '201호 · LSI'], ['206', '206호 · Sensor'], ['208', '208호 · 직속'], ['EVENT_ZONE', '이벤트존']];
const times = ['10:00', '11:00', '13:30', '14:30', '15:30'];
type Api = <T>(path: string, body?: unknown) => Promise<T>;

export default function NfcLinks({ api }: { api: Api }) {
  const [tags, setTags] = useState<AdminNfcTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const result = await api<{ tags: AdminNfcTag[] }>('/api/nfc-tags');
        if (active) { setTags(result.tags); setError(''); }
      } catch (cause) { if (active) setError((cause as Error).message); }
      finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [api, revision]);

  async function copy(url: string, label: string) {
    try { await navigator.clipboard.writeText(url); setNotice(`${label} URL을 복사했습니다.`); }
    catch { setNotice('복사하지 못했습니다. URL 입력란을 선택해 직접 복사해주세요.'); }
  }

  return <section className="panel nfc-links-panel" aria-labelledby="nfc-links-title">
    <div className="panel-heading"><h2 id="nfc-links-title"><Nfc size={19}/> NFC 인증 URL</h2><button aria-label="NFC 인증 URL 새로고침" disabled={loading} onClick={() => setRevision(value => value + 1)}><RefreshCw size={18}/></button></div>
    <p className="nfc-links-description">강연장이나 이벤트존을 펼쳐 인증 URL을 확인하고 복사하세요. {attendancePolicy.enforceTime ? '강연장 URL은 태깅한 시간의 강연을 인증합니다.' : '강연장 URL은 선택한 회차를 인증합니다.'} 이벤트존은 별도로 참여 인증됩니다.</p>
    {notice && <p className="success" role="status">{notice}</p>}
    {error && <p className="error" role="alert">{error}</p>}
    {loading ? <p className="muted">NFC 인증 URL을 불러오고 있어요.</p> : <div className="nfc-room-list">{rooms.map(([room, label]) => {
      const roomTags = tags.filter(tag => tag.room === room);
      return <details key={room}><summary>{label}<span>{roomTags.filter(tag => tag.active).length}개 태그</span></summary>
        {roomTags.length === 0 && <p className="muted">등록된 NFC 태그가 없습니다.</p>}
        {roomTags.map((tag, index) => <div className="nfc-tag-links" key={tag.id}>
          {(roomTags.length > 1 || !tag.active) && <p className="muted">태그 {index + 1} · {tag.active ? '사용 중' : '사용 중지'}</p>}
          {!tag.active ? <p className="muted">사용 중지된 태그입니다.</p> : !tag.url ? <p className="muted">원본 URL이 아직 등록되지 않았습니다.</p> : (room === 'EVENT_ZONE' || attendancePolicy.enforceTime ? [null] : times.map((_, i) => i + 1)).map(slot => {
            const url = new URL(tag.url!);
            const params = new URLSearchParams(url.hash.slice(1));
            if (slot) params.set('slot', String(slot));
            url.hash = params.toString();
            const title = slot ? `${slot}회차 · ${times[slot - 1]}` : room === 'EVENT_ZONE' ? '이벤트존 참여 인증' : '강연장 인증';
            return <div className="nfc-url-row" key={slot ?? 'zone'}><label htmlFor={`nfc-${tag.id}-${slot ?? 'base'}`}>{title}</label><div><input id={`nfc-${tag.id}-${slot ?? 'base'}`} aria-label={`${label} ${title} URL`} value={url.href} readOnly onFocus={event => event.target.select()}/><button onClick={() => void copy(url.href, `${label} ${title}`)} aria-label={`${label} ${title} URL 복사`}><Copy size={16}/>복사</button></div></div>;
          })}
        </div>)}
      </details>;
    })}</div>}
  </section>;
}
