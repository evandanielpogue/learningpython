'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { Camera, ChevronDown, FileText } from 'lucide-react';
import { useStore } from '@/lib/data/store';
import { Field, Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Headshot } from '@/components/brand/headshot';
import { toast } from '@/components/ui/toaster';
import { OpenStep } from './step-frame';
import type { StepProps } from './types';

/* Upload, reopened: the three things everything after it is built from.
   The résumé and the headshot belong to the person; the listing to this
   company. */
export function UploadStep({ o, onComplete }: StepProps) {
  const profile = useStore((s) => s.ws.profile);
  const adapter = useStore((s) => s.adapter);
  const setProfile = useStore((s) => s.setProfile);
  const update = useStore((s) => s.updateOpportunity);
  const file = useRef<HTMLInputElement>(null);
  const [showListing, setShowListing] = useState(false);

  async function photo(f: File | undefined) {
    if (!f || !adapter) return;
    try {
      setProfile({ photo: await adapter.storePhoto(f) });
      toast('Photo added');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not use that photo.');
    }
  }

  return (
    <OpenStep phase="upload" onContinue={onComplete} status={`${profile.proof.length} proof points · ${o.requirements.length} requirements`}>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex items-center gap-4 rounded-[14px] border border-line p-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-[12px] bg-sea-wash text-sea">
            <FileText className="size-6" />
          </span>
          <span className="grid min-w-0 flex-1">
            <b className="text-[14.5px]">Résumé</b>
            <span className="truncate text-[13px] text-ink-3">
              {profile.roles.length} roles · {profile.proof.length} proof points
            </span>
          </span>
          <Button asChild size="sm">
            <Link href="/settings">Replace</Link>
          </Button>
        </div>

        <div className="flex items-center gap-4 rounded-[14px] border border-line p-4">
          <Headshot photo={profile.photo} name={profile.name} size={48} />
          <span className="grid min-w-0 flex-1">
            <b className="text-[14.5px]">Headshot</b>
            <span className="text-[13px] text-ink-3">{profile.photo ? 'Added' : 'Missing'}</span>
          </span>
          <Button size="sm" variant={profile.photo ? 'secondary' : 'primary'} onClick={() => file.current?.click()}>
            <Camera /> {profile.photo ? 'Replace' : 'Add'}
          </Button>
          <input ref={file} type="file" accept="image/*" hidden onChange={(e) => photo(e.target.files?.[0])} />
        </div>
      </div>

      <div className="mt-4 grid gap-3 rounded-[14px] border border-line p-4 sm:grid-cols-3">
        <Field label="Company" htmlFor="u-company">
          <Input id="u-company" value={o.company} onChange={(e) => update(o.id, (x) => ({ ...x, company: e.target.value }))} />
        </Field>
        <Field label="Role" htmlFor="u-role">
          <Input id="u-role" value={o.role} onChange={(e) => update(o.id, (x) => ({ ...x, role: e.target.value }))} />
        </Field>
        <Field label="Location" htmlFor="u-location">
          <Input id="u-location" value={o.location} onChange={(e) => update(o.id, (x) => ({ ...x, location: e.target.value }))} />
        </Field>
        {o.listing && (
          <div className="sm:col-span-3">
            <button className="flex items-center gap-1.5 text-[13px] font-medium text-sea hover:text-sea-deep" onClick={() => setShowListing((s) => !s)} aria-expanded={showListing}>
              Listing <ChevronDown className={showListing ? 'size-4 rotate-180 transition' : 'size-4 transition'} />
            </button>
            {showListing && <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded-[10px] bg-sunk p-3 font-mono text-[12px] leading-relaxed text-ink-2">{o.listing}</pre>}
          </div>
        )}
      </div>
    </OpenStep>
  );
}
