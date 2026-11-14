import type { Metadata } from 'next';
import CostEstimatorClient from '@/components/cost/CostEstimatorClient';

export const metadata: Metadata = {
  title: 'Treatment Cost Estimator — ₹ Approximate Costs, Government vs Private',
  description: 'Free itemised treatment cost estimates in Indian Rupees: consultation, diagnostic tests, procedure, room charges and medicines. Government vs private comparison, honest indicative ranges — never invented prices.',
};

export default function CostEstimatorPage() {
  return <CostEstimatorClient />;
}
