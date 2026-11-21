import type { Metadata } from 'next';
import { Suspense } from 'react';
import CostEstimatorClient from '@/components/cost/CostEstimatorClient';

export const metadata: Metadata = {
  title: 'Treatment Cost Estimator — ₹ Approximate Costs, Government vs Private',
  description: 'Free itemised treatment cost estimates in Indian Rupees: consultation, diagnostic tests, procedure, room charges and medicines. Government vs private comparison, honest indicative ranges — never invented prices.',
};

export default function CostEstimatorPage() {
  // `useSearchParams` (for the ?treatment= carry-over) needs a Suspense boundary.
  return (
    <Suspense fallback={<div className="mx-auto max-w-7xl px-4 py-10 text-sm text-slate-500">Loading estimator…</div>}>
      <CostEstimatorClient />
    </Suspense>
  );
}
