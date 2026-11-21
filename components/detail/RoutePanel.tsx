'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Clock, Loader2, MapPin, Navigation, Route as RouteIcon, Info } from 'lucide-react';
import type { Hospital } from '@/data/types';
import { useUserLocation } from '@/lib/useLocation';
import { useLang } from '@/lib/i18n';
import { distanceStrings, locationStrings } from '@/lib/ui-strings';
import { formatDrivingKm, formatStraightLineKm, formatDuration, haversineKm } from '@/lib/geo';

interface RoutePayload {
  source: 'osrm' | 'google-routes-api' | 'google-route-matrix' | 'unavailable';
  distanceKm: number | null;
  minutes?: number | null;
  etaMinutes?: number | null;
  straightKm: number | null;
  liveTraffic?: boolean;
  provider?: string;
  error: string | null;
  navigateUrl: string | null;
  computedAt: string | null;
}

/**
 * Road distance + estimated drive time for ONE hospital.
 *
 * Fixes three real defects in the old panel:
 *   1. It depended on GOOGLE_MAPS_API_KEY, so without a key it rendered "—" and a
 *      large orange error block. It now asks /api/route, which falls back to
 *      key-free OSRM, and only shows the compact "Road route unavailable" line
 *      when both providers fail.
 *   2. It labelled a traffic-free duration "Live traffic not returned". Nothing
 *      here claims live traffic: the duration is always "Estimated drive time"
 *      unless the response says `liveTraffic === true` (Google only).
 *   3. It pushed a straight-line number into a "Driving distance" slot. The
 *      straight-line figure is now a separate, explicitly labelled line and is
 *      never converted into a drive time.
 *
 * Location is only requested from an explicit "Use my location" press and each
 * failure mode (denied, timeout, unavailable, insecure context) has its own copy.
 */
