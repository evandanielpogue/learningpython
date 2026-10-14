import { Suspense } from 'react';
import { SplashStatic } from '@/components/shell/splash-static';

export const metadata = { title: 'Welcome' };

export default function StartLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<SplashStatic />}>{children}</Suspense>;
}
