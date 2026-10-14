'use client';

import { useRef, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, FileUp, Loader2, Sparkles } from 'lucide-react';
import type { ParsedResume } from '@/lib/types';
import { EXAMPLE_RESUME } from '@/lib/engine';
import { readResume } from '@/lib/ai/client';
import { pdfText } from '@/lib/pdf';
import { useStore } from '@/lib/data/store';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, Input, Textarea } from '@/components/ui/input';
import { toast } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';

/* Drop a PDF or paste the text; read it; check what was read; keep it. */
export function ResumeIntake({ onSaved, saveLabel = 'Save' }: { onSaved: () => void; saveLabel?: string }) {
  const adapter = useStore((s) => s.adapter);
  const profile = useStore((s) => s.ws.profile);
  const setProfile = useStore((s) => s.setProfile);
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState('pasted text');
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [read, setRead] = useState<ParsedResume | null>(null);
  const [by, setBy] = useState<'claude' | 'local'>('local');

  async function take(f: File | undefined) {
    if (!f) return;
    setBusy(true);
    try {
      const t = /pdf$/i.test(f.type) || /\.pdf$/i.test(f.name) ? await pdfText(f) : await f.text();
      if (!t.trim()) throw new Error('No text in that file. Paste it instead.');
      setText(t);
      setFile(f);
      setSource(f.name);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not read that file.');
    } finally {
      setBusy(false);
    }
  }

  async function go() {
    if (!text.trim()) return;
    setBusy(true);
    const r = await readResume(text, source);
    setBusy(false);
    setRead(r.value);
    setBy(r.by);
    if (r.error) toast(`Claude could not read it (${r.error}). Read by pattern matching.`);
  }

  async function save() {
    if (!read) return;
    setProfile({
      name: read.name || profile.name,
      email: read.email || profile.email,
      phone: read.phone || profile.phone,
      location: read.location || profile.location,
      years: read.years,
      roles: read.roles,
      proof: read.proof,
      stack: read.stack,
      voice: read.voice,
      imported: true,
      source,
    });
    if (file && adapter) await adapter.storeResume(file).catch(() => null);
    onSaved();
  }

  if (!read) {
    return (
      <Card className="p-5 md:p-6">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            void take(e.dataTransfer.files[0]);
          }}
          className={cn(
            'grid w-full place-items-center gap-3 rounded-[16px] border-2 border-dashed px-4 py-10 text-center transition',
            drag ? 'border-sea bg-sea-wash' : 'border-sea-line bg-sea-wash/40 hover:border-sea hover:bg-sea-wash',
          )}
        >
          <span className="grid size-14 place-items-center rounded-[18px] bg-panel text-sea shadow-e2">
            {busy ? <Loader2 className="size-6 animate-spin" /> : <FileUp className="size-6" />}
          </span>
          <b className="text-[15px]">{file ? file.name : 'Drop your résumé'}</b>
          <span className="text-[12.5px] text-ink-3">PDF or text</span>
        </button>
        <input ref={fileRef} type="file" accept=".pdf,.txt,.md,application/pdf,text/plain" hidden onChange={(e) => take(e.target.files?.[0])} />

        <div className="my-4 flex items-center gap-3 text-[12px] text-ink-3">
          <span className="h-px flex-1 bg-line" /> or paste it <span className="h-px flex-1 bg-line" />
        </div>
        <Textarea value={text} onChange={(e) => { setText(e.target.value); setSource('pasted text'); }} placeholder="Paste the text of your résumé" aria-label="Résumé text" className="min-h-40 font-mono text-[12.5px]" />
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={() => { setText(EXAMPLE_RESUME); setSource('example'); }}>
            Use an example
          </Button>
          <Button variant="primary" size="lg" onClick={go} disabled={!text.trim() || busy}>
            {busy ? <Loader2 className="animate-spin" /> : <Sparkles />} Read
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid gap-4">
      <Card className="p-5 md:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-[15px] font-semibold">You</h3>
          <span className="text-[12px] text-ink-3">{by === 'claude' ? 'Read by Claude' : 'Read by pattern matching'}</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Name" htmlFor="r-name">
            <Input id="r-name" value={read.name} onChange={(e) => setRead({ ...read, name: e.target.value })} />
          </Field>
          <Field label="Email" htmlFor="r-email">
            <Input id="r-email" value={read.email} onChange={(e) => setRead({ ...read, email: e.target.value })} />
          </Field>
          <Field label="Location" htmlFor="r-loc">
            <Input id="r-loc" value={read.location} onChange={(e) => setRead({ ...read, location: e.target.value })} />
          </Field>
        </div>
      </Card>

      <Card className="p-5 md:p-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-[15px] font-semibold">Proof</h3>
          <span className="rounded-full bg-sand-wash px-2.5 py-1 text-[12px] font-medium text-sand-ink">{read.proof.length}</span>
        </div>
        {read.proof.length ? (
          <ul className="divide-y divide-line">
            {read.proof.map((p, i) => (
              <motion.li key={p.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="flex gap-4 py-2.5">
                <b className="w-16 shrink-0 font-mono text-[13px] text-sea">{p.metric}</b>
                <span className="grid gap-0.5">
                  <span className="text-[14px]">{p.text}</span>
                  <span className="text-[12px] text-ink-3">{p.where}</span>
                </span>
              </motion.li>
            ))}
          </ul>
        ) : (
          <p className="text-[13.5px] text-neg">No results with a number in them. Paste a version with your numbers.</p>
        )}
      </Card>

      <Card className="p-5 md:p-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-[15px] font-semibold">Roles</h3>
          <span className="text-[12px] text-ink-3">{read.roles.length}</span>
        </div>
        <ul className="grid gap-2">
          {read.roles.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 rounded-[12px] bg-sunk px-3 py-2.5">
              <span className="grid min-w-0">
                <b className="truncate text-[14px]">{r.title}</b>
                <span className="truncate text-[12.5px] text-ink-3">{[r.company, r.span].filter(Boolean).join(', ')}</span>
              </span>
              <span className="shrink-0 text-[12px] text-ink-3">{r.bullets.length} bullets</span>
            </li>
          ))}
        </ul>
        {read.stack.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {read.stack.map((t) => (
              <span key={t} className="rounded-full bg-sunk px-2.5 py-1 text-[12px] text-ink-2">{t}</span>
            ))}
          </div>
        )}
      </Card>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="ghost" onClick={() => setRead(null)}>
          Paste again
        </Button>
        <Button variant="primary" size="lg" onClick={save} className="group">
          {saveLabel} <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
        </Button>
      </div>
    </motion.div>
  );
}
