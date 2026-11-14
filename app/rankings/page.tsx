import type { Metadata } from 'next';
import RankingsClient from '@/components/rankings/RankingsClient';

export const metadata: Metadata = {
  title: 'Hospital Rankings & Leaderboards — Facilities, Emergency & Community Score',
  description:
    'Transparent hospital leaderboards across India combining verified facilities, speciality depth, 24×7 emergency capability, public affordability and IMDb-style Bayesian community scores.',
};

export default function RankingsPage() {
  return <RankingsClient />;
}
