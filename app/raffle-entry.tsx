'use client';

import { participantFetch } from './participant-session';

import { useState } from 'react';
import { Check, Ticket } from 'lucide-react';
import type { RaffleEntry } from '../db/raffle';

type Props = { eligible: boolean; entry: RaffleEntry | null; onEntered: (entry: RaffleEntry) => void };

export default function RaffleEntryCard({ eligible, entry, onEntered }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function enter() {
    if (busy || !eligible || entry) return;
    setBusy(true); setError('');
    try {
      const response = await participantFetch('/api/raffle-entry', { method: 'POST', credentials: 'same-origin' });
      const result = await response.json() as { entry?: RaffleEntry; error?: string };
      if (!response.ok || !result.entry) throw new Error(result.error || '응모권을 발급하지 못했습니다.');
      onEntered(result.entry);
    } catch (cause) { setError(cause instanceof Error ? cause.message : '다시 시도해주세요.'); }
    finally { setBusy(false); }
  }
  return <div className="raffle-entry-action">
    {entry ? <div className="raffle-ticket numbered-ticket" role="status"><span><Check size={16}/> 응모 완료 · 나의 응모번호</span><strong>{entry.number}<small>번</small></strong><p>추첨 시 이 번호를 확인해주세요.</p><small>참가자당 1장 · 다시 접속해도 같은 번호가 유지됩니다.</small></div>
      : <><button className="raffle-enter-button" type="button" disabled={!eligible || busy} onClick={() => void enter()}><Ticket size={18}/>{busy ? '응모권 발급 중…' : '응모하기'}</button><p>응모하면 고유한 번호가 순서대로 발급됩니다.</p></>}
    {error && <p className="registration-error" role="alert">{error}</p>}
  </div>;
}
