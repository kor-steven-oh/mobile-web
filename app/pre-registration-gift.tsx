'use client';

import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react';
import Image from 'next/image';
import { Check, ChevronRight, Gift, House, Sparkles, X } from 'lucide-react';
import { participantFetch } from './participant-session';
import type { PreRegistrationGiftStatus } from '../db/gifts';

const receiptDate = (value: number) => new Date(value).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });

type GiftDialogMode = 'notice' | 'redeem';
const noticePreferenceKey = (participantId: string) => `sdd2026-pre-gift-notice-hidden:${participantId}`;

function GiftDialog({ participantId, mode, redeemedAt, onRedeemed, onClose }: { participantId: string; mode: GiftDialogMode; redeemedAt: number | null; onRedeemed: (value: number) => void; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const pinId = useId();
  const [pin, setPin] = useState('');
  const [hideNotice, setHideNotice] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const dialog = ref.current;
    const trigger = document.activeElement;
    const overflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
      if (trigger instanceof HTMLElement) trigger.focus({ preventScroll: true });
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || redeemedAt !== null) return;
    if (!/^[0-9]{4}$/.test(pin)) { setError('STAFF 인증번호 4자리를 입력해주세요.'); return; }
    setBusy(true); setError('');
    try {
      const response = await participantFetch('/api/pre-registration-gift', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin }),
      });
      const result = await response.json() as PreRegistrationGiftStatus & { error?: string };
      if (!response.ok || !result.eligible || result.redeemedAt == null) throw new Error(result.error || '지급 처리를 완료하지 못했습니다.');
      onRedeemed(result.redeemedAt);
    } catch (cause) { setError(cause instanceof Error ? cause.message : '다시 시도해주세요.'); }
    finally { setBusy(false); setPin(''); }
  }

  return <dialog ref={ref} className={`modal pre-gift-dialog${mode === 'notice' ? ' pre-gift-notice' : ''}`} aria-labelledby="pre-gift-dialog-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }} onClick={event => {
    if (busy || event.target !== event.currentTarget) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
  }}>
    <div className="modal-heading"><span className="eyebrow">A GIFT FOR YOU</span><button type="button" className="icon-button" onClick={onClose} disabled={busy} aria-label="선물 안내 닫기"><X size={22}/></button></div>
    {mode === 'notice' ? <>
      <div className="pre-gift-celebration" aria-hidden="true">
        <span className="pre-gift-celebration-halo"/>
        <span className="pre-gift-celebration-seal"><Gift size={34} strokeWidth={1.8}/></span>
        <Sparkles className="pre-gift-celebration-sparkle" size={23} strokeWidth={1.7}/>
        <i/><i/><i/><i/>
      </div>
      <h2 id="pre-gift-dialog-title">축하합니다.</h2>
      <p className="pre-gift-notice-copy">사전등록 선물 지급 대상자로 선정되셨습니다.<br/>행사 당일 현장에서 선물을 수령해주세요.</p>
      <div className="pre-gift-notice-guide"><House size={20} aria-hidden="true"/><p>Home 화면의 <strong>‘사전등록 선물지급’</strong><br/>카드에서 자세한 내용을 확인해주세요.</p></div>
      <label className="pre-gift-hide-notice"><input type="checkbox" checked={hideNotice} onChange={event => {
        const checked = event.target.checked;
        setHideNotice(checked);
        try {
          if (checked) localStorage.setItem(noticePreferenceKey(participantId), '1');
          else localStorage.removeItem(noticePreferenceKey(participantId));
        } catch { /* The popup remains dismissible when browser storage is unavailable. */ }
      }}/><span>다시 보지 않기</span></label>
      <button type="button" className="primary-button" onClick={onClose}>확인</button>
    </> : <>
    <div className="pre-gift-dialog-icon" aria-hidden="true"><Gift size={28}/></div>
    <h2 id="pre-gift-dialog-title">사전등록 선물지급</h2>
    <p className="pre-gift-congratulations">사전 이벤트 당첨을 축하드립니다!</p>
    <Image className="pre-gift-photo" src="/pre-registration-gift.webp" alt="사전등록 선물: 살로몬 백팩과 착용 모습, SDD 키링" width={1200} height={498} unoptimized loading="eager"/>
    {redeemedAt !== null ? <>
      <div className="gift-receipt" role="status"><Check size={22}/><div><strong>사전등록 선물 지급 완료</strong><span>{receiptDate(redeemedAt)}</span></div></div>
      <button type="button" className="primary-button" onClick={onClose}>확인</button>
    </> : <>
      <p className="pre-gift-pickup">현장 STAFF에게 이 화면을 보여주세요.<br/>선물 전달 후 STAFF가 인증번호를 입력합니다.</p>
      <form className="staff-pin-form pre-gift-pin-form" onSubmit={submit}>
        <label htmlFor={pinId}>STAFF 인증번호 4자리</label>
        <input id={pinId} type="password" inputMode="numeric" autoComplete="off" maxLength={4} pattern="[0-9]{4}" placeholder="••••" value={pin} onChange={event => setPin(event.target.value.replace(/\D/g, '').slice(0, 4))} disabled={busy} required/>
        {error && <p className="registration-error" role="alert">{error}</p>}
        <button className="gift-redeem-button" type="submit" disabled={busy || pin.length !== 4}>{busy ? '지급 확인 중…' : '지급 완료 처리'}</button>
      </form>
    </>}
    </>}
  </dialog>;
}

