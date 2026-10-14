/* The ten pasted-listing fixtures from the prototype's e2e suite. */
export interface ListingFixture {
  name: string;
  want: Record<string, string | RegExp>;
  text: string;
}

export const LISTINGS: ListingFixture[] = [
  { name: 'LinkedIn', want: { company: 'HubSpot', role: /Account Executive/i, location: /Cambridge|MA/ }, text:
`Enterprise Account Executive
HubSpot · Cambridge, MA · Hybrid
Posted 3 days ago · Over 100 applicants

About the job
HubSpot is looking for an Enterprise Account Executive to join our growing sales team.

What we're looking for
- 5+ years of closing experience in SaaS
- Track record of carrying and hitting a $1M+ quota
- Experience selling to marketing and RevOps buyers
- Comfortable running a full cycle from first call to close` },

  { name: 'Prose one-liner', want: { company: 'Northwind Systems', role: /Enterprise Account Executive/i, location: /Chicago/ }, text:
`Northwind Systems is hiring an Enterprise Account Executive in Chicago.

Requirements:
- 7+ years SaaS sales
- Own a $2M annual number
- Run full cycle from first call to close` },

  { name: 'Company first (Greenhouse)', want: { company: 'HubSpot', role: /Account Executive/i, location: /Cambridge|MA/ }, text:
`HubSpot
Account Executive, Mid-Market
Cambridge, MA

Who you are
You have 3+ years of quota carrying software sales experience.
You are comfortable with a high volume of activity.
You have experience selling into mid-market accounts.` },

  { name: 'Indeed', want: { company: 'Stripe', role: /Account Executive/i, location: /Chicago|IL/ }, text:
`Account Executive
Stripe
Chicago, IL 60601
$140,000 - $210,000 a year
Full-time

Full job description

About the role
Stripe is looking for an Account Executive to help grow our mid-market business.

Qualifications
5+ years of full cycle sales experience
Experience with MEDDPICC or a similar qualification framework
Proven track record of exceeding quota` },

  { name: 'Labelled fields', want: { company: 'Acme Robotics', role: /Solutions Engineer/i, location: /Remote/i }, text:
`Job Title: Senior Solutions Engineer
Company: Acme Robotics
Location: Remote (US)
Department: Sales Engineering

Responsibilities
• Partner with Account Executives on technical discovery
• Build and deliver demos

Requirements
• 4+ years in a pre-sales role
• Strong Python and SQL` },

  { name: 'Careers page with pipes', want: { company: 'Brightline', role: /Account Executive/i, location: /Austin|TX/ }, text:
`Mid-Market Account Executive
Sales | Austin, TX | Full-time

Brightline is changing how teams buy software.

What you'll need
You have 4+ years of SaaS closing experience.
You have sold into mid-market organisations before.
You know how to run a multi-threaded evaluation.` },

  { name: 'All caps header', want: { company: 'Cobalt', role: /Account Executive/i, location: /New York|NY/ }, text:
`COBALT
ENTERPRISE ACCOUNT EXECUTIVE
NEW YORK, NY

ABOUT THE ROLE
We need someone who can own a $2.5M number.

WHAT YOU BRING
- 6+ years enterprise SaaS
- Experience with Salesforce and Gong` },

  { name: 'Join us prose', want: { company: 'Loom', role: /Sales Manager/i, location: /Remote/i }, text:
`Join Loom as a Sales Manager

We're remote-first and growing fast.

You'll need at least 5 years of experience leading a team of account executives.
You must be comfortable forecasting to the board.` },

  { name: 'Abbreviated title in prose', want: { company: 'Brightline', role: /Mid-Market AE/i, location: /Austin|TX/ }, text:
`Brightline is hiring an Mid-Market AE in Austin, TX.

Requirements:
- 5+ years SaaS sales
- Carry a quota` },
{ name: 'Bullet is never the title', want: { company: 'Vanta', role: /Sales Development Representative/i }, text:
`Vanta
Sales Development Representative

What you'll need
- 2+ years in a sales role
- Comfortable on the phone` }
];
