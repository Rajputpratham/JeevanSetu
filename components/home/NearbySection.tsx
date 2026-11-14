'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, LocateFixed, AlertCircle, MapPin } from 'lucide-react';
import { useUserLocation } from '@/lib/useLocation';
import HospitalCard, { EnrichedHospital } from '@/components/HospitalCard';
import { useLang } from '@/lib/i18n';
import { tPresetLabel } from '@/lib/i18n-data';
import { locationStrings } from '@/lib/ui-strings';

export default function NearbySection() {
  const { location, hasLocation, requestGeolocation, status, errorCode } = useUserLocation();
  const { t, lang } = useLang();
  const [hospitals, setHospitals] = useState<EnrichedHospital[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!hasLocation) {
      setHospitals([]);
      setFailed(false);
      return;
    }
    let cancelled = false;
    setHospitals(null);
    setFailed(false);
    fetch(`/api/hospitals?lat=${location.lat}&lng=${location.lng}&source=${location.source}&radius=1000&sort=distance&lang=${lang}`)
      .then((r) => {
        if (!r.ok) throw new Error('bad response');
        return r.json();
      })
      .then((data) => {
        if (!cancelled) setHospitals((data.results ?? []).slice(0, 4));
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [hasLocation, location.lat, location.lng, location.source, lang]);

  const locDisplay = hasLocation
    ? location.source === 'geolocation'
      ? t('yourLocation')
      : tPresetLabel(location.label, lang)
    : locationStrings(lang).notSet;

  return (
    <section aria-labelledby="nearby-heading" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-brand-700 flex items-center gap-1.5">
            <MapPin size={14} /> {t('showingResultsAround')} {locDisplay}
          </p>
          <h2 id="nearby-heading" className="section-title mt-1">
            {t('sectionNearby')}
          </h2>
          <p className="section-sub text-sm">{t('emNearbySub')}</p>
        </div>
        <div className="flex flex-col items-start sm:items-end gap-2">
          <button
            type="button"
            onClick={requestGeolocation}
            disabled={status === 'locating'}
            className="btn-secondary !py-2.5 !text-sm"
          >
            {status === 'locating' ? <Loader2 size={18} className="animate-spin" /> : <LocateFixed size={18} />}
            {t('useMyLocation')}
          </button>
          {errorCode && (
            <p role="alert" className="flex items-center gap-1.5 text-xs text-red-700 max-w-xs">
              <AlertCircle size={14} className="shrink-0" />
              {errorCode === 'denied' ? t('geoDeniedError') : t('geoFailedError')}
            </p>
          )}
        </div>
      </div>

      {failed ? (
        <div role="alert" className="card mt-6 p-6 text-center">
          <p className="font-semibold text-slate-800">{t('listLoadError')}</p>
        </div>
      ) : hospitals === null ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="card p-5 h-48 animate-pulse">
              <div className="h-5 w-2/3 bg-slate-200 rounded" />
              <div className="h-4 w-1/3 bg-slate-100 rounded mt-3" />
              <div className="h-4 w-full bg-slate-100 rounded mt-4" />
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {hospitals.map((h, idx) => (
            <HospitalCard key={h.id} hospital={h} markerIndex={idx + 1} />
          ))}
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link href="/hospitals" className="btn-primary">
          {t('navFind')} →
        </Link>
        <Link href="/rankings" className="btn-secondary">
          {t('navRankings')} →
        </Link>
      </div>
    </section>
  );
}
