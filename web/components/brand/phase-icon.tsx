import { FileUp, Sparkles, Users, Send, Mic, Flag, type LucideProps } from 'lucide-react';
import type { PhaseKey } from '@/lib/types';

const ICONS = { upload: FileUp, tailor: Sparkles, people: Users, messaging: Send, interview: Mic, track: Flag } as const;

export function PhaseIcon({ phase, ...props }: { phase: PhaseKey } & LucideProps) {
  const I = ICONS[phase];
  return <I aria-hidden="true" {...props} />;
}
