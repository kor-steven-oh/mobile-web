'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { ChevronRight, Sparkles, X } from 'lucide-react';

const experiences = [
  { name: 'AI 오목대결', category: 'AI 대결', description: 'AI와 오목 한 판! 나만의 전략으로 AI에게 도전해보세요.', image: '/event-zone/ai-gomoku.webp', thumbnail: '/event-zone/ai-gomoku-thumb.webp', imageAlt: 'AI 로봇과 오목을 두는 참가자' },
  { name: 'SDD 퍼즐조립', category: '타임 챌린지', description: '흩어진 퍼즐 조각을 하나씩 맞춰보세요. 제한 시간 안에 SDD 모양을 완성하면 성공!', image: '/event-zone/sdd-puzzle.webp', thumbnail: '/event-zone/sdd-puzzle-thumb.webp', imageAlt: 'SDD 모양의 퍼즐을 조립하는 참가자들' },
  { name: 'SDD 자유투', category: '타임 챌린지', description: '골대를 향해 집중하고 슛! 제한 시간 안에 난이도별 자유투 미션을 성공해보세요.', image: '/event-zone/sdd-basketball.webp', thumbnail: '/event-zone/sdd-basketball-thumb.webp', imageAlt: 'SDD 골대에 자유투를 던지는 참가자' },
  { name: '간식 쓸어담기', category: '블라인드 미션', description: '눈을 가리고 제한 시간 안에 간식을 쓸어담아보세요. 손끝의 감각에 집중해볼까요?', image: '/event-zone/snack-scoop.webp', thumbnail: '/event-zone/snack-scoop-thumb.webp', imageAlt: '눈을 가리고 간식을 쓸어담는 참가자' },
  { name: 'ROPE SYNC', category: '팀 미션', description: '팀원들과 로프의 장력을 조절해 중앙의 캐리어와 공을 움직이고, 목표 지점까지 도달해보세요.', image: '/event-zone/rope-sync.webp', thumbnail: '/event-zone/rope-sync-thumb.webp', imageAlt: '로프를 조절해 공을 함께 옮기는 참가자들' },
  { name: 'FLY & SCORE', category: '종이비행기', description: '목표를 향해 종이비행기를 날려보세요. 방향과 힘을 조절해 지정된 구역을 통과하면 성공!', image: '/event-zone/fly-score.webp', thumbnail: '/event-zone/fly-score-thumb.webp', imageAlt: '목표 구역을 향해 종이비행기를 날리는 참가자' },
];

function SuccessStamp({ compact = false }: { compact?: boolean }) {
  return <span className={compact ? 'experience-success compact' : 'experience-success'}>
    {!compact && <span className="experience-success-copy"><strong>성공 스탬프</strong><span>성공하면 이곳에 표시돼요.</span></span>}
    <span className="experience-success-stamp" aria-label="성공 스탬프 미등록" title="성공 스탬프 미등록"><span aria-hidden="true">—</span></span>
  </span>;
}

function ExperienceDialog({ index, onClose }: { index: number; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const experience = experiences[index];
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
  return <dialog ref={ref} className="modal experience-dialog" aria-labelledby="experience-dialog-title" onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => {
    if (event.target !== event.currentTarget) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
  }}>
    <div className="modal-heading"><span className="eyebrow">ZONE {String(index + 1).padStart(2, '0')}</span><button type="button" className="icon-button" aria-label="닫기" onClick={onClose}><X size={22}/></button></div>
    <h2 id="experience-dialog-title">{experience.name}</h2>
    <span className="experience-category">{experience.category}</span>
    <Image className="experience-photo" src={experience.image} alt={experience.imageAlt} width={1200} height={800} unoptimized/>
    <p className="detail-description">{experience.description}</p>
    <section className="experience-game-info" aria-labelledby="experience-game-title"><h3 id="experience-game-title">게임 안내</h3><p>자세한 게임 방법은 곧 안내해드릴게요.</p></section>
    <SuccessStamp/>
    <button type="button" className="primary-button" onClick={onClose}>확인</button>
  </dialog>;
}

export default function EventZone() {
  const [selected, setSelected] = useState<number | null>(null);
  return <section className="event-zone" aria-labelledby="event-zone-title">
    <div className="event-zone-intro">
      <span className="eyebrow">PLAY & CONNECT</span>
      <h2 id="event-zone-title">SDD 이벤트존에서<br/><span>함께 즐겨주세요.</span></h2>
      <p>도전하고, 맞추고, 함께 호흡하며.<br/>6개의 체험존에서 색다른 즐거움을 만나보세요.</p>
      <span className="event-zone-count"><Sparkles size={15} aria-hidden="true"/>6 EXPERIENCE ZONES</span>
    </div>
    <ol className="experience-list" aria-label="체험존 안내">
      {experiences.map(({ name, category, description, thumbnail }, index) => <li key={name}><button type="button" className="experience-card" aria-label={`${name} 상세보기`} aria-haspopup="dialog" onClick={() => setSelected(index)}>
        <span className="experience-card-top"><span className="experience-number">ZONE {String(index + 1).padStart(2, '0')}</span><span className="experience-card-badges"><span className="experience-category">{category}</span><SuccessStamp compact/></span></span>
        <span className="experience-card-body"><Image className="experience-thumbnail" src={thumbnail} alt="" width={216} height={216} unoptimized/><span className="experience-card-copy"><span className="experience-title-row"><strong className="experience-title">{name}</strong><ChevronRight size={18} aria-hidden="true"/></span><span className="experience-description">{description}</span></span></span>
      </button></li>)}
    </ol>
    {selected !== null && <ExperienceDialog index={selected} onClose={() => setSelected(null)}/>}
  </section>;
}
