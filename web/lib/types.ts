/* ==========================================================================
   Domain types. One source of truth shared by the engine (lib/engine), the
   data layer (lib/data), the AI routes (app/api/ai) and the UI.

   Naming: the prototype's "campaign" is an Opportunity here, and its "wins"
   are Proof. Field names otherwise follow the prototype so the port stays
   mechanical.
   ========================================================================== */

/* ---- the user ----------------------------------------------------------- */

export interface Role {
  id: string;
  title: string;
  company: string;
  span: string;
  on: boolean;
  bullets: string[];
}

/** A résumé result with a number in it. The prototype called these wins. */
export interface Proof {
  id: string;
  text: string;
  metric: string;
  short: string;
  where: string;
  tags: string[];
}

export interface Profile {
  name: string;
  email: string;
  phone: string;
  location: string;
  years: number;
  /** a data URL in the local adapter, a storage URL in the Supabase one */
  photo: string | null;
  imported: boolean;
  source: string | null;
  voice: { traits: string[] };
  roles: Role[];
  proof: Proof[];
  stack: string[];
}

export interface ParsedResume {
  name: string;
  email: string;
  phone: string;
  location: string;
  years: number;
  roles: Role[];
  proof: Proof[];
  stack: string[];
  voice: { traits: string[] };
  /** what the reader could not find, for the review screen */
  missing: string[];
}

/* ---- a job listing ------------------------------------------------------ */

export interface ParsedListing {
  role: string;
  company: string;
  location: string;
  req: string;
  requirements: string[];
  facts: string[];
}

export type Strength = 'strong' | 'partial' | 'none';

export interface Requirement {
  id: string;
  text: string;
  priority: 'must' | 'nice';
  strength: Strength;
  proofIds: string[];
  note: string;
}

export interface MatchScore {
  covered: number;
  total: number;
  gaps: Requirement[];
}

/* ---- the story coach ---------------------------------------------------- */

export interface AgendaItem {
  id: string;
  kind: 'story' | 'gap';
  /** a Proof id for a story, a Requirement id for a gap */
  ref: string;
  label: string;
  ask: string;
  text: string;
  done: boolean;
  skipped?: boolean;
}

export interface CoachTurn {
  role: 'coach' | 'user';
  text: string;
}

export interface CoachReply {
  bubbles: string[];
  /** true once enough has been said to write the story */
  complete: boolean;
  /** the story, written from what was said, once complete */
  story: string;
}

/* ---- people ------------------------------------------------------------- */

export type Persona = 'Peer' | 'Recruiter' | 'Hiring manager' | 'Skip level' | 'Shared tie' | 'Other';

export interface Activity {
  when: string;
  kind: string;
  text: string;
  use: string;
}

export interface Contact {
  id: string;
  name: string;
  title: string;
  persona: Persona;
  tenure: string;
  prev: string;
  mutuals: number;
  email: string;
  linkedin: string;
  ask: string;
  notes: string;
  activity: Activity[];
}

export interface Suggestion extends Omit<Contact, 'notes' | 'activity'> {
  placeholder: boolean;
  found: string;
  why: string;
  guessedEmail: boolean;
}

export interface ProfileRead {
  name: string;
  title: string;
  company: string;
  where: string;
  persona: Persona;
  linkedin: string;
}

/* ---- messaging ---------------------------------------------------------- */

export type Channel = 'Email' | 'LinkedIn' | 'Call' | 'Reply' | 'ATS' | 'Text';
export type TouchStatus = 'queued' | 'due' | 'sent' | 'replied' | 'skipped';

export interface Touch {
  id: string;
  day: number;
  contactId: string | null;
  templateId: string | null;
  channel: Channel;
  note: string;
  status: TouchStatus;
  subject: string;
  body: string;
  sentAt?: number;
}

export interface Template {
  id: string;
  name: string;
  persona: Persona;
  stage: string;
  channel: Channel;
  body: string;
  stock: boolean;
}

/* ---- research and interview -------------------------------------------- */

export interface Finding {
  id: string;
  date: string;
  kind: string;
  title: string;
  detail: string;
  source: string;
  use: string;
}

export interface LikelyQuestion {
  question: string;
  why: string;
  answer: string;
  gap: string;
}

export interface InterviewQuestions {
  likely: LikelyQuestion[];
  toAsk: { question: string; why: string }[];
  watch: string[];
  source: 'local' | 'claude';
}

export interface Practice {
  question: string;
  answer: string;
  feedback: string;
}

/* ---- an opportunity: one company, one role ------------------------------ */

export const PHASES = ['upload', 'tailor', 'people', 'messaging', 'interview', 'track'] as const;
export type PhaseKey = (typeof PHASES)[number];

export type Outcome = 'open' | 'offer' | 'hired' | 'closed';

export interface TimelineEvent {
  at: number;
  kind: 'created' | 'step' | 'sent' | 'reply' | 'booked' | 'outcome' | 'note';
  text: string;
}

export interface Opportunity {
  id: string;
  company: string;
  role: string;
  location: string;
  req: string;
  postingUrl: string;
  listing: string;
  facts: string[];
  requirements: Requirement[];
  proofIds: string[];
  agenda: AgendaItem[];
  /** coach conversations by agenda item id */
  chats: Record<string, CoachTurn[]>;
  contacts: Contact[];
  suggested: Suggestion[];
  touches: Touch[];
  research: Finding[];
  questions: InterviewQuestions | null;
  practice: Practice[];
  booked: boolean;
  outcome: Outcome;
  /** steps the user has finished, in the order they finished them */
  done: PhaseKey[];
  /** the step open on screen; usually the first unfinished one */
  open: PhaseKey;
  timeline: TimelineEvent[];
  example: boolean;
  createdAt: number;
  updatedAt: number;
}

/* ---- the whole workspace ------------------------------------------------ */

export interface Workspace {
  version: 1;
  profile: Profile;
  opportunities: Opportunity[];
  templates: Template[];
  onboarded: boolean;
  /** milestones already celebrated, so a cheer fires once */
  cheered: string[];
}
