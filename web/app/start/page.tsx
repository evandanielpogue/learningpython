'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, Camera } from 'lucide-react';
import { exampleOpportunity, exampleProfile } from '@/lib/engine';
import { useStore } from '@/lib/data/store';
import { Splash, useBoot } from '@/components/shell/boot';
import { Wordmark } from '@/components/brand/mark';
import { Headshot } from '@/components/brand/headshot';
import { Celebrations, celebrate } from '@/components/brand/celebrate';
import { Journey } from '@/components/onboarding/journey';
import { ResumeIntake } from '@/components/onboarding/resume-intake';
import { ListingIntake } from '@/components/flow/listing-intake';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';

/* First login. The whole journey, then the three things it is built from:
   the résumé, a face, and the first listing. */

type Stage = 'journey' | 'resume' | 'photo' | 'posting';
const STAGES: Stage[] = ['journey', 'resume', 'photo', 'posting'];
const TITLES: Record<Stage, string> = { journey: 'Welcome', resume: 'Résumé', photo: 'Headshot', posting: 'Company' };

function Dots({ stage }: { stage: Stage }) {
  const i = STAGES.indexOf(stage);
  return (
    <div className="flex items-center gap-1.5" aria-label={`Step ${i + 1} of ${STAGES.length}`}>
      {STAGES.map((s, j) => (
        <span key={s} className={cn('h-1.5 rounded-full transition-all duration-500', j === i ? 'w-6 bg-sea-bright' : j < i ? 'w-1.5 bg-sand-strong' : 'w-1.5 bg-line-2')} />
      ))}
    </div>
  );
}

export default function Start() {
  const router = useRouter();
  const { ready, status } = useBoot({ needsOnboarding: false });
  const ws = useStore((s) => s.ws);
  const adapter = useStore((s) => s.adapter);
  const setProfile = useStore((s) => s.setProfile);
  const setWorkspace = useStore((s) => s.setWorkspace);
  const addOpportunity = useStore((s) => s.addOpportunity);
  const [stage, setStage] = useState<Stage>('journey');
  const file = useRef<HTMLInputElement>(null);
  /* set when this page finishes onboarding itself and is on its way out */
  const leaving = useRef(false);

  /* someone already onboarded who lands here goes to their pipeline */
  useEffect(() => {
    if (ready && ws.onboarded && !leaving.current) router.replace('/opportunities');
  }, [ready, ws.onboarded, router]);

  if (!ready) return <Splash status={status} />;

  function tryExample() {
    const profile = { ...exampleProfile(), photo: ws.profile.photo };
    setProfile(profile);
    const o = exampleOpportunity(profile);
    addOpportunity(o);
    leaving.current = true;
    setWorkspace({ onboarded: true });
    router.push(`/o/${o.id}`);
  }

  async function photo(f: File | undefined) {
    if (!f || !adapter) return;
    try {
      setProfile({ photo: await adapter.storePhoto(f) });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not use that photo.');
    }
  }

  return (
    <div className="surf min-h-dvh">
      <header className="mx-auto flex max-w-[1080px] items-center justify-between px-4 py-5 md:px-8">
        <Wordmark />
        <Dots stage={stage} />
      </header>

      <main className="mx-auto max-w-[1080px] px-4 pb-16 md:px-8">
        <AnimatePresence mode="wait">
          <motion.div key={stage} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}>
            <h1 className="mb-8 text-[32px] font-[720] tracking-[-.035em] md:text-[40px]">{TITLES[stage]}</h1>

            {stage === 'journey' && (
              <div className="grid gap-10">
                <Card className="p-6 md:p-10">
                  <Journey />
                </Card>
                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="primary" size="lg" className="group" onClick={() => setStage('resume')}>
                    Upload your résumé <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
                  </Button>
                  <Button variant="ghost" size="lg" onClick={tryExample}>
                    Try the example
                  </Button>
                </div>
              </div>
            )}

            {stage === 'resume' && (
              <div className="max-w-[860px]">
                <ResumeIntake saveLabel="Continue" onSaved={() => { celebrate('Résumé in'); setStage('photo'); }} />
              </div>
            )}

            {stage === 'photo' && (
              <div className="max-w-[560px]">
                <Card className="grid justify-items-center gap-5 p-8 text-center">
                  <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 18 }} className="relative">
                    <span className="absolute -inset-2 rounded-full bg-gradient-to-br from-sea-bright via-sea-glow to-sand opacity-80" aria-hidden="true" />
                    <Headshot photo={ws.profile.photo} name={ws.profile.name} size={132} className="relative border-4 border-panel" />
                  </motion.div>
                  <p className="text-[15px] font-medium">{ws.profile.name || 'You'}</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button variant={ws.profile.photo ? 'secondary' : 'primary'} size="lg" onClick={() => file.current?.click()}>
                      <Camera /> {ws.profile.photo ? 'Replace' : 'Add a headshot'}
                    </Button>
                    {ws.profile.photo && (
                      <Button variant="primary" size="lg" className="group" onClick={() => setStage('posting')}>
                        Continue <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
                      </Button>
                    )}
                  </div>
                  {!ws.profile.photo && (
                    <button className="text-[13px] text-ink-3 underline-offset-4 hover:text-ink hover:underline" onClick={() => setStage('posting')}>
                      Later
                    </button>
                  )}
                  <input ref={file} type="file" accept="image/*" hidden onChange={(e) => photo(e.target.files?.[0])} />
                </Card>
              </div>
            )}

            {stage === 'posting' && (
              <div className="max-w-[860px]">
                <ListingIntake
                  onCreated={(o) => {
                    leaving.current = true;
                    setWorkspace({ onboarded: true });
                    celebrate(`${o.company} added`);
                    router.push(`/o/${o.id}`);
                  }}
                />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>
      <Celebrations />
    </div>
  );
}
