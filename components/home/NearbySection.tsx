'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, LocateFixed, AlertCircle } from 'lucide-react';
import { useUserLocation } from '@/lib/useLocation';
import HospitalCard from '@/components/HospitalCard';
import { Hospital } from '@/data/types';
import { useLang } from '@/lib/i18n';

export default function NearbySection() {
  const { location, requestGeolocation, status, error } = useUserLocation();
  const { t } = useLang();
  const [hospitals, setHospitals] = useState<(Hospital & { distanceKm: number })[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setHospitals(null);
    setFailed(false);
    fetch(`/api/hospitals?lat=${location.lat}&lng=${location.lng}&radius=1000&sort=distance`)
      .then((r) => {
        if (!r.ok) throw new Error('bad response');
        return r.json();
      })
      .then((data) => { if (!cancelled) setHospitals((data.results ?? []).slice(0, 4)); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [location.lat, location.lng]);

  return (
    <section aria-labelledby="nearby-heading" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-brand-700">Step 1 · Locate</p>
          <h2 id="nearby-heading" className="section-title mt-1">{t('sectionNearby')}</h2>
          <p className="section-sub text-sm">
            {location.source === 'geolocation'
              ? 'Showing hospitals nearest to your current location.'
              : location.source === 'default'
                ? 'Showing hospitals near New Delhi — tap “Use my location” for accurate results.'
                : `Showing hospitals near ${location.label}.`}
            {' '}Distances are approximate.
          </p>
        </div>
        <div className="flex flex-col items-start sm:items-end gap-2">
          <button type="button" onClick={requestGeolocation} disabled={status === 'locating'} className="btn-secondary !py-2.5 !text-sm">
            {status === 'locating' ? <Loader2 size={18} className="animate-spin" /> : <LocateFixed size={18} />}
            {t('useMyLocation')}
          </button>
          {error && <p role="alert" className="flex items-center gap-1.5 text-xs text-red-700 max-w-xs"><AlertCircle size={14} className="shrink-0" />{error}</p>}
        </div>
      </div>

      {failed ? (
        <div role="alert" className="card mt-6 p-6 text-center">
          <p className="font-semibold text-slate-800">Could not load nearby hospitals.</p>
          <p className="text-sm text-slate-600 mt-1">Please check your connection and try again.</p>
          <button type="button" onClick={() => window.location.reload()} className="btn-primary mt-4">Retry</button>
        </div>
      ) : hospitals === null ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2" aria-busy="true" aria-label="Loading nearby hospitals">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="card p-5 h-48 animate-pulse">
              <div className="h-5 w-2/3 bg-slate-200 rounded" />
              <div className="h-4 w-1/3 bg-slate-100 rounded mt-3" />
              <div className="h-4 w-full bg-slate-100 rounded mt-4" />
              <div className="h-4 w-5/6 bg-slate-100 rounded mt-2" />
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {hospitals.map((h) => <HospitalCard key={h.id} hospital={h} />)}
        </div>
      )}
      <div className="mt-6 text-center">
        <Link href="/hospitals" className="btn-primary">See all hospitals with filters &amp; map →</Link>
      </div>
    </section>
  );
}
