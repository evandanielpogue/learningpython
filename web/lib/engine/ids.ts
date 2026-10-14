/* Small id and name helpers shared across the engine. */

/** A short random id with a readable prefix: `uid('r')` -> `r_k3j9x2`. */
export function uid(prefix?: string): string {
  return (prefix || 'x') + '_' + Math.random().toString(36).slice(2, 8);
}

/** Lowercase, hyphenated, at most 40 characters. */
export function slugify(s: string): string {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

/** Up to two capital letters from a name: "Evan Pogue" -> "EP". */
export function initials(name?: string | null): string {
  return String(name || '?')
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}
