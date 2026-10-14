'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowUpRight, MoreHorizontal, Trash2 } from 'lucide-react';
import { useOpportunity, useStore } from '@/lib/data/store';
import type { PhaseKey } from '@/lib/types';
import type { StepProps } from '@/components/flow/types';
import { PHASES } from '@/lib/types';
import { PHASE_META, progress } from '@/lib/journey';
import { stepSummary } from '@/components/flow/summaries';
import { DoneCard, UpcomingRow } from '@/components/flow/step-frame';
import { UploadStep } from '@/components/flow/upload-step';
import { TailorStep } from '@/components/flow/tailor-step';
import { PeopleStep } from '@/components/flow/people-step';
import { MessagingStep } from '@/components/flow/messaging-step';
import { InterviewStep } from '@/components/flow/interview-step';
import { TrackStep } from '@/components/flow/track-step';
import { Monogram } from '@/components/brand/monogram';
import { Ring } from '@/components/brand/ring';
import { celebrate } from '@/components/brand/celebrate';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Confirm } from '@/components/ui/dialog';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu';
import { toast } from '@/components/ui/toaster';


const STEPS: Record<PhaseKey, (p: StepProps) => React.ReactNode> = {
  upload: UploadStep,
  tailor: TailorStep,
  people: PeopleStep,
  messaging: MessagingStep,
  interview: InterviewStep,
  track: TrackStep,
};

const CHEERS: Record<PhaseKey, string> = {
  upload: 'Listing in',
  tailor: 'Proof tailored',
  people: 'People found',
  messaging: 'Messages out',
  interview: 'Interview ready',
  track: 'All the way through',
};

export default function OpportunityPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const o = useOpportunity(id);
  const profile = useStore((s) => s.ws.profile);
  const completePhase = useStore((s) => s.completePhase);
  const openPhase = useStore((s) => s.openPhase);
  const removeOpportunity = useStore((s) => s.removeOpportunity);
  const cheer = useStore((s) => s.cheer);
  const [dropping, setDropping] = useState(false);
  const openRef = useRef<HTMLDivElement>(null);
  const scrollNext = useRef(false);

  /* after a step finishes, bring the next one into view once it has laid out */
  useEffect(() => {
    if (!scrollNext.current) return;
    scrollNext.current = false;
    const t = setTimeout(() => openRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 180);
    return () => clearTimeout(t);
  }, [o?.open]);

  if (!o) {
    return (
      <main className="grid place-items-center px-4 py-24 text-center">
        <h1 className="mb-4 text-[20px]">Not found</h1>
        <Button asChild variant="primary">
          <Link href="/opportunities">Opportunities</Link>
        </Button>
      </main>
    );
  }

  function complete(phase: PhaseKey) {
    if (!o) return;
    const next = completePhase(o.id, phase);
    if (cheer(`${o.id}:${phase}`)) celebrate(CHEERS[phase]);
    scrollNext.current = Boolean(next);
  }

  function reopen(phase: PhaseKey) {
    if (!o) return;
    openPhase(o.id, phase);
    scrollNext.current = true;
  }

  const pr = progress(o);

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-panel/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[980px] items-center gap-3 px-4 md:px-8">
          <Ring done={pr.done} total={pr.total} size={44} stroke={3}>
            <Monogram name={o.company} size={32} />
          </Ring>
          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-2 truncate text-[17px] font-[680] tracking-[-.02em]">
              <span className="truncate">{o.company}</span>
              {o.example && <Chip size="sm">Example</Chip>}
            </h1>
            <p className="truncate text-[12.5px] text-ink-3">{[o.role, o.location].filter(Boolean).join(' · ')}</p>
          </div>
          {/^https?:\/\//i.test(o.postingUrl) && (
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <a href={o.postingUrl} target="_blank" rel="noopener noreferrer">
                Listing <ArrowUpRight />
              </a>
            </Button>
          )}
          <Menu>
            <MenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={`More for ${o.company}`}>
                <MoreHorizontal />
              </Button>
            </MenuTrigger>
            <MenuContent>
              <MenuItem danger onSelect={() => setDropping(true)}>
                <Trash2 /> {o.example ? 'Remove example' : 'Remove'}
              </MenuItem>
            </MenuContent>
          </Menu>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-[980px] gap-3 px-4 py-6 md:px-8 md:py-8">
        {PHASES.map((phase) => {
          if (phase === o.open) {
            const Step = STEPS[phase];
            return (
              <div key={phase} ref={openRef} className="scroll-mt-24 py-2">
                <Step o={o} onComplete={() => complete(phase)} />
              </div>
            );
          }
          if (o.done.includes(phase)) {
            return <DoneCard key={phase} phase={phase} summary={stepSummary(o, phase, profile)} onReopen={() => reopen(phase)} />;
          }
          return <UpcomingRow key={phase} phase={phase} />;
        })}
        {o.done.length === PHASES.length && o.open === 'track' ? null : (
          <p className="sr-only" aria-live="polite">
            {PHASE_META[o.open].label} open
          </p>
        )}
      </main>

      <Confirm
        open={dropping}
        onOpenChange={setDropping}
        title={`Remove ${o.company}?`}
        body="Its people, messages, stories and research go with it."
        confirm="Remove"
        onConfirm={() => {
          removeOpportunity(o.id);
          toast(`${o.company} removed`);
          router.push('/opportunities');
        }}
      />
    </>
  );
}
