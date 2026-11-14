'use client';
import Link from 'next/link';
import {
  PhoneCall, MapPin, Navigation, Building2, Landmark, GitCompareArrows,
  Check, Siren, Clock, Star, Bookmark, Route,
} from 'lucide-react';
import { Hospital } from '@/data/types';
import { formatDistance, formatDuration, directionsUrl, TrafficLevel } from '@/lib/geo';
import { useCompare } from '@/lib/compare';
import { useSavedHospitals } from '@/lib/saved';
import { useUserLocation } from '@/lib/useLocation';
import { useLang, DictKey } from '@/lib/i18n';
import { tSpeciality } from '@/lib/i18n-data';

export type EnrichedHospital = Hospital & {
  distanceKm?: number | null;
  roadKm?: number | null;
  etaMinutes?: number | null;
  trafficLevel?: TrafficLevel;
  communityScore?: number | null;
  imdbScore?: number | null;
  reviewCount?: number;
};

interface Props {
  hospital: EnrichedHospital;
  showDistance?: boolean;
  /** 1-based marker index matching the numbered pin on MapView */
  markerIndex?: number;
  selected?: boolean;
  onSelect?: (hospitalId: string) => void;
}

const PROFILE_KEY: Record<Hospital['costProfile'], DictKey> = {
  'very-low': 'costProfileVeryLow',
  low: 'costProfileLow',
  moderate: 'costProfileModerate',
  high: 'costProfileHigh',
};

