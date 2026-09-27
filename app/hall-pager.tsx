'use client';

import { useEffect, useRef, type PointerEvent, type ReactNode } from 'react';
import { halls } from './data';

type Props = {
  hall: string;
  onHallChange: (hall: string) => void;
  children: (hall: string) => ReactNode;
};

/** Native scrolling supplies touch tracking, momentum and interruptible snapping. */
export default function HallPager({ hall, onHallChange, children }: Props) {
  const viewport = useRef<HTMLDivElement>(null);
  const activeIndex = useRef(halls.findIndex(value => value === hall));
  const drag = useRef<{ id: number; x: number; y: number; left: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);

  useEffect(() => {
    const element = viewport.current;
    const index = halls.findIndex(value => value === hall);
    if (!element || index === activeIndex.current) return;
    activeIndex.current = index;
    // Button selection jumps directly; native gestures retain their own momentum.
    element.scrollTo({ left: index * element.clientWidth, behavior: 'instant' });
  }, [hall]);

  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      element.scrollTo({ left: activeIndex.current * element.clientWidth, behavior: 'instant' });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  function finishDrag(event: PointerEvent<HTMLDivElement>, cancelled = false) {
    const gesture = drag.current;
    if (!gesture || gesture.id !== event.pointerId) return;
    drag.current = null;
    const element = event.currentTarget;
    element.style.scrollSnapType = '';
    element.removeAttribute('data-dragging');
    if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId);
    if (!gesture.moved) return;
    const distance = event.clientX - gesture.x;
    const origin = Math.round(gesture.left / element.clientWidth);
    const index = Math.max(0, Math.min(halls.length - 1,
      cancelled ? origin : origin + (Math.abs(distance) > 48 ? (distance < 0 ? 1 : -1) : 0)));
    element.scrollTo({
      left: index * element.clientWidth,
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    });
  }

  return (
    <div
      ref={viewport}
      className="hall-pager"
      role="region"
      aria-label="강연장별 프로그램, 좌우로 스와이프하거나 방향키로 이동"
      aria-roledescription="캐러셀"
      tabIndex={0}
      onScroll={event => {
        const element = event.currentTarget;
        if (!element.clientWidth) return;
        const index = Math.max(0, Math.min(halls.length - 1, Math.round(element.scrollLeft / element.clientWidth)));
        if (index !== activeIndex.current) {
          activeIndex.current = index;
          onHallChange(halls[index]);
        }
      }}
      onKeyDown={event => {
        if (event.target !== event.currentTarget || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
        event.preventDefault();
        const index = Math.max(0, Math.min(halls.length - 1, activeIndex.current + (event.key === 'ArrowRight' ? 1 : -1)));
        onHallChange(halls[index]);
      }}
      onPointerDown={event => {
        suppressClick.current = false;
        if (event.pointerType !== 'mouse' || event.button !== 0) return;
        drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, left: event.currentTarget.scrollLeft, moved: false };
      }}
      onPointerMove={event => {
        const gesture = drag.current;
        if (!gesture || gesture.id !== event.pointerId) return;
        const dx = event.clientX - gesture.x;
        if (!gesture.moved) {
          if (Math.abs(dx) < 8) return;
          if (Math.abs(dx) < Math.abs(event.clientY - gesture.y)) { drag.current = null; return; }
          gesture.moved = true;
          suppressClick.current = true;
          event.currentTarget.setPointerCapture(event.pointerId);
          event.currentTarget.style.scrollSnapType = 'none';
          event.currentTarget.setAttribute('data-dragging', 'true');
        }
        event.preventDefault();
        event.currentTarget.scrollLeft = gesture.left - dx;
      }}
      onPointerUp={event => finishDrag(event)}
      onPointerCancel={event => finishDrag(event, true)}
      onLostPointerCapture={event => finishDrag(event, true)}
      onClickCapture={event => {
        if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; }
      }}
      onDragStart={event => event.preventDefault()}
    >
      {halls.map(value => (
        <section key={value} className="hall-panel" aria-label={`${value} 강연 프로그램`} inert={value !== hall}>
          {children(value)}
        </section>
      ))}
    </div>
  );
}
