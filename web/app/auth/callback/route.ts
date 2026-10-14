import { NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/data/server';
import { supabaseEnabled } from '@/lib/data/config';

/* The magic link lands here: trade the code for a session, then go in. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  if (supabaseEnabled && code) {
    const sb = await serverSupabase();
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(new URL('/signin?error=link', url.origin));
  }
  return NextResponse.redirect(new URL('/', url.origin));
}
