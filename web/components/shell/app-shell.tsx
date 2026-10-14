'use client';

import { Rail } from './rail';
import { TabBar } from './tab-bar';
import { Splash, useBoot } from './boot';
import { Celebrations } from '@/components/brand/celebrate';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { ready, status } = useBoot({ needsOnboarding: true });
  if (!ready) return <Splash status={status} />;
  return (
    <div className="flex min-h-dvh">
      <Rail />
      <div className="flex min-w-0 flex-1 flex-col pb-20 md:pb-0">{children}</div>
      <TabBar />
      <Celebrations />
    </div>
  );
}
