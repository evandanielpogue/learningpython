/* ==========================================================================
   Reading a job posting.

   People paste whatever the site gave them: LinkedIn's "Role / Company ·
   Place", Greenhouse with the company first, Indeed with a salary line in
   the middle, a careers page with pipes, a labelled form, or one sentence
   of prose.

   Nothing here guesses wildly: when a field cannot be found it is left
   empty and the screen asks for it, because a wrong company name is worse
   than a blank one.
   ========================================================================== */
import type { ParsedListing } from '../types';

/* ---- words that make a line a job title ---- */
const ROLE = new RegExp(
  '\\b(account executive|sales|engineer|developer|designer|manager|' +
    'director|analyst|specialist|representative|consultant|architect|scientist|coordinator|' +
    'associate|partner|officer|lead|head of|vp|vice president|president|founder|recruiter|' +
    'marketer|controller|accountant|technician|administrator|strategist|producer|editor|' +
    'writer|counsel|advisor|planner|buyer|supervisor|principal|intern|nurse|teacher|' +
    'attorney|paralegal|solutions|success|support|operations|product|program|project|' +
    'ae|sdr|bdr|csm|pm|cto|ceo|cfo|coo|cro|cmo)\\b',
  'i',
);

/* chrome the sites wrap a posting in, which is never a title or a name */
const CHROME = new RegExp(
  '^(apply( now)?|share|save( job)?|back to .*|jobs?|careers?|home|' +
    'menu|search|sign in|log ?in|easy apply|show more|see more|posted.*|' +
    'full[- ]?time|part[- ]?time|contract|internship|permanent|temporary|' +
    '\\d[\\d,]*\\+? applicants?|over \\d[\\d,]* applicants?|' +
    '[\\d,]+ (second|minute|hour|day|week|month)s? ago|' +
    '\\$[\\d,]+.*(a year|per year|annually|/yr|- ?\\$[\\d,]+).*|' +
    'full job description|equal opportunity.*|department.*)$',
  'i',
);

/* headings that introduce the things they are asking for */
const REQ_HEAD = new RegExp(
  '^(requirements?|qualifications?|minimum qualifications?|' +
    'basic qualifications?|preferred qualifications?|what you.{0,14}(need|bring|have)|' +
    'who you are|about you|we.{0,4}re looking for|what we.{0,4}re looking for|' +
    "must haves?|you have|you.{0,4}ll need|skills( and experience)?|experience)\\b\\s*:?\\s*$",
  'i',
);

/* any other heading ends the list */
const SECTION = new RegExp(
  '^(about|responsibilities|what you.{0,14}do|the role|' +
    'benefits?|perks?|compensation|salary|pay|why|our|how to apply|interview|' +
    'nice to have|bonus points|equal opportunity|we offer)\\b',
  'i',
);

const LOC = /\b(remote|hybrid|on-?site|in[- ]office)\b/i;
/* "You have 3+ years" opens like a company sentence and is not one */
const PRONOUN = /^(you|we|they|it|this|that|our|your|their|the|there|here|i)$/i;
const CITY_RE = /\b([A-Z][A-Za-z.\-']+(?:\s+[A-Z][A-Za-z.\-']+)?,\s*(?:[A-Z]{2}\b|[A-Z][a-z]+))/;

const BULLET = /^[-–—•*·▪●○]\s*/;
const BULLET_LINE = /^([-–—•*·▪●○]\s+|\d+[.)]\s+)/;

/* "Account Executive, Mid-Market" has the shape of "Cambridge, MA" and
   is not a place, so anything with a job word in it is refused */
function CITY(t: string): RegExpExecArray | null {
  const g = new RegExp(CITY_RE.source, 'g');
  let hit: RegExpExecArray | null;
  while ((hit = g.exec(String(t || '')))) {
    if (!ROLE.test(hit[1])) return hit;
  }
  return null;
}

function clean(s: string | undefined | null): string {
  return String(s || '')
    .replace(/\s+/g, ' ')
    .replace(/[\s.,;:|·—–-]+$/, '')
    .trim();
}

/* SHOUTED LINES come back as Shouted Lines; anything else is left alone */
function unshout(s: string): string {
  if (!s || s !== s.toUpperCase() || !/[A-Z]{3}/.test(s)) return s;
  return s.toLowerCase().replace(/\b[a-z]/g, (m) => m.toUpperCase());
}

function isTitle(l: string): boolean {
  if (!l || l.length < 3 || l.length > 80) return false;
  /* a bullet is a requirement, however many job words it contains */
  if (/^([-–—•*·▪●○]\s|\d+[.)]\s)/.test(l)) return false;
  if (CHROME.test(l) || REQ_HEAD.test(l) || SECTION.test(l)) return false;
  if (/[.!?]$/.test(l)) return false; /* a sentence, not a title */
  if (l.split(/\s+/).length > 11) return false;
  return ROLE.test(l);
}