export default function RoutePanel({ hospital }: { hospital: Hospital }) {
  const { lang } = useLang();
  const ds = distanceStrings(lang);
  const ls = locationStrings(lang);
  const { location, hasLocation, requestGeolocation, status, error, errorCode } = useUserLocation();
  const [data, setData] = useState<RoutePayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  const straightKm = useMemo(() => {
    if (!hasLocation || typeof location.lat !== 'number' || typeof location.lng !== 'number') return null;
    return Number(haversineKm(location.lat, location.lng, hospital.lat, hospital.lng).toFixed(1));
  }, [hasLocation, location.lat, location.lng, hospital.lat, hospital.lng]);

  const load = useCallback(() => {
    if (!hasLocation || typeof location.lat !== 'number' || typeof location.lng !== 'number') {
      setData(null);
      return;
    }
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setBusy(true);
    setFailed(false);
    fetch(
      `/api/route?fromLat=${location.lat}&fromLng=${location.lng}&hospitalId=${encodeURIComponent(hospital.id)}&lang=${lang}`,
      { signal: controller.signal, cache: 'no-store' },
    )
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('bad response'))))
      .then((payload: RoutePayload) => {
        if (!controller.signal.aborted) setData(payload);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setData(null);
          setFailed(true);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
  }, [hasLocation, location.lat, location.lng, hospital.id, lang]);

  useEffect(() => {
    load();
    return () => controllerRef.current?.abort();
  }, [load]);

  const road = data?.source === 'osrm' || data?.source === 'google-routes-api' || data?.source === 'google-route-matrix';
  const roadKm = road ? data?.distanceKm ?? null : null;
  const minutes = road ? data?.minutes ?? data?.etaMinutes ?? null : null;
  const liveTraffic = data?.liveTraffic === true && road;
  const drivingText = formatDrivingKm(roadKm, lang);
  const straightText = formatStraightLineKm(straightKm, lang);
  const directionsHref =
    data?.navigateUrl ??
    `https://www.google.com/maps/dir/?api=1&destination=${hospital.lat},${hospital.lng}&travelmode=driving`;

  const locationMessage = (() => {
    if (!error) return null;
    if (errorCode === 'denied') return ds.deniedCompact;
    if (errorCode === 'timeout') return ds.timeoutCompact;
    if (errorCode === 'insecure-context') return ds.insecureCompact;
    return error;
  })();

  const unavailable = !busy && hasLocation && !drivingText;

  return (
    <section
      className="rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3"
      aria-labelledby="route-panel-heading"
      data-testid="detail-travel-summary"
    >
      <h2 id="route-panel-heading" className="sr-only">
        {ds.drivingDistance} · {ds.estimatedDriveTime}
      </h2>

      {!hasLocation ? (
        <div data-testid="route-needs-location">
          <p className="text-sm font-bold text-brand-950">{ds.drivingDistance}</p>
          <p className="mt-1 text-xs text-slate-600">{ds.enableLocationExplainer}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={requestGeolocation}
              disabled={status === 'locating'}
              className="btn-primary !px-3 !py-2 !text-xs inline-flex items-center gap-1.5"
              data-testid="use-my-location"
            >
              {status === 'locating' ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />}
              {ds.enableLocationCta}
            </button>
            <a
              href={directionsHref}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-bold text-brand-800 underline underline-offset-2"
            >
              {ds.getDirections}
            </a>
          </div>
          {locationMessage && (
            <p role="alert" className="mt-2 text-xs font-semibold text-amber-900" data-testid="route-location-error">
              {locationMessage}
            </p>
          )}
        </div>
      ) : (
        <div data-testid="route-with-location">
          <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
            <div className="min-w-[7rem]">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-brand-700">{ds.drivingDistance}</p>
              <p className="text-xl font-black text-brand-950" data-testid="detail-distance">
                {busy ? <span className="text-slate-500 text-sm">…</span> : drivingText ?? '—'}
              </p>
            </div>
            <div className="min-w-[7rem]">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-brand-700">
                {liveTraffic ? ds.liveTraffic : ds.estimatedDriveTime}
              </p>
              <p className="text-xl font-black text-brand-950 flex items-center gap-1" data-testid="detail-eta">
                {busy ? (
                  <span className="text-slate-500 text-sm">…</span>
                ) : minutes !== null ? (
                  <>
                    <Clock size={15} className="text-brand-700" /> {formatDuration(minutes, lang)}
                  </>
                ) : (
                  <span className="text-sm font-bold text-slate-500">—</span>
                )}
              </p>
            </div>
            <a
              href={directionsHref}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border-2 border-brand-700 px-3 py-2 text-xs font-bold text-brand-800 hover:bg-white"
              data-testid="route-directions"
            >
              <Navigation size={14} /> {ds.getDirections}
            </a>
          </div>

          {road && (
            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[10px] text-slate-500">
              <RouteIcon size={11} className="shrink-0" />
              <span>{liveTraffic ? ds.providerGoogle : ds.providerOsrm}</span>
              <span aria-hidden="true">·</span>
              <span>{liveTraffic ? ds.liveTraffic : ds.noLiveTrafficNote}</span>
            </p>
          )}

          {unavailable && (
            <p className="mt-2 text-xs font-semibold text-amber-900" data-testid="route-unavailable">
              <strong>{ds.routeUnavailableTitle}</strong> — {ds.routeUnavailableWhy}
              {failed && (
                <button
                  type="button"
                  onClick={load}
                  className="ml-1 font-bold text-brand-800 underline underline-offset-2"
                >
                  {ls.retry}
                </button>
              )}
            </p>
          )}

          {straightText && !blockingStraight(roadKm) && (
            <p className="mt-1 text-[10px] text-slate-500" data-testid="detail-straight-line">
              {ds.straightLine}: {straightText}. <span className="italic">{ds.straightLineOnlyNote}</span>
            </p>
          )}

          {drivingText && (
            <p className="mt-1 text-[10px] text-slate-500">
              <Info size={10} className="mr-1 inline" aria-hidden="true" />
              {ls.yourLocation}: {location.label}
              {location.accuracyM ? ` (±${location.accuracyM} m)` : ''}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

/** Straight-line text is redundant when a road figure is already shown above it. */
function blockingStraight(roadKm: number | null): boolean {
  return roadKm !== null;
}
