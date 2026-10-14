import { aiEnabled } from '@/lib/ai/server';

/* The browser asks once whether a model is on; it never learns the key. */
export async function GET() {
  return Response.json({ enabled: aiEnabled() });
}
