import type { Metadata } from 'next';
import DisclaimerClient from '@/components/pages/DisclaimerClient';

export const metadata: Metadata = {
  title: 'Disclaimer & Data Sources — JeevanSetu',
  description: 'What JeevanSetu data means and does not mean: verification statuses, cost range sourcing, medical disclaimer and how to report errors.',
};

export default function DisclaimerPage() {
  return <DisclaimerClient />;
}
