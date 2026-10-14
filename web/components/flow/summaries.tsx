import type { Opportunity, PhaseKey, Profile } from '@/lib/types';
import { replies, sentCount } from '@/lib/journey';

const OUTCOME: Record<Opportunity['outcome'], string> = {
  open: 'Still open',
  offer: 'Offer in hand',
  hired: 'Hired',
  closed: 'Closed',
};

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

/* One line under a finished step: what it produced, in numbers. */
export function stepSummary(o: Opportunity, phase: PhaseKey, profile: Profile): string {
  switch (phase) {
    case 'upload':
      return [o.role, plural(profile.proof.length, 'proof point'), plural(o.requirements.length, 'requirement')].filter(Boolean).join(' · ');
    case 'tailor': {
      const covered = o.requirements.filter((r) => r.strength !== 'none').length;
      const told = o.agenda.filter((a) => a.done).length;
      return `${covered} of ${o.requirements.length} matched · ${plural(told, 'story', 'stories')}`;
    }
    case 'people':
      return o.contacts.length ? `${plural(o.contacts.length, 'person', 'people')} · ${o.contacts[0].name} first` : 'Nobody yet';
    case 'messaging':
      return `${sentCount(o)} sent · ${plural(replies(o), 'reply', 'replies')}`;
    case 'interview':
      return [o.booked ? 'Booked' : 'Not booked', plural(o.questions?.likely.length ?? 0, 'question'), plural(o.practice.length, 'answer') + ' practised'].join(' · ');
    case 'track':
      return OUTCOME[o.outcome];
  }
}

export { OUTCOME };
