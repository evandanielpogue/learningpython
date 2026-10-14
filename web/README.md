# Frontdoor (web)

An account-based job search for salespeople. For each company: tailor your
proof to the listing, find the right people, write and send the outreach,
prepare for the interview, and track it through.

Next.js 16 (App Router), React 19, TypeScript (strict), Tailwind CSS 4 with
Radix primitives in the shadcn style, Zustand, Supabase, the Anthropic SDK,
Vitest and Playwright.

## Run it

```bash
cd web
npm install          # also copies the pdf.js worker into public/
npm run dev          # http://localhost:3000
```

With nothing configured, everything runs in the browser and every AI feature
falls back to pattern matching. Copy `.env.example` to `.env.local` to turn
things on:

| Variable | Turns on |
|---|---|
| `ANTHROPIC_API_KEY` | Claude for résumé reading, listing match, the story coach, interview questions, practice feedback, rewrites, and reading a posting from its link. Server only. |
| `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or `..._ANON_KEY`) | Accounts by email magic link, Postgres storage, and file storage for résumés and headshots. Apply `supabase/migrations/*.sql` first, and add `<your-origin>/auth/callback` to the project's redirect URLs. |

## Check it

```bash
npm run typecheck    # tsc, strict
npm run lint         # eslint
npm test             # vitest: the ported engine
npm run build
npm run test:e2e     # playwright against a production build (run build first)
```

In sandboxes without Playwright's own browser, point it at a local Chromium
with `PLAYWRIGHT_CHROMIUM=/path/to/chrome`.

## Where things are

| Path | What |
|---|---|
| `lib/types.ts` | The domain types everything shares |
| `lib/engine/` | Pure logic ported from the prototype: listing and résumé readers, matching, the story coach, people lookup, the outreach sequence, research sources, the example |
| `lib/ai/` | Prompts and schemas, the server-side model helper, request validation, and the browser client with local fallbacks |
| `lib/data/` | The data-access interface with a local (browser) adapter and a Supabase adapter, plus the Zustand store |
| `app/api/ai/*` | One route per AI feature; the key never reaches the browser |
| `app/start` | First login: the journey, résumé, headshot, first listing |
| `app/(app)/o/[id]` | One opportunity: the six steps as one page |
| `app/(app)/opportunities` | The CRM view: table and board |
| `components/flow/` | The six steps and the pieces they share |
| `supabase/migrations/` | Schema, row-level security and storage policies |
