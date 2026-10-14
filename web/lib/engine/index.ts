export { uid, slugify, initials } from './ids';
export { parseListing, fullRequirement } from './listing';
export { parseResume, fromModel, missingFrom, EXAMPLE_RESUME, TAGS, TOOLS } from './resume';
export type { ModelResume } from './resume';
export { rankProof, matchLocally, matchScore } from './match';
export type { RankedProof } from './match';
export { buildAgenda, answerAgenda, skipAgenda, stories, leadProof } from './agenda';
export * as coach from './coach';
export { opening, turn, summary, isFiller, bankable, questions } from './coach';
export type { CoachMessage, CoachResult, CoachContext, CoachStage } from './coach';
export { suggestFor, readProfile, lookupLinkedIn, colourFor, PERSONAS } from './people';
export type { PersonaKey, LookupResult, LookedUpPerson } from './people';
export {
  PLAN, buildSequence, fill, unresolved, logReply, refreshDue, bodyFor, templatesFor, dayOf, counts,
} from './sequence';
export type { PlanRow } from './sequence';
export { TEMPLATES } from './templates';
export * as sources from './sources';
export { noFetch, fetchable } from './sources';
export type { Source, SourceGroup, ParsedFinding, PasteMode, SourceAccess } from './sources';
export { exampleProfile, exampleOpportunity, ACME_LISTING, EXAMPLE_ANGLES } from './seed';
