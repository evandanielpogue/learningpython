'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useStore } from '@/lib/data/store';
import { TEMPLATES } from '@/lib/engine/templates';
import { Mark } from '@/components/brand/mark';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toaster';

/* Loads the workspace once and sends people where they belong: signed out
   to sign in, first visit to the journey, everyone else onward. */
export function useBoot({ needsOnboarding }: { needsOnboarding: boolean }) {
  const status = useStore((s) => s.status);
  const onboarded = useStore((s) => s.ws.onboarded);
  const saveError = useStore((s) => s.saveError);
  const init = useStore((s) => s.init);
  const router = useRouter();
  const path = usePathname();

  useEffect(() => {
    void init(TEMPLATES);
  }, [init]);

  useEffect(() => {
    if (status === 'signedout') router.replace('/signin');
    if (status === 'ready' && needsOnboarding && !onboarded) router.replace('/start');
  }, [status, onboarded, needsOnboarding, router, path]);

  useEffect(() => {
    if (saveError) toast.error(saveError);
  }, [saveError]);

  return { ready: status === 'ready' && (!needsOnboarding || onboarded), status };
}

export function Splash({ status }: { status: string }) {
  const error = useStore((s) => s.error);
  return (
    <div className="grid min-h-dvh place-items-center bg-canvas">
      <div className="grid justify-items-center gap-4">
        <Mark size={44} className="animate-float" />
        {status === 'error' && (
          <>
            <p className="text-[14px] text-neg">{error}</p>
            <Button onClick={() => location.reload()}>Try again</Button>
          </>
        )}
      </div>
    </div>
  );
}
