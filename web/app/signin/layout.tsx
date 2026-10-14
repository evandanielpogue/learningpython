import { Suspense } from 'react';

export const metadata = { title: 'Sign in' };

export default function SignInLayout({ children }: { children: React.ReactNode }) {
  return <Suspense>{children}</Suspense>;
}
