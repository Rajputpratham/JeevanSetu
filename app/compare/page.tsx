import type { Metadata } from 'next';
import CompareClient from '@/components/compare/CompareClient';

export const metadata: Metadata = {
  title: 'Compare Hospitals Side by Side — Distance, Facilities, Emergency & Costs',
  description: 'Compare up to 3 government and private hospitals in India: distance, specialities, facilities, 24×7 emergency care, OPD timings, approximate treatment costs and contact details.',
};

export default function ComparePage() {
  return <CompareClient />;
}
