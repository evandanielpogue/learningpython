import { cn } from '@/lib/utils';
import type { Persona } from '@/lib/types';

/* A company keeps its colour, derived from its name, everywhere it shows. */
const HUES = ['#0a6a99', '#14785c', '#6b4fc4', '#b03f63', '#1f5fa8', '#c2410c', '#3b4b8f', '#0e7490'];

export function hueFor(name: string): string {
  let h = 0;
  for (const ch of name.trim()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return HUES[h % HUES.length];
}

export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  return (words.length > 1 ? words[0][0] + words[1][0] : words[0].slice(0, 2)).toUpperCase();
}

export function Monogram({ name, size = 32, className }: { name: string; size?: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn('grid shrink-0 place-items-center font-[680] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,.14)]', className)}
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.28), background: hueFor(name), fontSize: Math.round(size * 0.36) }}
    >
      {initialsOf(name)}
    </span>
  );
}

const PERSONA_COLOUR: Record<Persona, string> = {
  Peer: 'var(--p-peer)',
  Recruiter: 'var(--p-recruiter)',
  'Hiring manager': 'var(--p-manager)',
  'Skip level': 'var(--p-exec)',
  'Shared tie': 'var(--p-tie)',
  Other: 'var(--p-other)',
};

export function personaColour(p: Persona): string {
  return PERSONA_COLOUR[p] ?? PERSONA_COLOUR.Other;
}

export function PersonAvatar({ name, persona, size = 32 }: { name: string; persona: Persona; size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="grid shrink-0 place-items-center rounded-full font-semibold text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,.14)]"
      style={{ width: size, height: size, background: personaColour(persona), fontSize: Math.round(size * 0.36) }}
    >
      {initialsOf(name)}
    </span>
  );
}

export function PersonaChip({ persona }: { persona: Persona }) {
  const c = personaColour(persona);
  return (
    <span
      className="inline-flex h-6 items-center rounded-full px-2.5 text-[12px] font-medium"
      style={{ color: c, background: `color-mix(in srgb, ${c} 11%, white)` }}
    >
      {persona}
    </span>
  );
}
