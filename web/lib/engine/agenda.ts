/* ==========================================================================
   The things worth nailing down before you write: one story per proof point
   you are leading with, and one per gap nothing on the résumé answers.

   Everything here is a pure updater: it takes an opportunity and returns a
   new one, and never mutates its input.
   ========================================================================== */
import type { AgendaItem, Opportunity, Proof } from '../types';
import { uid } from './ids';
import { matchScore } from './match';

/** The proof points an opportunity leads with, in the order it lists them. */
export function leadProof(opportunity: Pick<Opportunity, 'proofIds'>, proof: Proof[]): Proof[] {
  return (opportunity.proofIds || [])
    .map((id) => proof.find((p) => p.id === id))
    .filter((p): p is Proof => !!p);
}

/** The agenda: what is already on the opportunity, or a fresh one built from
    the proof it leads with and the gaps in its match. `proof` is the whole
    proof list; the opportunity's `proofIds` pick which of it to lead with. */
export function buildAgenda(opportunity: Opportunity, proof: Proof[]): AgendaItem[] {
  if (opportunity.agenda && opportunity.agenda.length) return opportunity.agenda;
  const items: AgendaItem[] = [];

  /* one per proof point you are leading with: the detail the bullet leaves out */
  leadProof(opportunity, proof).forEach((w) => {
    items.push({
      id: uid('ag'), kind: 'story', ref: w.id,
      label: w.text, ask: 'What actually happened behind this', text: '', done: false,
    });
  });

  /* one per thing the listing wants that nothing on the résumé answers */
  matchScore(opportunity.requirements).gaps.slice(0, 4).forEach((r) => {
    items.push({
      id: uid('ag'), kind: 'gap', ref: r.id,
      label: r.text, ask: 'Nothing on your résumé answers this', text: '', done: false,
    });
  });

  return items;
}

/** Everything they have told us, for the page and the messages. */
export function stories(opportunity: Pick<Opportunity, 'agenda'> | null | undefined): AgendaItem[] {
  return ((opportunity && opportunity.agenda) || []).filter((x) => x.done && x.text);
}

/** Record an answer. An empty answer un-does the item. */
export function answerAgenda(opportunity: Opportunity, id: string, text: string): Opportunity {
  if (!(opportunity.agenda || []).some((x) => x.id === id)) return opportunity;
  return {
    ...opportunity,
    agenda: opportunity.agenda.map((x) =>
      x.id === id ? { ...x, text, done: !!(text && text.trim()) } : x,
    ),
  };
}

/** Leaving an item is a decision, and a decision is recorded. */
export function skipAgenda(opportunity: Opportunity, id: string): Opportunity {
  if (!(opportunity.agenda || []).some((x) => x.id === id)) return opportunity;
  return {
    ...opportunity,
    agenda: opportunity.agenda.map((x) => (x.id === id ? { ...x, skipped: true } : x)),
  };
}
