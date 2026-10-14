import type { Opportunity, Workspace } from '@/lib/types';

/* What changed since the last save, so a remote adapter writes rows rather
   than the whole workspace. The local adapter ignores it. */
export interface Changes {
  profile: boolean;
  opportunities: string[];
  removed: string[];
}

export interface DataAdapter {
  readonly kind: 'local' | 'supabase';
  /** null when this user has nothing saved yet */
  load(): Promise<Workspace | null>;
  save(ws: Workspace, changes: Changes): Promise<void>;
  /** stores a headshot and returns something an <img> can show */
  storePhoto(file: Blob): Promise<string>;
  /** keeps the original résumé file; returns where it went, or null */
  storeResume(file: File): Promise<string | null>;
  clear(): Promise<void>;
}

export function emptyChanges(): Changes {
  return { profile: false, opportunities: [], removed: [] };
}

export function touched(o: Opportunity): Opportunity {
  return { ...o, updatedAt: Date.now() };
}
