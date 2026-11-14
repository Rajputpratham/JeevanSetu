import type { Metadata } from 'next';
import AboutClient from '@/components/pages/AboutClient';

export const metadata: Metadata = {
  title: 'About JeevanSetu — Why We Built a Free Healthcare Bridge',
  description: 'JeevanSetu mission: make healthcare information accessible to rural, low-income Indians. How our data is sourced, verified and labelled — and what we will never do.',
};

export default function AboutPage() {
  return <AboutClient />;
}
