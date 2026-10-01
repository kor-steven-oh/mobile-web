'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Gift, RefreshCw } from 'lucide-react';
import type { PreRegistrationGiftList } from '../db/admin';

type Api = <T>(path: string, body?: unknown) => Promise<T>;
const formatPhone = (phone: string) => `${phone.slice(0, 3)}-${phone.slice(3, 7)}-${phone.slice(7)}`;

export default function PreRegistrationGifts({ api }: { api: Api }) {
  const [phone, setPhone] = useState('');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [list, setList] = useState<PreRegistrationGiftList | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
    setLoading(true);
    await api<PreRegistrationGiftList>(`/api/pre-registration-gifts?q=${encodeURIComponent(search)}&page=${page}`)
      .then(result => { if (active) { setList(result); setError(''); } })
      .catch(cause => { if (active) setError(cause.message); })
      .finally(() => { if (active) setLoading(false); });
    }
    void load();
    return () => { active = false; };
  }, [api, search, page, revision]);

  async function update(action: 'add' | 'remove', value: string) {
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await api('/api/pre-registration-gifts', { action, phone: value });
      setMessage(action === 'add' ? '선물 대상자로 등록했습니다. 이미 등록된 번호는 중복 추가되지 않습니다.' : '선물 대상자에서 삭제했습니다.');
      if (action === 'add') { setPhone(''); setSearch(''); setQuery(''); }
      setPage(1); setRevision(value => value + 1);
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }

  function submit(event: FormEvent) { event.preventDefault(); void update('add', phone); }

  return <section className="panel pre-gift-panel" aria-labelledby="pre-gift-title">
    <div className="panel-heading"><h2 id="pre-gift-title"><Gift size={19}/> 사전등록 선물 대상자</h2><button aria-label="선물 대상자 새로고침" disabled={loading || busy} onClick={() => setRevision(value => value + 1)}><RefreshCw size={18}/></button></div>
    <p className="pre-gift-description">등록된 전화번호로 로그인한 참석자의 Home에 ‘사전등록 선물지급’ 카드가 표시됩니다. 참석자가 로그인하기 전에도 등록할 수 있습니다.</p>
    <form className="search" onSubmit={submit}><input aria-label="선물 대상자 전화번호" type="tel" inputMode="tel" autoComplete="off" placeholder="010-1234-5678" maxLength={20} required value={phone} onChange={event => setPhone(event.target.value)}/><button className="primary" disabled={busy} type="submit">대상자 등록</button></form>
    {message && <p className="success" role="status">{message}</p>}
    {error && <p className="error" role="alert">{error}</p>}
    <form className="search" onSubmit={event => { event.preventDefault(); setSearch(query.trim()); setPage(1); }}><input aria-label="선물 대상자 검색" type="search" placeholder="등록된 전화번호 검색" maxLength={20} value={query} onChange={event => setQuery(event.target.value)}/><button type="submit">검색</button></form>
    <ul className="pre-gift-recipients" aria-busy={loading}>{list?.recipients.map(recipient => <li key={recipient.phone}><div><span>{formatPhone(recipient.phone)}</span><small className={recipient.redeemedAt != null ? 'pre-gift-paid' : 'muted'}>{recipient.redeemedAt != null ? `지급 완료 · ${new Date(recipient.redeemedAt).toLocaleString('ko-KR', {timeZone:'Asia/Seoul',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false})}` : '미지급'}</small></div><button className="text-danger" disabled={busy || loading || recipient.redeemedAt != null} onClick={() => void update('remove', recipient.phone)} aria-label={`${formatPhone(recipient.phone)} 선물 대상자 삭제`}>삭제</button></li>)}</ul>
    {loading ? <p className="muted">대상자를 불러오고 있어요.</p> : list?.recipients.length === 0 && <p className="muted">등록된 대상자가 없습니다.</p>}
    <div className="pagination"><span>총 {list?.total ?? 0}명</span><button disabled={busy || loading || page === 1} onClick={() => setPage(value => value - 1)}>이전</button><span>{page} / {Math.max(1, Math.ceil((list?.total ?? 0) / 25))}</span><button disabled={busy || loading || page * 25 >= (list?.total ?? 0)} onClick={() => setPage(value => value + 1)}>다음</button></div>
  </section>;
}
