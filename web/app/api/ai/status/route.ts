import { connection } from 'next/server';
import { aiEnabled } from '@/lib/ai/server';

/* The browser asks once whether a model is on; it never learns the key.
   Read per request, so setting the key does not need a rebuild. */
export async function GET() {
  await connection();
  return Response.json({ enabled: aiEnabled() });
}
