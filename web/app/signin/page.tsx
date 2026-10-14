'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Mail } from 'lucide-react';
import { Wordmark } from '@/components/brand/mark';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { supabaseEnabled } from '@/lib/data/config';
import { Card } from '@/components/ui/card';

/* Only shown when Supabase is on. A magic link: no password to forget. */
export default function SignIn() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError('That email does not look right.');
      setState('error');
      return;
    }
    setState('sending');
    const { supabase } = await import('@/lib/data/supabase');
    const { error: err } = await supabase().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    });
    if (err) {
      setError(err.message);
      setState('error');
    } else setState('sent');
  }

  return (
    <main className="surf grid min-h-dvh place-items-center px-4">
      <Card className="w-full max-w-sm p-7">
        <div className="mb-6">
          <Wordmark />
        </div>
        <h1 className="mb-5 text-[22px]">Sign in</h1>
        {!supabaseEnabled ? (
          <Button asChild variant="primary" className="w-full">
            <Link href="/">Continue</Link>
          </Button>
        ) : state === 'sent' ? (
          <div className="flex items-center gap-3 rounded-[12px] bg-sea-wash p-4 text-[14px] text-sea-deep">
            <Mail className="size-5 shrink-0" /> Check {email} for your link.
          </div>
        ) : (
          <form onSubmit={send} className="grid gap-4" noValidate>
            <Field label="Email" htmlFor="email">
              <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={state === 'error'} />
            </Field>
            {state === 'error' && <p className="text-[13px] text-neg">{error}</p>}
            <Button type="submit" variant="primary" size="lg" disabled={state === 'sending'}>
              {state === 'sending' ? 'Sending…' : 'Email me a link'}
            </Button>
          </form>
        )}
      </Card>
    </main>
  );
}
