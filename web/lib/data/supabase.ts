import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Opportunity, Profile, Template, Workspace } from '@/lib/types';
import type { DataAdapter } from './adapter';
import { SUPABASE_KEY, SUPABASE_URL } from './config';

/* Rows, not one blob: the profile in `profiles`, each company in
   `opportunities` with the columns the Opportunities view sorts on pulled
   out and the rest in `data`. Row-level security in the migration keeps
   every row to its owner. */

let client: SupabaseClient | null = null;
export function supabase(): SupabaseClient {
  if (!client) client = createBrowserClient(SUPABASE_URL, SUPABASE_KEY);
  return client;
}

interface ProfileRow {
  user_id: string;
  profile: Profile;
  templates: Template[];
  onboarded: boolean;
  cheered: string[];
}

interface OpportunityRow {
  id: string;
  user_id: string;
  company: string;
  role: string;
  location: string;
  open_phase: string;
  done_phases: string[];
  outcome: string;
  booked: boolean;
  example: boolean;
  data: Opportunity;
  created_at: string;
  updated_at: string;
}

function toRow(userId: string, o: Opportunity): OpportunityRow {
  return {
    id: o.id,
    user_id: userId,
    company: o.company,
    role: o.role,
    location: o.location,
    open_phase: o.open,
    done_phases: o.done,
    outcome: o.outcome,
    booked: o.booked,
    example: o.example,
    data: o,
    created_at: new Date(o.createdAt).toISOString(),
    updated_at: new Date(o.updatedAt).toISOString(),
  };
}

async function userId(): Promise<string> {
  const { data } = await supabase().auth.getUser();
  if (!data.user) throw new Error('Signed out.');
  return data.user.id;
}

export function supabaseAdapter(): DataAdapter {
  return {
    kind: 'supabase',
    async load() {
      const uid = await userId();
      const [p, o] = await Promise.all([
        supabase().from('profiles').select('*').eq('user_id', uid).maybeSingle<ProfileRow>(),
        supabase().from('opportunities').select('data').eq('user_id', uid).order('updated_at', { ascending: false }),
      ]);
      if (p.error) throw new Error(p.error.message);
      if (o.error) throw new Error(o.error.message);
      if (!p.data) return null;
      return {
        version: 1,
        profile: p.data.profile,
        templates: p.data.templates,
        onboarded: p.data.onboarded,
        cheered: p.data.cheered,
        opportunities: (o.data ?? []).map((r: { data: Opportunity }) => r.data),
      } satisfies Workspace;
    },
    async save(ws, changes) {
      const uid = await userId();
      const jobs: PromiseLike<{ error: { message: string } | null }>[] = [];
      if (changes.profile) {
        jobs.push(
          supabase().from('profiles').upsert({
            user_id: uid,
            profile: ws.profile,
            templates: ws.templates,
            onboarded: ws.onboarded,
            cheered: ws.cheered,
          }),
        );
      }
      const rows = ws.opportunities.filter((o) => changes.opportunities.includes(o.id)).map((o) => toRow(uid, o));
      if (rows.length) jobs.push(supabase().from('opportunities').upsert(rows));
      if (changes.removed.length) jobs.push(supabase().from('opportunities').delete().in('id', changes.removed));
      const results = await Promise.all(jobs);
      const failed = results.find((r) => r.error);
      if (failed?.error) throw new Error(failed.error.message);
    },
    async storePhoto(file) {
      const uid = await userId();
      const path = `${uid}/headshot-${Date.now()}.jpg`;
      const up = await supabase().storage.from('photos').upload(path, file, { upsert: true, contentType: file.type || 'image/jpeg' });
      if (up.error) throw new Error(up.error.message);
      const signed = await supabase().storage.from('photos').createSignedUrl(path, 60 * 60 * 24 * 365);
      if (signed.error) throw new Error(signed.error.message);
      return signed.data.signedUrl;
    },
    async storeResume(file) {
      const uid = await userId();
      const path = `${uid}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, '_')}`;
      const up = await supabase().storage.from('resumes').upload(path, file, { contentType: file.type || 'application/octet-stream' });
      if (up.error) throw new Error(up.error.message);
      return path;
    },
    async clear() {
      const uid = await userId();
      await supabase().from('opportunities').delete().eq('user_id', uid);
      await supabase().from('profiles').delete().eq('user_id', uid);
    },
  };
}
