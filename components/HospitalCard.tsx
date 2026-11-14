'use client';
import Link from 'next/link';
import { PhoneCall, MapPin, Navigation, Building2, Landmark, GitCompareArrows, Check, Siren } from 'lucide-react';
import { Hospital } from '@/data/types';
import { formatDistance, directionsUrl } from '@/lib/geo';
import { useCompare } from '@/lib/compare';
import { useLang } from '@/lib/i18n';

interface Props {
  hospital: Hospital & { distanceKm?: number | null };
  showDistance?: boolean;
}

const PROFILE_LABEL: Record<Hospital['costProfile'], string> = {
  'very-low': 'Very low cost',
  low: 'Low cost',
  moderate: 'Moderate cost',
  high: 'Premium/high cost',
};

export default function HospitalCard({ hospital, showDistance = true }: Props) {
  const { t } = useLang();
  const { has, toggle, full } = useCompare();
  const inCompare = has(hospital.id);
  const dist = hospital.distanceKm ?? null;
  const isGovt = hospital.type === 'government';

  return (
    <article className="card flex flex-col p-4 sm:p-5 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className={`mt-0.5 rounded-xl p-2.5 shrink-0 ${isGovt ? 'bg-green-100 text-green-800' : 'bg-sky-100 text-sky-800'}`} aria-hidden="true">
            {isGovt ? <Landmark size={22} /> : <Building2 size={22} />}
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-slate-900 leading-snug">
              <Link href={`/hospitals/${hospital.id}`} className="hover:text-brand-800 hover:underline">{hospital.name}</Link>
            </h3>
            <p className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span className={isGovt ? 'chip' : 'chip-grey'}>{isGovt ? t('govtBadge') : t('privateBadge')}</span>
              {hospital.emergency === 'verified' && <span className="chip-red"><Siren size={11} strokeWidth={2.5} />Emergency 24×7</span>}
              {hospital.emergency === 'unverified' && <span className="chip-amber">Emergency (unverified)</span>}
              <span className="chip-grey">{PROFILE_LABEL[hospital.costProfile]}</span>
            </p>
          </div>
        </div>
        {showDistance && dist !== null && (
          <div className="text-right shrink-0">
            <p className="text-lg font-extrabold text-brand-800 leading-none">{formatDistance(dist)}</p>
            <p className="text-[10px] uppercase tracking-wide text-slate-500 mt-1">away</p>
          </div>
        )}
      </div>

      <p className="mt-3 text-sm text-slate-600 flex items-start gap-1.5">
        <MapPin size={15} className="mt-0.5 shrink-0 text-slate-400" />
        <span>{hospital.address}</span>
      </p>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {hospital.specialities.slice(0, 4).map((s) => <span key={s} className="chip">{s}</span>)}
        {hospital.specialities.length > 4 && <span className="chip-grey">+{hospital.specialities.length - 4} more</span>}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
        {hospital.phone ? (
          <a href={`tel:${hospital.phone}`} className="inline-flex items-center gap-2 rounded-xl bg-brand-700 text-white px-3.5 py-2.5 text-sm font-bold hover:bg-brand-800 min-h-[44px]">
            <PhoneCall size={16} strokeWidth={2.5} /> {hospital.phone}
          </a>
        ) : (
          <span className="inline-flex items-center gap-2 rounded-xl bg-slate-100 text-slate-500 px-3.5 py-2.5 text-sm font-semibold" title="Phone number not reliably listed">
            Number not listed
          </span>
        )}
        <a href={directionsUrl(hospital.lat, hospital.lng, hospital.shortName)} target="_blank" rel="noopener noreferrer"
           className="inline-flex items-center gap-2 rounded-xl border-2 border-brand-700 text-brand-800 px-3.5 py-2.5 text-sm font-bold hover:bg-brand-50 min-h-[44px]">
          <Navigation size={16} strokeWidth={2.5} /> Directions
        </a>
        <Link href={`/hospitals/${hospital.id}`}
          className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-bold text-brand-800 hover:bg-brand-50 min-h-[44px]">
          {t('viewDetails')} →
        </Link>
        <button type="button" onClick={() => toggle(hospital.id)}
          aria-pressed={inCompare}
          title={inCompare ? 'Remove from comparison' : full ? 'Comparison is full (max 3)' : 'Add to comparison'}
          className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-bold min-h-[44px] border-2 transition-colors ${
            inCompare ? 'border-brand-700 bg-brand-700 text-white' : 'border-slate-200 text-slate-600 hover:border-brand-600 hover:text-brand-800'
          }`}>
          {inCompare ? <Check size={16} strokeWidth={3} /> : <GitCompareArrows size={16} />}
          {inCompare ? 'In comparison' : 'Compare'}
        </button>
      </div>
    </article>
  );
}
