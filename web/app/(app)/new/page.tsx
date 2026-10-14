'use client';

import { useRouter } from 'next/navigation';
import { Topbar } from '@/components/shell/topbar';
import { ListingIntake } from '@/components/flow/listing-intake';
import { celebrate } from '@/components/brand/celebrate';

export default function NewOpportunity() {
  const router = useRouter();
  return (
    <>
      <Topbar title="Company" />
      <main className="mx-auto w-full max-w-[860px] px-4 py-6 md:px-8 md:py-8">
        <ListingIntake
          onCreated={(o) => {
            celebrate(`${o.company} added`);
            router.push(`/o/${o.id}`);
          }}
        />
      </main>
    </>
  );
}