export default function PreRegistrationGiftCard({ participantId, participantName }: { participantId?: string; participantName?: string }) {
  const [recipient, setRecipient] = useState<{ id: string; redeemedAt: number | null } | null>(null);
  const [dialog, setDialog] = useState<{ recipientId: string; mode: GiftDialogMode } | null>(null);
  const closeDialog = useCallback(() => setDialog(null), []);
  useEffect(() => {
    if (!participantId) return;
    const controller = new AbortController();
    async function load() {
      try {
        const response = await participantFetch('/api/pre-registration-gift', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
        if (!response.ok) return;
        const data = await response.json() as PreRegistrationGiftStatus;
        if (!controller.signal.aborted) {
          setRecipient(data.eligible ? { id: participantId!, redeemedAt: data.redeemedAt } : null);
          let noticeHidden = false;
          try { noticeHidden = localStorage.getItem(noticePreferenceKey(participantId!)) === '1'; } catch { /* Default to showing the notice. */ }
          // The preference only suppresses the automatic notice, never the gift card.
          setDialog(data.eligible && data.redeemedAt === null && !noticeHidden ? { recipientId: participantId!, mode: 'notice' } : null);
        }
      } catch { /* Keep the conditional card hidden until eligibility is confirmed. */ }
    }
    void load();
    return () => controller.abort();
  }, [participantId]);

  if (!participantId || !recipient || recipient.id !== participantId) return null;
  const redeemed = recipient.redeemedAt !== null;
  return <><section className={`pre-registration-gift${redeemed ? ' is-redeemed' : ''}`} aria-labelledby="pre-registration-gift-title">
    <button className="pre-gift-details" type="button" aria-haspopup="dialog" onClick={() => setDialog({ recipientId: participantId, mode: 'redeem' })}>
      <span className="pre-registration-gift-icon">{redeemed ? <Check size={22} aria-hidden="true"/> : <><Gift size={22} aria-hidden="true"/><Sparkles className="pre-gift-card-sparkle" size={15} aria-hidden="true"/></>}</span>
      <span className="pre-gift-card-copy"><strong id="pre-registration-gift-title">사전등록 선물지급</strong><span>{redeemed ? '지급 완료 · 지급 내역 확인' : `${participantName || '참석자'}님 당첨을 축하드려요!`}</span></span>
      <ChevronRight size={18} aria-hidden="true"/>
    </button>
  </section>{dialog?.recipientId === participantId && <GiftDialog key={dialog.mode} participantId={participantId} mode={dialog.mode} redeemedAt={recipient.redeemedAt} onRedeemed={value => setRecipient(current => current?.id === participantId ? { ...current, redeemedAt: value } : current)} onClose={closeDialog}/>}</>;
}
