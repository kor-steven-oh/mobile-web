'use client';

import { participantFetch } from './participant-session';

import { useId, useLayoutEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { Check, Gift, X } from 'lucide-react';
import type { EventReward } from '../db/attendance';

type Props = { threshold: 2 | 3; gift?: EventReward; onRedeemed: (reward: EventReward) => void };

function StaffDialog({ busy, title, onClose, children }: { busy: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useLayoutEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    dialog?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true });
    return () => dialog?.close();
  }, []);
  return <dialog ref={ref} className="modal staff-gift-dialog" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }} onClick={event => { if (!busy && event.target === event.currentTarget) onClose(); }}>
    <div className="modal-heading"><span className="eyebrow">{title} 수령</span><button type="button" className="icon-button" aria-label="닫기" disabled={busy} onClick={onClose}><X size={22}/></button></div>
    <h2 id={titleId}>STAFF에게 제출하세요</h2>
    {children}
  </dialog>;
}


export default function GiftRedemption({ threshold, gift, onRedeemed }: Props) {
  const title = threshold === 3 ? '추가 참여선물' : '참여선물';
  const pinId = useId();
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const redeemed = gift?.redeemedAt != null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !gift || redeemed) return;
    if (!/^[0-9]{4}$/.test(pin)) { setError('STAFF 인증번호 4자리를 입력해주세요.'); return; }
    setBusy(true); setError('');
    try {
      const response = await participantFetch('/api/gift-redemption', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, kind: gift.kind }),
      });
      const result = await response.json() as { reward?: EventReward; error?: string };
      if (!response.ok || !result.reward) throw new Error(result.error || '수령 처리를 완료하지 못했습니다.');
      onRedeemed(result.reward); setOpen(false); setPin('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '다시 시도해주세요.');
      setPin('');
    } finally { setBusy(false); }
  }

  return <div className="gift-redemption">
    {redeemed ? <div className="gift-receipt" role="status"><Check size={20}/><div><strong>{title} 수령 완료</strong><span>{new Date(gift.redeemedAt!).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}</span></div></div>
      : <>
        <button className="gift-redeem-button" type="button" disabled={!gift || busy} aria-haspopup="dialog" aria-expanded={open} onClick={() => { flushSync(() => { setOpen(true); setError(''); setPin(''); }); }}><Gift size={18}/>{gift ? `${title} 받기` : `${threshold}개 인증 후 수령 가능`}</button>
        {open && gift && <StaffDialog busy={busy} title={`${threshold}개 인증 · ${title}`} onClose={() => { setOpen(false); setPin(''); setError(''); }}><form className="staff-pin-form" onSubmit={submit}>
          <label htmlFor={pinId}>STAFF 인증번호 4자리</label>
          <input autoFocus id={pinId} type="password" inputMode="numeric" autoComplete="off" maxLength={4} pattern="[0-9]{4}" placeholder="••••" value={pin} onChange={event => setPin(event.target.value.replace(/\D/g, '').slice(0, 4))} disabled={busy} required />
          <p className="staff-pin-help">STAFF가 선물 전달 후 인증번호를 입력해주세요.</p>
          {error && <p className="registration-error" role="alert">{error}</p>}
          <button className="gift-redeem-button" type="submit" disabled={busy || pin.length !== 4}>{busy ? '수령 확인 중…' : '수령 완료 처리'}</button>
        </form></StaffDialog>}
      </>}
  </div>;
}
