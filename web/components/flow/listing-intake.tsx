'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Link2, Loader2, Sparkles } from 'lucide-react';
import type { Opportunity, ParsedListing, Requirement } from '@/lib/types';
import { ACME_LISTING, parseListing, rankProof } from '@/lib/engine';
import { aiOn, fetchPosting, matchListing } from '@/lib/ai/client';
import { createOpportunity } from '@/lib/actions';
import { useStore } from '@/lib/data/store';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { MatchList, MatchMeter } from './match-list';
import { ProofPicker } from './proof-picker';
import { cn } from '@/lib/utils';

const SUGGEST = 3;

/* Paste a listing (or, with a model on, a link), read it, check what was
   read, pick the proof to lead with, and the company is in. */
export function ListingIntake({ onCreated }: { onCreated: (o: Opportunity) => void }) {
  const profile = useStore((s) => s.ws.profile);
  const addOpportunity = useStore((s) => s.addOpportunity);

  const [stage, setStage] = useState<'paste' | 'review'>('paste');
  const [listing, setListing] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState<'' | 'link' | 'read'>('');
  const [linkMsg, setLinkMsg] = useState('');
  const [model, setModel] = useState(false);

  const [parsed, setParsed] = useState<ParsedListing | null>(null);
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [location, setLocation] = useState('');
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [matchedBy, setMatchedBy] = useState<'claude' | 'local'>('local');
  const [chosen, setChosen] = useState<string[]>([]);
  const [tried, setTried] = useState(false);

  useEffect(() => {
    void aiOn().then(setModel);
  }, []);

  const ranked = useMemo(() => (listing ? rankProof(profile.proof, listing) : []), [listing, profile.proof]);
  const suggested = ranked.slice(0, SUGGEST).map((r) => r.proof.id);

  async function grab() {
    if (!url.trim()) return;
    setBusy('link');
    setLinkMsg('');
    try {
      const text = await fetchPosting(url.trim());
      setListing(text);
    } catch (e) {
      setLinkMsg(e instanceof Error ? e.message : 'That page would not load.');
    } finally {
      setBusy('');
    }
  }

  async function read() {
    const text = listing.trim();
    if (!text) return;
    setBusy('read');
    const p = parseListing(text);
    setParsed(p);
    setCompany(p.company);
    setRole(p.role);
    setLocation(p.location);
    const m = await matchListing(text, p.requirements, profile);
    setRequirements(m.value);
    setMatchedBy(m.by);
    setChosen(rankProof(profile.proof, text).slice(0, SUGGEST).map((r) => r.proof.id));
    setBusy('');
    setStage('review');
  }

  function create() {
    setTried(true);
    if (!parsed || !company.trim()) return;
    const o = createOpportunity(
      { listing: listing.trim(), postingUrl: url.trim(), parsed, company, role, location, requirements, proofIds: chosen },
      profile,
    );
    addOpportunity(o);
    onCreated(o);
  }

  if (stage === 'paste') {
    return (
      <Card className="p-5 md:p-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-[15px] font-semibold">Listing</h3>
          <Button variant="ghost" size="sm" onClick={() => setListing(ACME_LISTING)}>
            Use an example
          </Button>
        </div>
        {model && (
          <div className="mb-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Link2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
                <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://… link to the posting" className="pl-9" aria-label="Link to the posting" />
              </div>
              <Button onClick={grab} disabled={!url.trim() || busy !== ''}>
                {busy === 'link' ? <Loader2 className="animate-spin" /> : 'Read link'}
              </Button>
            </div>
            {linkMsg && <p className="mt-1.5 text-[12.5px] text-neg">{linkMsg}</p>}
          </div>
        )}
        <Textarea
          value={listing}
          onChange={(e) => setListing(e.target.value)}
          placeholder="Paste the whole posting"
          aria-label="Listing"
          className="min-h-56 font-mono text-[12.5px]"
        />
        <div className="mt-4 flex justify-end">
          <Button variant="primary" size="lg" onClick={read} disabled={!listing.trim() || busy !== ''}>
            {busy === 'read' ? <Loader2 className="animate-spin" /> : <Sparkles />}
            Read
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      <Card className="p-5 md:p-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Company" htmlFor="f-company">
            <Input id="f-company" value={company} onChange={(e) => setCompany(e.target.value)} aria-invalid={tried && !company.trim()} />
          </Field>
          <Field label="Role" htmlFor="f-role">
            <Input id="f-role" value={role} onChange={(e) => setRole(e.target.value)} />
          </Field>
          <Field label="Location" htmlFor="f-location">
            <Input id="f-location" value={location} onChange={(e) => setLocation(e.target.value)} />
          </Field>
        </div>
        {tried && !company.trim() && <p className="mt-2 text-[12.5px] text-neg">Add the company name</p>}
      </Card>

      <Card className="p-5 md:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-[15px] font-semibold">Match</h3>
          <span className="text-[12px] text-ink-3">{matchedBy === 'claude' ? 'Matched by Claude' : 'Matched on keywords'}</span>
        </div>
        <div className="mb-4">
          <MatchMeter requirements={requirements} />
        </div>
        <MatchList requirements={requirements} proof={profile.proof} />
      </Card>

      <Card className="p-5 md:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-[15px] font-semibold">Proof</h3>
          <span className={cn('rounded-full px-2.5 py-1 text-[12px] font-medium', chosen.length ? 'bg-sea-wash text-sea-deep' : 'bg-sunk text-ink-3')}>
            {chosen.length} picked
          </span>
        </div>
        <ProofPicker
          proof={profile.proof}
          chosen={chosen}
          suggested={suggested}
          onToggle={(id) => setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]))}
        />
      </Card>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="ghost" onClick={() => setStage('paste')}>
          Paste again
        </Button>
        <Button variant="primary" size="lg" onClick={create} className="group">
          Add {company.trim() || 'company'}
          <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
        </Button>
      </div>
    </div>
  );
}
