'use client';

import { useEffect, useState } from 'react';

/* Progress as a ring that sweeps to its value the first time it shows. */
export function Ring({ done, total, size = 36, stroke = 3.5, track = 'var(--sunk-2)', fill = 'var(--sea-bright)', children }: {
  done: number;
  total: number;
  size?: number;
  stroke?: number;
  track?: string;
  fill?: string;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = total ? done / total : 0;
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(pct));
    return () => cancelAnimationFrame(id);
  }, [pct]);
  const complete = total > 0 && done >= total;
  return (
    <span className="relative inline-grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 -rotate-90" role="img" aria-label={`${done} of ${total} done`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={complete ? 'var(--sand-strong)' : fill}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - shown)}
          style={{ transition: 'stroke-dashoffset 900ms var(--out)' }}
        />
      </svg>
      {children}
    </span>
  );
}
