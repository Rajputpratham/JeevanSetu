import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { HOSPITALS, getHospitalById } from '@/data/hospitals';
import HospitalDetailClient from '@/components/detail/HospitalDetailClient';

export function generateStaticParams() {
  return HOSPITALS.map((h) => ({ id: h.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const h = getHospitalById(id);
  if (!h) return { title: 'Hospital not found' };
  return {
    title: `${h.shortName} — Address, OPD Timings, Facilities & Costs`,
    description: `${h.name}: ${h.address}. ${h.type === 'government' ? 'Government' : 'Private'} hospital. Specialities: ${h.specialities.slice(0, 6).join(', ')}. ${h.emergency === 'verified' ? 'Verified 24×7 emergency services.' : ''} Contact and directions on JeevanSetu.`,
  };
}

export default async function HospitalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const h = getHospitalById(id);
  if (!h) notFound();

  return <HospitalDetailClient hospital={h} />;
}
