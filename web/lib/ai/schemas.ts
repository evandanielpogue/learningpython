import { z } from 'zod';

/* What each model call must return. The routes validate against these, so
   the browser only ever sees well-formed data. */

export const ResumeOut = z.object({
  name: z.string().describe('Their full name. Empty string if it is not in the document.'),
  email: z.string(),
  phone: z.string(),
  location: z.string().describe('City and state or country, as written.'),
  years: z.number().int().describe('Total years of professional experience, worked out from the dates. 0 if unclear.'),
  roles: z
    .array(
      z.object({
        title: z.string(),
        company: z.string().describe('Company, and location if given.'),
        span: z.string().describe('Like "2023 to now" or "2021 to 2023".'),
        bullets: z.array(z.string()).describe('What they did there, cleaned up but not reworded.'),
      }),
    )
    .describe('Every job, most recent first.'),
  proof: z
    .array(
      z.object({
        text: z.string().describe('The full bullet with the result in it, as written.'),
        metric: z.string().describe('The number that makes it proof, short: "$1.2M", "112%", "30→70", "Top 3".'),
        short: z.string().describe('Five to eight lowercase words for what the number was about.'),
        where: z.string().describe('Company and span of the role it came from.'),
        tags: z.array(z.string()).describe('Lowercase skills this shows: discovery, pricing, ramp, quota, enterprise.'),
      }),
    )
    .describe('Up to twelve results that carry a number, strongest first.'),
  tools: z.array(z.string()).describe('Sales tools and methods named anywhere.'),
  voice: z.array(z.string()).describe('Up to four short traits of how they write: "Short lines", "Numbers first".'),
});
export type ResumeOut = z.infer<typeof ResumeOut>;

export const MatchOut = z.object({
  requirements: z.array(
    z.object({
      text: z.string().describe('The requirement, copied whole from the listing.'),
      priority: z.enum(['must', 'nice']),
      strength: z.enum(['strong', 'partial', 'none']),
      proofIds: z.array(z.string()).describe('Ids of the proof points that answer it, strongest first.'),
      note: z.string().describe('One short sentence on how they line up, or what to say about the gap. Empty when obvious.'),
    }),
  ),
});
export type MatchOut = z.infer<typeof MatchOut>;

export const CoachOut = z.object({
  bubbles: z.array(z.string()).describe('One to three short chat messages from the coach, in order.'),
  complete: z.boolean().describe('True once there is enough to write the story.'),
  story: z.string().describe('When complete, the story in their words, first person, four to six sentences. Otherwise empty.'),
});
export type CoachOut = z.infer<typeof CoachOut>;

export const QuestionsOut = z.object({
  likely: z
    .array(
      z.object({
        question: z.string(),
        why: z.string().describe('Why this company will ask it, in one line.'),
        answer: z.string().describe('What to lead with, built from their proof and stories. Empty if nothing fits.'),
        gap: z.string().describe('What is missing to answer it well. Empty if nothing.'),
      }),
    )
    .describe('Six to nine questions they will probably be asked.'),
  toAsk: z.array(z.object({ question: z.string(), why: z.string() })).describe('Three questions worth asking them.'),
  watch: z.array(z.string()).describe('Two or three things to be careful about in this interview.'),
});
export type QuestionsOut = z.infer<typeof QuestionsOut>;

export const PracticeOut = z.object({
  feedback: z.string().describe('Two to four sentences: what landed, what to tighten, the number or detail that is missing.'),
  stronger: z.string().describe('The same answer, tightened, in their voice, under 120 words.'),
});
export type PracticeOut = z.infer<typeof PracticeOut>;

export const RewriteOut = z.object({
  subject: z.string().describe('A subject line for email, empty for other channels.'),
  body: z.string().describe('The rewritten message. Keep any [bracketed placeholder] the writer still has to fill.'),
});
export type RewriteOut = z.infer<typeof RewriteOut>;

export const PostingOut = z.object({
  found: z.boolean().describe('False when the page could not be read or held no job posting.'),
  text: z.string().describe('The posting as plain text: title, company, location, then the full description and requirements.'),
});
export type PostingOut = z.infer<typeof PostingOut>;
