'use client';

import type { Opportunity, ParsedListing, Profile, Requirement } from '@/lib/types';
import { buildAgenda, suggestFor, uid } from '@/lib/engine';

export interface NewOpportunity {
  listing: string;
  postingUrl: string;
  parsed: ParsedListing;
  company: string;
  role: string;
  location: string;
  requirements: Requirement[];
  proofIds: string[];
}

/* A company enters the journey with Upload done and Tailor open: the
   listing is in, the match is drawn, the stories are queued. */
export function createOpportunity(input: NewOpportunity, profile: Profile): Opportunity {
  const now = Date.now();
  const base: Opportunity = {
    id: uid('o'),
    company: input.company.trim(),
    role: input.role.trim(),
    location: input.location.trim(),
    req: input.parsed.req,
    postingUrl: input.postingUrl,
    listing: input.listing,
    facts: input.parsed.facts,
    requirements: input.requirements,
    proofIds: input.proofIds,
    agenda: [],
    chats: {},
    contacts: [],
    suggested: suggestFor(input.company.trim(), input.role.trim()),
    touches: [],
    research: [],
    questions: null,
    practice: [],
    booked: false,
    outcome: 'open',
    done: ['upload'],
    open: 'tailor',
    timeline: [{ at: now, kind: 'created', text: `Added ${input.company.trim()}` }],
    example: false,
    createdAt: now,
    updatedAt: now,
  };
  return { ...base, agenda: buildAgenda(base, profile.proof) };
}

/* When the proof an opportunity leads with changes, rebuild the stories
   queue but keep every story already told. */
export function rebuildAgenda(o: Opportunity, profile: Profile): Opportunity {
  const fresh = buildAgenda({ ...o, agenda: [] }, profile.proof);
  const kept = fresh.map((item) => o.agenda.find((a) => a.kind === item.kind && a.ref === item.ref) ?? item);
  return { ...o, agenda: kept };
}