export default function HospitalCard({
  hospital,
  showDistance = true,
  markerIndex,
  selected = false,
  onSelect,
}: Props) {
  const { t, lang } = useLang();
  const { location } = useUserLocation();
  const { has, toggle, full } = useCompare();
  const { isSaved, toggleSaved } = useSavedHospitals();
  const inCompare = has(hospital.id);
  const saved = isSaved(hospital.id);
  const dist = hospital.roadKm ?? hospital.distanceKm ?? null;
  const eta = hospital.etaMinutes ?? null;
  const isGovt = hospital.type === 'government';

  const trafficColor =
    hospital.trafficLevel === 'heavy'
      ? 'text-amber-800 bg-amber-50 border-amber-200'
      : hospital.trafficLevel === 'low'
        ? 'text-emerald-800 bg-emerald-50 border-emerald-200'
        : 'text-slate-700 bg-slate-100 border-slate-200';

  return (
    <article
      id={`hospital-card-${hospital.id}`}
      data-testid={`hospital-card-${markerIndex ?? hospital.id}`}
      onClick={() => onSelect?.(hospital.id)}
      className={`card flex flex-col p-4 sm:p-5 transition-all ${
        selected
          ? 'ring-2 ring-brand-700 border-brand-500 shadow-lg bg-brand-50/20'
          : 'hover:shadow-lg hover:border-brand-300'
      } ${onSelect ? 'cursor-pointer' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          {typeof markerIndex === 'number' ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelect?.(hospital.id);
              }}
              aria-label={`Map marker ${markerIndex}: ${hospital.shortName}`}
              className={`mt-0.5 w-9 h-9 rounded-full shrink-0 flex items-center justify-center font-black text-sm text-white shadow-sm border-2 border-white ring-2 ${
                isGovt ? 'bg-brand-700 ring-brand-200' : 'bg-cyan-700 ring-cyan-200'
              }`}
            >
              {markerIndex}
            </button>
          ) : (
            <div
              className={`mt-0.5 rounded-xl p-2.5 shrink-0 ${
                isGovt ? 'bg-green-100 text-green-800' : 'bg-sky-100 text-sky-800'
              }`}
              aria-hidden="true"
            >
              {isGovt ? <Landmark size={22} /> : <Building2 size={22} />}
            </div>
          )}

          <div className="min-w-0">
            <h3 className="font-bold text-slate-900 leading-snug">
              <Link
                href={`/hospitals/${hospital.id}`}
                onClick={(e) => e.stopPropagation()}
                className="hover:text-brand-800 hover:underline"
              >
                {hospital.name}
              </Link>
            </h3>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span className={isGovt ? 'chip' : 'chip-grey'}>
                {isGovt ? t('govtBadge') : t('privateBadge')}
              </span>
              {hospital.emergency === 'verified' && (
                <span className="chip-red">
                  <Siren size={11} strokeWidth={2.5} />
                  {t('emergency247')}
                </span>
              )}
              {hospital.emergency === 'unverified' && (
                <span className="chip-amber">{t('emergencyUnverified')}</span>
              )}
              <span className="chip-grey">{t(PROFILE_KEY[hospital.costProfile])}</span>
              {typeof hospital.imdbScore === 'number' && (
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-950 border border-amber-300 px-2.5 py-0.5 text-xs font-extrabold"
                  title={`${t('communityScoreLabel')} (${hospital.reviewCount ?? 0} reviews)`}
                >
                  <Star size={11} className="fill-amber-500 text-amber-500" />
                  {hospital.imdbScore.toFixed(1)}/10
                  <span className="font-medium text-[10px] text-amber-800">({hospital.reviewCount})</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {showDistance && dist !== null && (
          <div className="text-right shrink-0">
            <p className="text-lg font-extrabold text-brand-800 leading-none" data-testid="card-distance">
              {formatDistance(dist, lang)}
            </p>
            <p className="text-[10px] uppercase tracking-wide text-slate-500 mt-1">{t('roadDistLabel')}</p>
            {eta !== null && (
              <span
                className={`mt-1.5 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold ${trafficColor}`}
                data-testid="card-eta"
              >
                <Clock size={11} /> ~{formatDuration(eta, lang)}
              </span>
            )}
          </div>
        )}
      </div>

      <p className="mt-3 text-sm text-slate-600 flex items-start gap-1.5">
        <MapPin size={15} className="mt-0.5 shrink-0 text-slate-400" />
        <span>{hospital.address}</span>
      </p>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {hospital.specialities.slice(0, 4).map((s) => (
          <span key={s} className="chip">
            {tSpeciality(s, lang)}
          </span>
        ))}
        {hospital.specialities.length > 4 && (
          <span className="chip-grey">{t('moreCount', { count: hospital.specialities.length - 4 })}</span>
        )}
      </div>

      <div
        className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3"
        onClick={(e) => e.stopPropagation()}
      >
        {hospital.phone ? (
          <a
            href={`tel:${hospital.phone}`}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-700 text-white px-3.5 py-2.5 text-sm font-bold hover:bg-brand-800 min-h-[44px]"
          >
            <PhoneCall size={16} strokeWidth={2.5} /> {hospital.phone}
          </a>
        ) : (
          <span
            className="inline-flex items-center gap-2 rounded-xl bg-slate-100 text-slate-500 px-3.5 py-2.5 text-sm font-semibold"
            title={t('numberNotListedTitle')}
          >
            {t('numberNotListed')}
          </span>
        )}

        <a
          href={directionsUrl(hospital.lat, hospital.lng, hospital.shortName, {
            lat: location.lat,
            lng: location.lng,
          })}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-xl border-2 border-brand-700 text-brand-800 px-3 py-2.5 text-sm font-bold hover:bg-brand-50 min-h-[44px]"
        >
          <Navigation size={15} strokeWidth={2.5} /> {t('directionsShort')}
        </a>

        {onSelect && (
          <button
            type="button"
            onClick={() => onSelect(hospital.id)}
            aria-pressed={selected}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-bold min-h-[44px] border transition-colors ${
              selected
                ? 'bg-brand-100 border-brand-500 text-brand-900'
                : 'border-slate-200 text-slate-700 hover:bg-brand-50 hover:border-brand-300'
            }`}
          >
            <Route size={15} /> {t('mapView')}
          </button>
        )}

        <Link
          href={`/hospitals/${hospital.id}`}
          className="inline-flex items-center gap-1 rounded-xl px-3 py-2.5 text-sm font-bold text-brand-800 hover:bg-brand-50 min-h-[44px]"
        >
          {t('viewDetails')} →
        </Link>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => toggleSaved(hospital.id)}
            aria-pressed={saved}
            aria-label={saved ? `${t('savedLabel')}: ${hospital.shortName}` : `${t('saveHospital')}: ${hospital.shortName}`}
            title={saved ? t('savedLabel') : t('saveHospital')}
            className={`inline-flex items-center justify-center rounded-xl p-2.5 min-h-[44px] min-w-[44px] border-2 transition-colors ${
              saved
                ? 'border-amber-500 bg-amber-50 text-amber-800'
                : 'border-slate-200 text-slate-500 hover:border-amber-400 hover:text-amber-800'
            }`}
          >
            <Bookmark size={16} className={saved ? 'fill-amber-500 text-amber-600' : ''} />
          </button>

          <button
            type="button"
            onClick={() => toggle(hospital.id)}
            aria-pressed={inCompare}
            title={
              inCompare
                ? t('compareTooltipRemove')
                : full
                  ? t('compareTooltipFull')
                  : t('compareTooltipAdd')
            }
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-bold min-h-[44px] border-2 transition-colors ${
              inCompare
                ? 'border-brand-700 bg-brand-700 text-white'
                : 'border-slate-200 text-slate-600 hover:border-brand-600 hover:text-brand-800'
            }`}
          >
            {inCompare ? <Check size={16} strokeWidth={3} /> : <GitCompareArrows size={16} />}
            <span className="hidden sm:inline">{inCompare ? t('inCompare') : t('compareBtn')}</span>
          </button>
        </div>
      </div>
    </article>
  );
}
