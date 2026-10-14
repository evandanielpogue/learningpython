import { describe, expect, it } from 'vitest';
import { TEMPLATES } from './templates';

describe('TEMPLATES', () => {
  it('has the nine stock templates, each flagged stock', () => {
    expect(TEMPLATES).toHaveLength(9);
    expect(TEMPLATES.every((t) => t.stock)).toBe(true);
    expect(new Set(TEMPLATES.map((t) => t.id)).size).toBe(9);
  });
  it('only uses placeholders the filler knows', () => {
    const known = new Set(['first', 'name', 'title', 'company', 'role', 'slug', 'angle', 'win', 'me']);
    for (const t of TEMPLATES) {
      for (const m of t.body.matchAll(/\{(\w+)\}/g)) expect(known.has(m[1])).toBe(true);
    }
  });
});
