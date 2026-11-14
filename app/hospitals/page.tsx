import type { Metadata } from 'next';
import DiscoveryClient from '@/components/hospitals/DiscoveryClient';

export const metadata: Metadata = {
  title: 'Find Hospitals Near You — Government & Private, with Map & Directions',
  description:
    'Locate nearby government and private hospitals in India with distance, contact numbers, specialities, 24×7 emergency filters and one-tap Google Maps directions. Free, no account needed.',
};

export default async function HospitalsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const str = (k: string) => {
    const v = sp[k];
    return (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
  };
  const typeParam = str('type');
  const initialRadius = Number(str('radius'));
  return (
    <DiscoveryClient
      initialQ={str('q')}
      initialType={typeParam === 'government' || typeParam === 'private' ? typeParam : 'all'}
      initialSpeciality={str('speciality')}
      initialEmergency={str('emergency') === '1'}
      initialRadius={Number.isFinite(initialRadius) && initialRadius > 0 ? initialRadius : 25}
      initialEmpty={str('empty') === '1'}
      initialSavedOnly={str('saved') === '1'}
    />
  );
}
