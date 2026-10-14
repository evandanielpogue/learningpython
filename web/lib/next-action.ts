import type { Opportunity } from '@/lib/types';
import { currentPhase } from '@/lib/journey';

/* The one thing to do next on an opportunity, in a few words. Shared by
   the Opportunities table, the board cards and the Track step. */
export function nextAction(o: Opportunity): string {
  if (o.outcome === 'hired') return 'Hired';
  if (o.outcome === 'offer') return 'Decide on the offer';
  if (o.outcome === 'closed') return 'Closed';
  const phase = currentPhase(o);
  switch (phase) {
    case 'upload':
      return 'Add the listing';
    case 'tailor': {
      const left = o.agenda.filter((a) => a.kind === 'story' && !a.done && !a.skipped).length;
      return left ? `${left} ${left === 1 ? 'story' : 'stories'} to tell` : 'Review the match';
    }
    case 'people': {
      const n = o.contacts.length;
      return n >= 3 ? 'Rank who to reach first' : `Find ${3 - n} more ${3 - n === 1 ? 'person' : 'people'}`;
    }
    case 'messaging': {
      const due = o.touches.filter((t) => t.status === 'due').length;
      if (due) return `${due} ${due === 1 ? 'touch' : 'touches'} due`;
      return o.touches.length ? 'Send the next touch' : 'Build the sequence';
    }
    case 'interview':
      return o.booked ? 'Practice answers' : 'Book the interview';
    case 'track':
      return 'Log the outcome';
  }
}

export function relativeDay(at: number | null, now = Date.now()): string {
  if (!at) return 'None';
  const days = Math.floor((now - at) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
}
