import { describe, expect, it } from 'vitest';
import { initials, slugify, uid } from './ids';

describe('ids', () => {
  it('uid carries its prefix and differs between calls', () => {
    expect(uid('r')).toMatch(/^r_[a-z0-9]+$/);
    expect(uid()).toMatch(/^x_/);
    expect(uid('a')).not.toBe(uid('a'));
  });
  it('slugify lowercases, hyphenates and caps at 40', () => {
    expect(slugify('Evan Pogue & Acme, Inc.')).toBe('evan-pogue-acme-inc');
    expect(slugify('x'.repeat(60))).toHaveLength(40);
  });
  it('initials takes at most two letters', () => {
    expect(initials('Evan Pogue')).toBe('EP');
    expect(initials('Mary Jane Watson')).toBe('MJ');
    expect(initials('')).toBe('?');
    expect(initials(null)).toBe('?');
  });
});