const FACTS: [RegExp, string][] = [
  [/\byears?\b/i, 'Years of experience called out'],
  [/\bquota\b/i, 'Carries a number'],
  [/\bmid[- ]market\b/i, 'Mid-market segment'],
  [/\benterprise\b/i, 'Enterprise segment'],
  /* the prototype's /\bpricing|packaging|reprice\b/ let the boundaries bind
     to only the first and last alternative */
  [/\b(?:pricing|packaging|reprice)\b/i, 'Pricing change in play'],
  [/\bramp\b/i, 'Ramp is on their mind'],
  [/\bremote\b/i, 'Remote friendly'],
];

/** Read a pasted listing. Crude on purpose: it has to fail gracefully on
    whatever someone actually pastes. */
export function parseListing(text: string): ParsedListing {
  const raw = String(text || '').replace(/\r/g, '').trim();
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
  const out: ParsedListing = { role: '', company: '', location: '', req: '', requirements: [], facts: [] };
  if (!lines.length) return out;

  function labelled(name: string): string {
    const m = raw.match(new RegExp('^\\s*(?:' + name + ')\\s*[:\\-]\\s*(.+)$', 'im'));
    return m ? clean(m[1]) : '';
  }

  /* ---- the role ---- */
  out.role = labelled('(?:job\\s*)?title|position|role');
  if (!out.role) {
    /* "… is hiring an Enterprise Account Executive in Chicago" */
    const pro = raw.match(
      new RegExp(
        '\\b(?:hiring|seeking|looking for|recruiting|' +
          'join .{1,40} as)\\s+(?:an?|our next|a new)?\\s*([A-Z][^.,;\\n]{2,60}?)' +
          '(?=\\s+(?:in|at|to|who|based|for|on)\\b|[.,;\\n]|$)',
        'i',
      ),
    );
    if (pro && ROLE.test(pro[1])) out.role = clean(pro[1]);
  }
  if (!out.role) {
    for (let i = 0; i < Math.min(lines.length, 12); i++) {
      /* a title line may still carry "· Company · Place" after it */
      const head = lines[i].split(/\s+[·|]\s+|\s+[—–]\s+/)[0].trim();
      if (isTitle(head)) {
        out.role = clean(head);
        break;
      }
    }
  }
  out.role = unshout(out.role).slice(0, 70);

  /* ---- the company ---- */
  out.company = labelled('company|employer|organi[sz]ation');
  if (!out.company) {
    const m = raw.match(
      /^\s*([A-Z][A-Za-z0-9&.,'\-]*(?:\s+[A-Z][A-Za-z0-9&.,'\-]*){0,3})\s+(?:is|are)\s+(?:hiring|looking|seeking|searching|growing)/m,
    );
    if (m) out.company = clean(m[1]);
    if (!out.company) {
      /* the sentence a posting opens its "about" with: "Brightline is
         changing how teams buy software" */
      const ab2 = raw.match(
        /^\s*([A-Z][A-Za-z0-9&.'\-]*(?:\s+[A-Z][A-Za-z0-9&.'\-]*){0,2})\s+(?:is|are|was|were|helps?|makes?|builds?|powers?|serves?|sells?)\s+[a-z]/m,
      );
      if (ab2 && !ROLE.test(ab2[1]) && !CHROME.test(ab2[1]) && !PRONOUN.test(ab2[1])) {
        out.company = clean(ab2[1]);
      }
    }
  }
  if (!out.company) {
    const j = raw.match(/\b[Jj]oin\s+([A-Z][A-Za-z0-9&.'\-]*(?:\s+[A-Z][A-Za-z0-9&.'\-]*){0,2})\b/);
    if (j) out.company = clean(j[1]);
  }
  if (!out.company && out.role) {
    /* "Enterprise Account Executive at HubSpot" */
    const at = raw.match(/\bat\s+([A-Z][A-Za-z0-9&.'\-]*(?:\s+[A-Z][A-Za-z0-9&.'\-]*){0,2})\b/);
    if (at && !LOC.test(at[1]) && !CITY(at[1] + ', XX')) out.company = clean(at[1]);
  }
  if (!out.company) {
    const ab = raw.match(
      /^\s*about\s+(?!the\b|us\b|this\b|our\b)([A-Z][A-Za-z0-9&.'\-]*(?:\s+[A-Z][A-Za-z0-9&.'\-]*){0,2})\s*$/im,
    );
    if (ab) out.company = clean(ab[1]);
  }
  if (!out.company) {
    /* a "Role · Company · Place" or "Company · Place" strip near the top */
    for (let k = 0; k < Math.min(lines.length, 6) && !out.company; k++) {
      const parts = lines[k].split(/\s*[·|]\s*/).map(clean).filter(Boolean);
      if (parts.length < 2) continue;
      for (let q = 0; q < parts.length; q++) {
        const pt = parts[q];
        if (!pt || pt === out.role) continue;
        if (LOC.test(pt) || CITY(pt) || CHROME.test(pt)) continue;
        if (ROLE.test(pt)) continue;
        if (!/^[A-Z]/.test(pt) || pt.split(/\s+/).length > 4) continue;
        out.company = pt;
        break;
      }
    }
  }
  if (!out.company) {
    /* a short standalone name sitting next to the title line */
    const at3 = lines.indexOf(lines.find(isTitle) ?? '');
    [at3 - 1, at3 + 1, 0].forEach((n) => {
      if (out.company || n < 0 || n >= lines.length) return;
      const l = clean(lines[n].split(/\s*[·|]\s*/)[0]);
      if (!l || l.length > 40 || l === out.role) return;
      if (CHROME.test(l) || REQ_HEAD.test(l) || SECTION.test(l)) return;
      if (ROLE.test(l) || LOC.test(l) || CITY(l)) return;
      if (/[.!?,]$/.test(l) || l.split(/\s+/).length > 4) return;
      if (!/^[A-Z0-9]/.test(l)) return;
      out.company = l;
    });
  }
  out.company = unshout(out.company).slice(0, 40);

  /* ---- where ---- */
  out.location = labelled('location|based in|office');
  if (!out.location) {
    const city = CITY(raw);
    if (city) out.location = clean(city[1]);
  }
  if (!out.location) {
    const inl = raw.match(
      /\bin\s+([A-Z][A-Za-z\-']+(?:\s+[A-Z][A-Za-z\-']+)?)(?=[.,;\n]|\s+(?:and|or)\b|$)/,
    );
    if (inl && !ROLE.test(inl[1])) out.location = clean(inl[1]);
  }
  if (!out.location) {
    const l2 = raw.match(LOC);
    if (l2) out.location = clean(l2[1]);
  } else if (LOC.test(raw) && !LOC.test(out.location)) {
    out.location += ', ' + (raw.match(LOC) as RegExpMatchArray)[1].toLowerCase();
  }
  out.location = out.location.slice(0, 40);

  const reqid = raw.match(/\breq(?:uisition)?\.?\s*#?\s*([A-Za-z0-9-]{2,12})/i);
  if (reqid) out.req = reqid[1];

  /* ---- what they are asking for ------------------------------------
     Bullets when there are bullets, the lines under a "Requirements"
     heading when there are not, and failing both, the sentences that
     read like a requirement. */
  function add(t: string): void {
    const b = clean(String(t).replace(BULLET, '').replace(/^\d+[.)]\s*/, ''));
    if (b.length < 8 || out.requirements.length >= 8) return;
    if (REQ_HEAD.test(b) || SECTION.test(b)) return;
    if (out.requirements.includes(b)) return;
    out.requirements.push(b.length > 160 ? b.slice(0, 156).replace(/\s\S*$/, '') + '…' : b);
  }

  lines.forEach((l) => {
    if (BULLET_LINE.test(l)) add(l);
  });

  if (!out.requirements.length) {
    let on = false;
    lines.forEach((l) => {
      if (REQ_HEAD.test(l)) {
        on = true;
        return;
      }
      if (on && SECTION.test(l)) {
        on = false;
        return;
      }
      if (on) add(l);
    });
  }

  if (!out.requirements.length) {
    const HINT = new RegExp(
      '\\b(\\d+\\+?\\s*years?|experience|must|proficien|familiar|' +
        'track record|ability to|quota|comfortable|you have|you.{0,4}ll|we need|' +
        'looking for someone|strong)\\b',
      'i',
    );
    raw.split(/(?<=[.!?])\s+|\n/).forEach((sn) => {
      if (HINT.test(sn)) add(sn);
    });
  }

  FACTS.forEach(([re, label]) => {
    if (re.test(raw) && out.facts.length < 5) out.facts.push(label);
  });

  return out;
}

/** A requirement saved before the reader kept whole lines ends in "…"; the
    full line is still in the listing, so find it there. */
export function fullRequirement(listing: string | null | undefined, text: string): string {
  const t = String(text || '');
  if (!/…$/.test(t) || !listing) return t;
  const head = t.replace(/…$/, '').trim().toLowerCase();
  const hit = String(listing)
    .replace(/\r/g, '')
    .split('\n')
    .map((l) =>
      l
        .replace(/^[\s\-–—•*·▪●○]+|^\s*\d+[.)]\s*/g, '')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .find((l) => l.toLowerCase().indexOf(head) === 0);
  return hit || t;
}
