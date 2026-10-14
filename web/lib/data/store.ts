'use client';

import { create } from 'zustand';
import type { Opportunity, PhaseKey, Profile, Template, TimelineEvent, Workspace } from '@/lib/types';
import { PHASES } from '@/lib/types';
import { type Changes, type DataAdapter, emptyChanges } from './adapter';
import { localAdapter } from './local';
import { supabaseEnabled } from './config';

/* One workspace in memory, saved through whichever adapter is on. Writes are
   batched: every change marks what it touched, and a short debounce sends
   only those rows. */

export type Status = 'loading' | 'ready' | 'signedout' | 'error';

export function blankProfile(): Profile {
  return {
    name: '',
    email: '',
    phone: '',
    location: '',
    years: 0,
    photo: null,
    imported: false,
    source: null,
    voice: { traits: [] },
    roles: [],
    proof: [],
    stack: [],
  };
}

export function blankWorkspace(templates: Template[]): Workspace {
  return { version: 1, profile: blankProfile(), opportunities: [], templates, onboarded: false, cheered: [] };
}

interface State {
  status: Status;
  error: string | null;
  adapter: DataAdapter | null;
  ws: Workspace;
  saving: boolean;
  saveError: string | null;

  init(templates: Template[]): Promise<void>;
  setProfile(patch: Partial<Profile>): void;
  setWorkspace(patch: Partial<Pick<Workspace, 'onboarded' | 'templates'>>): void;
  addOpportunity(o: Opportunity): void;
  updateOpportunity(id: string, fn: (o: Opportunity) => Opportunity): void;
  removeOpportunity(id: string): void;
  completePhase(id: string, key: PhaseKey): PhaseKey | null;
  openPhase(id: string, key: PhaseKey): void;
  /** true the first time a milestone is seen, so a celebration fires once */
  cheer(key: string): boolean;
  clearAll(): Promise<void>;
}

let pending: Changes = emptyChanges();
let timer: ReturnType<typeof setTimeout> | null = null;

function mark(part: Partial<Changes>) {
  if (part.profile) pending.profile = true;
  for (const id of part.opportunities ?? []) if (!pending.opportunities.includes(id)) pending.opportunities.push(id);
  for (const id of part.removed ?? []) if (!pending.removed.includes(id)) pending.removed.push(id);
}

function event(kind: TimelineEvent['kind'], text: string): TimelineEvent {
  return { at: Date.now(), kind, text };
}

export const useStore = create<State>((set, get) => {
  async function flush() {
    if (timer) clearTimeout(timer);
    timer = null;
    const { adapter, ws } = get();
    if (!adapter) return;
    const changes = pending;
    if (!changes.profile && !changes.opportunities.length && !changes.removed.length) return;
    pending = emptyChanges();
    set({ saving: true });
    try {
      await adapter.save(ws, changes);
      set({ saving: false, saveError: null });
    } catch (e) {
      /* put the changes back so the next write retries them */
      mark(changes);
      set({ saving: false, saveError: e instanceof Error ? e.message : 'Could not save.' });
    }
  }

  function schedule(part: Partial<Changes>) {
    mark(part);
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void flush(), 350);
  }

  /* leaving or hiding the page writes anything still waiting, so a reload
     straight after a change never loses it */
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', () => void flush());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') void flush();
    });
  }

  return {
    status: 'loading',
    error: null,
    adapter: null,
    ws: blankWorkspace([]),
    saving: false,
    saveError: null,

    async init(templates) {
      if (get().adapter) return;
      try {
        let adapter: DataAdapter;
        if (supabaseEnabled) {
          const mod = await import('./supabase');
          const { data } = await mod.supabase().auth.getUser();
          if (!data.user) {
            set({ status: 'signedout' });
            return;
          }
          adapter = mod.supabaseAdapter();
        } else {
          adapter = localAdapter();
        }
        const loaded = await adapter.load();
        const ws = loaded ?? blankWorkspace(templates);
        if (!ws.templates?.length) ws.templates = templates;
        set({ adapter, ws, status: 'ready' });
        if (!loaded) schedule({ profile: true });
      } catch (e) {
        set({ status: 'error', error: e instanceof Error ? e.message : 'Could not load.' });
      }
    },

    setProfile(patch) {
      set((s) => ({ ws: { ...s.ws, profile: { ...s.ws.profile, ...patch } } }));
      schedule({ profile: true });
    },

    setWorkspace(patch) {
      set((s) => ({ ws: { ...s.ws, ...patch } }));
      schedule({ profile: true });
    },

    addOpportunity(o) {
      set((s) => ({ ws: { ...s.ws, opportunities: [o, ...s.ws.opportunities] } }));
      schedule({ opportunities: [o.id] });
    },

    updateOpportunity(id, fn) {
      set((s) => ({
        ws: {
          ...s.ws,
          opportunities: s.ws.opportunities.map((o) => (o.id === id ? { ...fn(o), updatedAt: Date.now() } : o)),
        },
      }));
      schedule({ opportunities: [id] });
    },

    removeOpportunity(id) {
      set((s) => ({ ws: { ...s.ws, opportunities: s.ws.opportunities.filter((o) => o.id !== id) } }));
      schedule({ removed: [id] });
    },

    completePhase(id, key) {
      const i = PHASES.indexOf(key);
      const following = PHASES.slice(i + 1);
      let opened: PhaseKey | null = null;
      get().updateOpportunity(id, (o) => {
        const done = o.done.includes(key) ? o.done : [...o.done, key];
        /* open the next unfinished step after this one, else the first
           unfinished one anywhere, else stay on Track */
        opened = following.find((k) => !done.includes(k)) ?? PHASES.find((k) => !done.includes(k)) ?? null;
        return {
          ...o,
          done,
          open: opened ?? 'track',
          timeline: [...o.timeline, event('step', key)],
        };
      });
      return opened;
    },

    openPhase(id, key) {
      get().updateOpportunity(id, (o) => ({ ...o, open: key }));
    },

    cheer(key) {
      const { ws } = get();
      if (ws.cheered.includes(key)) return false;
      set({ ws: { ...ws, cheered: [...ws.cheered, key] } });
      schedule({ profile: true });
      return true;
    },

    async clearAll() {
      const { adapter } = get();
      if (timer) clearTimeout(timer);
      pending = emptyChanges();
      await adapter?.clear();
      set((s) => ({ ws: blankWorkspace(s.ws.templates) }));
    },
  };
});

export function useOpportunity(id: string): Opportunity | undefined {
  return useStore((s) => s.ws.opportunities.find((o) => o.id === id));
}
