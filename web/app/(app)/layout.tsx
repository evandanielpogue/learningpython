import { Suspense } from 'react';
import { AppShell } from '@/components/shell/app-shell';
import { SplashStatic } from '@/components/shell/splash-static';

/* Everything inside reads the URL and the browser's workspace, so it renders
   on the client behind one Suspense boundary. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<SplashStatic />}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
