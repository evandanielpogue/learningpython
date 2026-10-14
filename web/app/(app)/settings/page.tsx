'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, Cloud, HardDrive, LogOut, Sparkles, Trash2 } from 'lucide-react';
import { useStore } from '@/lib/data/store';
import { aiOn } from '@/lib/ai/client';
import { Topbar } from '@/components/shell/topbar';
import { Headshot } from '@/components/brand/headshot';
import { ResumeIntake } from '@/components/onboarding/resume-intake';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Confirm } from '@/components/ui/dialog';
import { Field, Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toaster';

function Block({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card className="p-5 md:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold tracking-[-.012em]">{title}</h2>
        {aside}
      </div>
      {children}
    </Card>
  );
}

export default function Settings() {
  const router = useRouter();
  const profile = useStore((s) => s.ws.profile);
  const adapter = useStore((s) => s.adapter);
  const setProfile = useStore((s) => s.setProfile);
  const clearAll = useStore((s) => s.clearAll);
  const file = useRef<HTMLInputElement>(null);
  const [replacing, setReplacing] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [model, setModel] = useState<boolean | null>(null);

  useEffect(() => {
    void aiOn().then(setModel);
  }, []);

  async function photo(f: File | undefined) {
    if (!f || !adapter) return;
    try {
      setProfile({ photo: await adapter.storePhoto(f) });
      toast('Photo added');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not use that photo.');
    }
  }

  async function signOut() {
    const { supabase } = await import('@/lib/data/supabase');
    await supabase().auth.signOut();
    /* a full load, so the cached workspace and adapter go with the session */
    window.location.replace(new URL('/signin', window.location.origin).toString());
  }

  return (
    <>
      <Topbar title="Settings" />
      <main className="mx-auto grid w-full max-w-[860px] gap-4 px-4 py-6 md:px-8 md:py-8">
        <Block title="You">
          <div className="grid gap-5 sm:grid-cols-[auto_minmax(0,1fr)]">
            <div className="grid justify-items-center gap-2">
              <Headshot photo={profile.photo} name={profile.name} size={88} />
              <Button size="sm" variant={profile.photo ? 'secondary' : 'primary'} onClick={() => file.current?.click()}>
                <Camera /> {profile.photo ? 'Replace' : 'Add'}
              </Button>
              {profile.photo && (
                <Button size="sm" variant="ghost" onClick={() => setProfile({ photo: null })}>
                  Remove
                </Button>
              )}
              <input ref={file} type="file" accept="image/*" hidden onChange={(e) => photo(e.target.files?.[0])} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name" htmlFor="s-name">
                <Input id="s-name" value={profile.name} onChange={(e) => setProfile({ name: e.target.value })} />
              </Field>
              <Field label="Email" htmlFor="s-email">
                <Input id="s-email" type="email" value={profile.email} onChange={(e) => setProfile({ email: e.target.value })} />
              </Field>
              <Field label="Phone" htmlFor="s-phone">
                <Input id="s-phone" value={profile.phone} onChange={(e) => setProfile({ phone: e.target.value })} />
              </Field>
              <Field label="Location" htmlFor="s-loc">
                <Input id="s-loc" value={profile.location} onChange={(e) => setProfile({ location: e.target.value })} />
              </Field>
            </div>
          </div>
        </Block>

        <Block
          title="Résumé"
          aside={
            !replacing && (
              <Button size="sm" onClick={() => setReplacing(true)}>
                Replace
              </Button>
            )
          }
        >
          {replacing ? (
            <ResumeIntake
              onSaved={() => {
                setReplacing(false);
                toast('Résumé saved');
              }}
            />
          ) : (
            <div className="grid gap-3">
              <p className="text-[13.5px] text-ink-2">
                {profile.source ?? 'Nothing yet'} · {profile.roles.length} roles · {profile.proof.length} proof points
              </p>
              <ul className="divide-y divide-line">
                {profile.proof.map((p) => (
                  <li key={p.id} className="flex gap-4 py-2">
                    <b className="w-16 shrink-0 font-mono text-[13px] text-sea">{p.metric}</b>
                    <span className="text-[13.5px]">{p.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Block>

        <Block title="Claude" aside={model === null ? null : <Chip tone={model ? 'pos' : 'neutral'}>{model ? 'On' : 'Off'}</Chip>}>
          <div className="flex items-center gap-3 text-[13.5px] text-ink-2">
            <Sparkles className="size-4 shrink-0 text-sea" />
            {model ? 'Claude reads, matches, coaches and rewrites.' : 'Pattern matching. Set ANTHROPIC_API_KEY on the server to turn Claude on.'}
          </div>
        </Block>

        <Block title="Storage" aside={<Chip tone="sea">{adapter?.kind === 'supabase' ? 'Account' : 'This browser'}</Chip>}>
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex flex-1 items-center gap-3 text-[13.5px] text-ink-2">
              {adapter?.kind === 'supabase' ? <Cloud className="size-4 text-sea" /> : <HardDrive className="size-4 text-sea" />}
              {adapter?.kind === 'supabase' ? 'Saved to your account' : 'Saved in this browser only'}
            </span>
            {adapter?.kind === 'supabase' && (
              <Button size="sm" variant="ghost" onClick={signOut}>
                <LogOut /> Sign out
              </Button>
            )}
            <Button size="sm" variant="danger" onClick={() => setClearing(true)}>
              <Trash2 /> Clear all data
            </Button>
          </div>
        </Block>
      </main>

      <Confirm
        open={clearing}
        onOpenChange={setClearing}
        title="Clear all data?"
        body="Every company, your résumé and your headshot are deleted."
        confirm="Clear"
        onConfirm={async () => {
          await clearAll();
          router.replace('/start');
        }}
      />
    </>
  );
}
