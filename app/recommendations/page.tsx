import type { Metadata } from 'next';
import RecommendationsClient from '@/components/recommendations/RecommendationsClient';
import { ALL_SPECIALITIES } from '@/data/hospitals';

export const metadata: Metadata = {
  title: 'Smart Hospital Recommendations — Matched to Your Problem, Budget & Distance',
  description:
    'Describe your health problem or pick a speciality and get hospitals matched on suitability, affordability, facilities and distance — with clear reasons for every suggestion. Not medical advice.',
};

export default async function RecommendationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const raw = sp.speciality;
  const s = (Array.isArray(raw) ? raw[0] : raw)?.trim();
  return <RecommendationsClient initialSpeciality={s && ALL_SPECIALITIES.includes(s) ? s : undefined} />;
}
