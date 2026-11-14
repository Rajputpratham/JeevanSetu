import type { Metadata } from 'next';
import ContactClient from '@/components/pages/ContactClient';

export const metadata: Metadata = {
  title: 'Contact JeevanSetu — Report Corrections or Suggest a Hospital',
  description: 'Report incorrect hospital information, suggest a hospital to add, or collaborate with JeevanSetu. For medical emergencies call 112 — do not use this form.',
};

export default function ContactPage() {
  return <ContactClient />;
}
