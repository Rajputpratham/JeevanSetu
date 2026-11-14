'use client';
import Link from 'next/link';
import { PhoneCall, Navigation, GitCompareArrows, Check } from 'lucide-react';
import { useCompare } from '@/lib/compare';
import { directionsUrl } from '@/lib/geo';
import { Hospital } from '@/data/types';
import { useLang } from '@/lib/i18n';

export default function DetailActions({ hospital }: { hospital: Hospital }) {
  const { t } = useLang();
  const { has, toggle, full } = useCompare();
  const inCompare = has(hospital.id);

  return (
    <div className="flex flex-col gap-2.5">
      {hospital.phone ? (
        <a href={`tel:${hospital.phone}`} className="btn-primary !text-lg !py-4 font-extrabold">
          <PhoneCall size={22} strokeWidth={2.5} /> {t('callNow')}
        </a>
      ) : (
        <div className="rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-3 text-center">
          <p className="text-sm font-bold text-amber-900">{t('detailPhoneNotListedHeading')}</p>
          <p className="text-xs text-amber-800 mt-0.5">
            {t('detailPhoneNotListedSubPre')}
            <a href="tel:104" className="underline font-semibold">104</a>
            {t('detailPhoneNotListedSubPost')}
          </p>
        </div>
      )}
      <a href={directionsUrl(hospital.lat, hospital.lng, hospital.shortName)} target="_blank" rel="noopener noreferrer" className="btn-secondary !text-lg !py-4">
        <Navigation size={22} strokeWidth={2.5} /> {t('getDirections')}
      </a>
      <button type="button" onClick={() => toggle(hospital.id)} aria-pressed={inCompare}
        className={`btn !text-base !py-3.5 border-2 ${inCompare ? 'border-brand-700 bg-brand-700 text-white' : 'border-slate-200 text-slate-700 hover:border-brand-600'}`}>
        {inCompare ? <Check size={19} strokeWidth={3} /> : <GitCompareArrows size={19} />}
        {inCompare ? t('addedToComparison') : full ? t('comparisonFullMax3') : t('addToCompare')}
      </button>
      <Link href="/compare" className="text-center text-sm font-bold text-brand-800 hover:underline py-1">{t('openComparisonLink')}</Link>
    </div>
  );
}
