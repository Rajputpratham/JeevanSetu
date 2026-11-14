import type { Metadata } from 'next';
import PrivacyClient from '@/components/pages/PrivacyClient';

export const metadata: Metadata = {
  title: 'Privacy Policy — JeevanSetu',
  description: 'JeevanSetu collects no personal medical data. Location and comparison choices stay in your browser. No ads, no tracking, no sale of data.',
};

export default function PrivacyPage() {
  return <PrivacyClient />;
}
