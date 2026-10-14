import type { Opportunity, PhaseKey } from '@/lib/types';
import { PHASES } from '@/lib/types';

/* The six steps, in order. Labels are one word; `next` is what the primary
   button says when this step is finished. */
export interface PhaseMeta {
  key: PhaseKey;
  n: number;
  label: string;
  next: string;
}

export const PHASE_META: Record<PhaseKey, PhaseMeta> = {
  upload: { key: 'upload', n: 1, label: 'Upload', next: 'Tailor' },
  tailor: { key: 'tailor', n: 2, label: 'Tailor', next: 'People' },
  people: { key: 'people', n: 3, label: 'People', next: 'Messaging' },
  messaging: { key: 'messaging', n: 4, label: 'Messaging', next: 'Interview' },
  interview: { key: 'interview', n: 5, label: 'Interview', next: 'Track' },
  track: { key: 'track', n: 6, label: 'Track', next: '' },
};

export const PHASE_LIST: PhaseMeta[] = PHASES.map((k) => PHASE_META[k]);

export function phaseIndex(key: PhaseKey): number {
  return PHASES.indexOf(key);
}

export function isDone(o: Opportunity, key: PhaseKey): boolean {
  return o.done.includes(key);
}

/** the first step not yet finished, or Track when everything is */
export function currentPhase(o: Opportunity): PhaseKey {
  return PHASES.find((k) => !o.done.includes(k)) ?? 'track';
}

export function nextPhase(key: PhaseKey): PhaseKey | null {
  const i = phaseIndex(key);
  return i < PHASES.length - 1 ? PHASES[i + 1] : null;
}

export function progress(o: Opportunity): { done: number; total: number } {
  return { done: PHASES.filter((k) => o.done.includes(k)).length, total: PHASES.length };
}

export type PhaseState = 'done' | 'open' | 'upcoming';

export function phaseState(o: Opportunity, key: PhaseKey): PhaseState {
  if (o.open === key) return 'open';
  return o.done.includes(key) ? 'done' : 'upcoming';
}

/** days since the opportunity was added, for the CRM and the Track step */
export function daysActive(o: Opportunity, now = Date.now()): number {
  return Math.max(0, Math.floor((now - o.createdAt) / 86_400_000));
}

export function lastTouch(o: Opportunity): number | null {
  const sent = o.touches.map((t) => t.sentAt ?? 0).filter(Boolean);
  return sent.length ? Math.max(...sent) : null;
}

export function replies(o: Opportunity): number {
  return o.touches.filter((t) => t.status === 'replied').length;
}

export function sentCount(o: Opportunity): number {
  return o.touches.filter((t) => t.status === 'sent' || t.status === 'replied').length;
}
