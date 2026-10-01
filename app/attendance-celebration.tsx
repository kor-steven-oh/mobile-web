'use client';

import { useEffect, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Check, Gift, Ticket, X } from 'lucide-react';
import './attendance-celebration.css';

const pieces = Array.from({ length: 24 }, (_, index) => {
  const angle = (index / 24) * Math.PI * 2;
  const distance = 100 + (index % 3) * 28;
  return {
    '--burst-x': `${Math.cos(angle) * distance}px`,
    '--burst-y': `${Math.sin(angle) * distance}px`,
    '--burst-rotate': `${index * 53}deg`,
    '--burst-delay': `${(index % 4) * 35}ms`,
    '--burst-color': ['var(--blue)', 'var(--lime)', '#85b4ff', '#b3d044'][index % 4],
  } as CSSProperties;
});

export default function AttendanceCelebration({ count, title, eventZoneVerified = false, onDismiss }: {
  count: number; title: string; eventZoneVerified?: boolean; onDismiss: () => void;
}) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, 4800);
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onDismiss(); };
    window.addEventListener('keydown', onKey);
    return () => { window.clearTimeout(timer); window.removeEventListener('keydown', onKey); };
  }, [onDismiss]);

  const milestone = count === 2 ? '참여선물을 받을 수 있어요!' : count === 3 ? '추가 참여선물을 받을 수 있어요!' : count === 4 ? (eventZoneVerified ? '럭키드로우에 응모할 수 있어요!' : '이벤트존 참여 인증까지 하면 럭키드로우!') : count === 5 ? '5개 세션 인증을 모두 완료했어요!' : `${count}번째 배움이 쌓였어요!`;
  const MilestoneIcon = count === 2 ? Gift : count === 4 ? Ticket : Check;
  return createPortal(
    <div className="checkin-celebration">
      <div className="checkin-celebration-card">
        <button type="button" className="checkin-celebration-close" onClick={onDismiss} aria-label="인증 축하 알림 닫기"><X size={20}/></button>
        <div className="checkin-celebration-art" aria-hidden="true">
          <span className="checkin-celebration-ring"/>
          <div className="checkin-confetti">{pieces.map((style, index) => <i key={index} style={style}/>)}</div>
          <div className="checkin-celebration-seal"><Check size={40} strokeWidth={3}/></div>
        </div>
        <div role="status" aria-live="polite" aria-atomic="true">
          <span className="checkin-celebration-label">CHECK-IN COMPLETE</span>
          <h2>수강 인증 완료!</h2>
          <p className="checkin-celebration-title">{title}</p>
          <p className="checkin-celebration-milestone"><MilestoneIcon size={17} aria-hidden="true"/>{milestone}</p>
        </div>
        <div className="checkin-celebration-progress" aria-label={`${count}개 인증 완료, 전체 5개`}>
          {Array.from({ length: 5 }, (_, index) => <span key={index} className={index < count ? 'filled' : ''} aria-hidden="true">{index < count ? <Check size={14}/> : index + 1}</span>)}
        </div>
      </div>
    </div>, document.body,
  );
}
