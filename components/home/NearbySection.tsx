'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2, LocateFixed, AlertCircle, MapPin } from 'lucide-react';
import { useUserLocation } from '@/lib/useLocation';
import { useHospitalDistances } from '@/hooks/useHospitalDistances';
import { resolveHospitalGeo } from '@/data/hospital-locations';
import HospitalCard, { EnrichedHospital } from '@/components/HospitalCard';
import { useLang } from '@/lib/i18n';
import { tPresetLabel } from '@/lib/i18n-data';
import { locationStrings } from '@/lib/ui-strings';

const MAX_CARDS = 4;

export default function NearbySection() {
  const { location, hasLocation, requestGeolocation, status, errorCode } = useUserLocation();
  const { t, lang } = useLang();
  const [hospitals, setHospitals] = useState<EnrichedHospital[] | null>(null);
  const [failed, setFailed] = useState(false);

  // Ask for the device location once, on page load. If the user denies or the
  // browser cannot provide a position we keep the directory visible and each
  // card shows a graceful fallback — never a guessed distance.
  useEffect(() => {
    if (!hasLocation && status === 'idle') requestGeolocation();
    // Mount-only on purpose: never re-prompt after a denial or error.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load the nearby list with or without an origin. The API skips the routing
  // provider entirely when no origin is supplied, so browsing never depends on
  // sharing your location. Re-runs only when the origin itself changes.
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    setHospitals(null);
    setFailed(false);
    const params = new URLSearchParams({ radius: '1000', sort: 'distance', lang });
    if (hasLocation) {
      params.set('lat', String(location.lat));
      params.set('lng', String(location.lng));
      params.set('source', location.source);
    }
    fetch(`/api/hospitals?${params.toString()}`, { signal: controller.signal, cache: 'no-store' })
      .then((r) => {
        if (!r.ok) throw new Error('bad response');
        return r.json();
      })
      .then((data) => {
        if (!cancelled) setHospitals((data.results ?? []).slice(0, MAX_CARDS));
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => clearTimeout(timer));
    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
    // Depend on primitive coordinates, not the context object identity.
  }, [hasLocation, location.lat, location.lng, location.source, lang]);

  // Stable origin object for the OSRM fallback hook — memoized on primitives so
  // it is not recreated on every render (which would re-trigger routing).
  const origin = useMemo(
    () => (hasLocation ? { lat: location.lat as number, lng: location.lng as number } : null),
    [hasLocation, location.lat, location.lng],
  );

  // Verified hospital coordinates for the key-free OSRM table lookup. Only cards
  // with a trustworthy coordinate are routable; the rest keep the fallback.
  const destinations = useMemo(
    () =>
      (hospitals ?? []).map((h) => {
        const geo = resolveHospitalGeo(h);
        return geo.valid && geo.confidence === 'verified'
          ? { id: h.id, lat: geo.lat, lng: geo.lng }
          : { id: h.id };
      }),
    [hospitals],
  );
  // Key-free driving estimates (OSRM), computed once and cached by lib/distance
  // for 15 minutes — never re-fetched per render. Used only when the server
  // (Google Routes) could not supply a figure.
  const { distances } = useHospitalDistances(origin, destinations);

  const distancePending =
    hasLocation &&
    destinations.some((d) => typeof d.lat === 'number' && !distances.has(d.id));

  // Prefer the server's Google Routes figure (includes traffic when configured);
  // otherwise fall back to the client-side OSRM estimate; otherwise leave null so
  // the card keeps its own honest per-card fallback.
  const merged = useMemo(
    () =>
      (hospitals ?? []).map((h) => {
        if (typeof h.distanceKm === 'number' && Number.isFinite(h.distanceKm)) return h;
        const osrm = distances.get(h.id);
        if (osrm && osrm.source === 'road' && typeof osrm.km === 'number' && Number.isFinite(osrm.km)) {
          return {
            ...h,
            distanceKm: osrm.km,
            roadKm: osrm.km,
            etaMinutes: typeof osrm.minutes === 'number' && Number.isFinite(osrm.minutes) ? osrm.minutes : null,
            travelSource: 'osrm-estimate',
          };
        }
        return h;
      }),
    [hospitals, distances],
  );

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

      {!hasLocation && (
        <div
          role="status"
          className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-900"
        >
          <span className="inline-flex items-center gap-2">
            <MapPin size={16} />
            {lang === 'hi' ? 'स्थान बताए बिना भी अस्पताल खोज सकते हैं।' : 'Browse the directory without sharing your location.'}
          </span>
          <button type="button" className="min-h-[44px] underline underline-offset-4 font-semibold" onClick={requestGeolocation} disabled={status === 'locating'}>
            {t('useMyLocation')}
          </button>
        </div>
      )}

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
          {merged.map((h, idx) => (
            <HospitalCard key={h.id} hospital={h} markerIndex={idx + 1} distancePending={distancePending} />
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
