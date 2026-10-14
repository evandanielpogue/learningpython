import { describe, expect, it } from 'vitest';
import {
  INTERVIEW_SCHEMA, MATCH_SCHEMA, PREP_SCHEMA, REWRITE_SCHEMA, RESUME_SCHEMA, RESUME_SYSTEM,
  interviewContext, matchMessage, postingTool, prepHead, resumeMessage, rewriteMessage, storyIntro,
  type JsonSchema,
} from './prompts';

/** every `required` key must exist in `properties`, recursively */
function check(schema: JsonSchema, path = 'root'): void {
  const props = (schema.properties || {}) as Record<string, JsonSchema>;
  for (const k of (schema.required as string[] | undefined) || []) {
    expect(Object.keys(props), path + '.' + k).toContain(k);
  }
  expect(schema.additionalProperties ?? false, path).toBe(false);
  for (const [k, v] of Object.entries(props)) {
    if (v.type === 'object') check(v, path + '.' + k);
    if (v.type === 'array' && v.items && (v.items as JsonSchema).type === 'object') check(v.items as JsonSchema, path + '.' + k + '[]');
  }
}

describe('schemas', () => {
  it('are self-consistent', () => {
    for (const [name, s] of Object.entries({ RESUME_SCHEMA, MATCH_SCHEMA, PREP_SCHEMA, INTERVIEW_SCHEMA, REWRITE_SCHEMA })) {
      check(s, name);
    }
  });
  it('use the new field names', () => {
    expect(JSON.stringify(RESUME_SCHEMA)).toContain('"proof"');
    expect(JSON.stringify(RESUME_SCHEMA)).not.toContain('"wins"');
    expect(JSON.stringify(MATCH_SCHEMA)).toContain('"proofIds"');
    expect(JSON.stringify(MATCH_SCHEMA)).not.toContain('"winIds"');
  });
  it('keep the prompt prose as written', () => {
    expect(RESUME_SYSTEM).toContain('A win needs a number in it.');
  });
});

describe('message builders', () => {
  it('frame the résumé', () => {
    expect(resumeMessage('X')).toBe('Here is the resume:\n\n<resume>\nX\n</resume>');
  });
  it('lists proof by id for the match', () => {
    const m = matchMessage('L', [{ id: 'w1', text: 'Did a thing', where: 'Acme, 2023' }], [], ['Req one']);
    expect(m).toContain('w1: Did a thing (Acme, 2023)');
    expect(m).toContain('Requirements we already pulled out, if useful:\n- Req one');
  });
  it('frames a prep item and a story', () => {
    expect(prepHead({ role: 'AE', company: 'Acme' }, { kind: 'gap', label: 'MEDDPICC' })).toContain('This is a gap.');
    expect(storyIntro({ role: 'AE', company: 'Acme' }, { text: 'Did a thing' })).toContain('leading with: "Did a thing"');
  });
  it('builds the rewrite and interview contexts', () => {
    const r = rewriteMessage('shorter', 'Draft', { company: 'Acme', role: 'AE' }, { name: 'Dana', persona: 'Peer' }, [{ text: 'Cut cycles' }]);
    expect(r).toContain('Going to: Dana, Peer');
    expect(r).toContain('- Cut cycles');
    const c = interviewContext({
      role: 'AE', company: 'Acme', match: [], proof: [], people: [], research: [],
    });
    expect(c).toContain('(no requirements parsed)');
    expect(c).toContain('(nothing gathered)');
  });
  it('configures the fetch tool with the blocked list', () => {
    expect(postingTool(['linkedin.com'])).toMatchObject({ name: 'web_fetch', max_uses: 2, blocked_domains: ['linkedin.com'] });
  });
});
