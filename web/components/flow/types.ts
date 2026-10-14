import type { Opportunity } from '@/lib/types';

export interface StepProps {
  o: Opportunity;
  onComplete: () => void;
}
