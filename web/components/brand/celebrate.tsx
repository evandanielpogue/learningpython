'use client';

import { useEffect, useState } from 'react';
import { PartyPopper } from 'lucide-react';

/* A milestone: a burst of sea and sand, and one line saying what happened.
   Fired from anywhere with celebrate(); rendered once, in the app shell. */

type Burst = { id: number; title: string };

export function celebrate(title: string) {
  window.dispatchEvent(new CustomEvent<string>('fd:celebrate', { detail: title }));
}

const COLOURS = ['var(--sea-bright)', 'var(--sea-glow)', 'var(--sand-strong)', 'var(--sand)', '#ffffff'];

function Pieces() {
  /* fixed per mount: random once is fine, it never re-renders */
  const [pieces] = useState(() =>
    Array.from({ length: 34 }, (_, i) => ({
      i,
      x: (Math.random() - 0.5) * 520,
      y: -(80 + Math.random() * 260),
      r: Math.random() * 540 - 270,
      d: 700 + Math.random() * 700,
      s: 5 + Math.random() * 6,
      c: COLOURS[i % COLOURS.length],
      round: Math.random() > 0.5,
    })),
  );
  return (
    <>
      {pieces.map((p) => (
        <span
          key={p.i}
          className="absolute left-1/2 top-1/2 block"
          style={
            {
              width: p.s,
              height: p.round ? p.s : p.s * 0.45,
              borderRadius: p.round ? 999 : 2,
              background: p.c,
              animation: `fd-confetti ${p.d}ms var(--out) forwards`,
              '--x': `${p.x}px`,
              '--y': `${p.y}px`,
              '--r': `${p.r}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </>
  );
}

export function Celebrations() {
  const [bursts, setBursts] = useState<Burst[]>([]);
  useEffect(() => {
    let n = 0;
    function on(e: Event) {
      const title = (e as CustomEvent<string>).detail;
      const id = ++n;
      setBursts((b) => [...b, { id, title }]);
      setTimeout(() => setBursts((b) => b.filter((x) => x.id !== id)), 2400);
    }
    window.addEventListener('fd:celebrate', on);
    return () => window.removeEventListener('fd:celebrate', on);
  }, []);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[18vh] z-[60] flex justify-center" aria-live="polite">
      {bursts.map((b) => (
        <div key={b.id} className="relative">
          <Pieces />
          <div className="animate-pop relative flex items-center gap-2.5 rounded-full bg-night px-5 py-3 text-[15px] font-semibold text-night-ink shadow-e4 [animation-fill-mode:both]">
            <span className="grid size-7 place-items-center rounded-full bg-sand text-sand-ink">
              <PartyPopper className="size-4" />
            </span>
            {b.title}
          </div>
          <style>{`@keyframes fd-confetti{0%{opacity:1;transform:translate(-50%,-50%) rotate(0)}100%{opacity:0;transform:translate(calc(-50% + var(--x)),calc(-50% + var(--y) + 220px)) rotate(var(--r))}}`}</style>
        </div>
      ))}
    </div>
  );
}
