'use client';
import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  MapPin, Navigation, PhoneCall, BedDouble, Stethoscope, CheckCircle2, Building2, Landmark,
  Siren, Info, Mail, XCircle, BadgeCheck, HelpCircle, Clock, Route as RouteIcon,
} from 'lucide-react';
import { Hospital } from '@/data/types';
import DetailActions from '@/components/detail/DetailActions';
import RatingsSection from '@/components/detail/RatingsSection';
import VerificationChip from '@/components/VerificationChip';
import { useLang, DictKey } from '@/lib/i18n';
import { tFacility, tHospitalMeta, tPresetLabel, tSpeciality } from '@/lib/i18n-data';
import { useUserLocation } from '@/lib/useLocation';
import LocationControls from '@/components/LocationControls';
import MapPanel from '@/components/maps/MapPanel';
import { formatDrivingKm, formatDuration, directionsFromToUrl, formatStraightLineKm, haversineKm } from '@/lib/geo';
import { distanceStrings, locationStrings } from '@/lib/ui-strings';
import type { RouteDetailPayload } from '@/components/hospitals/DiscoveryClient';

const COST_KEY: Record<Hospital['costProfile'], DictKey> = {
  'very-low': 'costLabelVeryLow',
  low: 'costLabelLow',
  moderate: 'costLabelModerate',
  high: 'costLabelHigh',
};

export default function HospitalDetailClient({ hospital: h }: { hospital: Hospital }) {
  const { t, lang } = useLang();
  const { location, hasLocation } = useUserLocation();
  const ds = distanceStrings(lang);
  const ls = locationStrings(lang);
  const [routeData, setRouteData] = useState<RouteDetailPayload | null>(null);
  const [routeBusy, setRouteBusy] = useState(false);
  const [altIndex, setAltIndex] = useState(0);

  const isGovt = h.type === 'government';
  const cover = isGovt ? '/images/hospital-govt.jpg' : '/images/hospital-private.jpg';

  const tagline = tHospitalMeta(h.id, 'tagline', h.tagline, lang);
  const ownershipNote = tHospitalMeta(h.id, 'ownershipNote', h.ownershipNote, lang);
  const emergencyNote = tHospitalMeta(h.id, 'emergencyNote', h.emergencyNote, lang);
  const opdTimings = tHospitalMeta(h.id, 'opdTimings', h.opdTimings, lang);
  const dataNote = tHospitalMeta(h.id, 'dataNote', h.dataNote, lang);

  /** Direct-line fallback is computed locally but ALWAYS labelled as such. */
  const straightKm = useMemo(() => {
    if (!hasLocation || typeof location.lat !== 'number' || typeof location.lng !== 'number') return null;
    return Number(haversineKm(location.lat, location.lng, h.lat, h.lng).toFixed(1));
  }, [hasLocation, location.lat, location.lng, h.lat, h.lng]);

  /**
   * Single authoritative route for this hospital, fetched by hospital id so the
   * server resolves the verified destination coordinates. Supports choosing an
   * alternative route, which then becomes the ONE route every number refers to.
   */
  useEffect(() => {
    if (!hasLocation || typeof location.lat !== 'number' || typeof location.lng !== 'number') {
      setRouteData(null);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    setRouteBusy(true);
    fetch(
      `/api/route?fromLat=${location.lat}&fromLng=${location.lng}&hospitalId=${encodeURIComponent(h.id)}&alt=${altIndex}&lang=${lang}`,
      { signal: controller.signal },
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((d: RouteDetailPayload | null) => {
        if (!cancelled) setRouteData(d);
      })
      .catch(() => {
        if (!cancelled) setRouteData(null);
      })
      .finally(() => {
        if (!cancelled) setRouteBusy(false);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [hasLocation, location.lat, location.lng, h.id, altIndex, lang]);

  const effectiveRoadKm = routeData?.distanceKm ?? null;
  const effectiveEtaMin = routeData?.etaMinutes ?? null;
  const trafficImpact = routeData?.trafficImpactMinutes ?? null;
  const drivingText = formatDrivingKm(effectiveRoadKm, lang);
  const straightText = formatStraightLineKm(straightKm, lang);

  const originLabel = hasLocation
    ? location.source === 'geolocation'
      ? `${location.label}${location.accuracyM ? ` (±${location.accuracyM} m)` : ''}`
      : location.source === 'unknown'
        ? ls.notSet
        : tPresetLabel(location.label, lang)
    : ls.notSet;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 lg:py-10">
      {/* Breadcrumb */}
      <nav aria-label={t('breadcrumbAria')} className="text-sm text-slate-500">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/" className="hover:text-brand-800 hover:underline">
              {t('navHome')}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href="/hospitals" className="hover:text-brand-800 hover:underline">
              {t('navFind')}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="font-semibold text-brand-900">
            {h.shortName}
          </li>
        </ol>
      </nav>

      {/* Header */}
      <header className="mt-3 card p-5 sm:p-7">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div
              className={`rounded-2xl p-3.5 shrink-0 ${
                isGovt ? 'bg-green-100 text-green-800' : 'bg-sky-100 text-sky-800'
              }`}
              aria-hidden="true"
            >
              {isGovt ? <Landmark size={30} /> : <Building2 size={30} />}
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-brand-950 leading-tight">
                {h.name}
              </h1>
              {tagline && <p className="mt-1 text-slate-600">{tagline}</p>}
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                <span className={isGovt ? 'chip' : 'chip-grey'}>
                  {isGovt ? t('govtHospitalLabel') : t('privateHospitalLabel')}
                </span>
                {h.emergency === 'verified' && (
                  <span className="chip-red">
                    <Siren size={12} strokeWidth={2.5} />
                    {t('verified247Emergency')}
                  </span>
                )}
                {h.emergency === 'unverified' && (
                  <span className="chip-amber">
                    <HelpCircle size={12} />
                    {t('emergencyUnverifiedBadge')}
                  </span>
                )}
                {h.emergency === 'none' && (
                  <span className="chip-grey">
                    <XCircle size={12} />
                    {t('noGeneralEmergency')}
                  </span>
                )}
                <span className="chip-grey">
                  <BedDouble size={12} />
                  {t('approxBeds', { beds: h.beds ?? '–' })}
                </span>
              </div>
            </div>
          </div>

          {/* Google Routes driving distance + traffic-aware ETA */}
          <div
            className="rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 shrink-0"
            data-testid="detail-travel-summary"
          >
            <div className="flex items-center gap-4">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-brand-700">
                  {ds.drivingDistance}
                </p>
                <p className="text-xl font-black text-brand-950" data-testid="detail-distance">
                  {routeBusy ? '…' : drivingText ?? '—'}
                </p>
              </div>
              <div className="h-8 w-px bg-brand-200" aria-hidden="true" />
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-brand-700">
                  {ds.eta}
                </p>
                <p className="text-xl font-black text-brand-950 flex items-center gap-1" data-testid="detail-eta">
                  {effectiveEtaMin !== null ? (
                    <>
                      <Clock size={16} className="text-brand-700" /> ~{formatDuration(effectiveEtaMin, lang)}
                    </>
                  ) : (
                    <span className="text-sm font-bold text-amber-800">{ds.noLiveTraffic}</span>
                  )}
                </p>
              </div>
            </div>
            {trafficImpact !== null && (
              <p className="mt-1.5 text-[11px] font-semibold text-amber-900" data-testid="detail-traffic-impact">
                {ds.trafficImpact}: +{trafficImpact} min
              </p>
            )}
            {!drivingText && !routeBusy && (
              <p className="mt-1.5 text-[11px] font-semibold text-amber-900" data-testid="detail-distance-unavailable">
                {hasLocation ? ds.distanceUnavailableWhy : ls.notSetWhy}
              </p>
            )}
            {straightText && (
              <p className="mt-1 text-[10px] text-slate-500">
                {ds.straightLine}: {straightText}
              </p>
            )}
          </div>
        </div>
        {ownershipNote && (
          <p className="mt-3 text-sm text-slate-600 border-l-4 border-brand-200 pl-3">{ownershipNote}</p>
        )}
      </header>

      <div className="mt-5 grid gap-5 lg:grid-cols-3 items-start">
        {/* ─── Main column ─── */}
        <div className="lg:col-span-2 flex flex-col gap-5">
          {/* Representative image */}
          <figure className="card overflow-hidden">
            <Image
              src={cover}
              alt={isGovt ? t('repImageAltGovt') : t('repImageAltPrivate')}
              width={1100}
              height={560}
              className="w-full h-48 sm:h-56 object-cover"
            />
            <figcaption className="px-4 py-2 text-[11px] text-slate-500 border-t border-slate-100">
              {t('repImageCaption')}
            </figcaption>
          </figure>

          {/* Address + Route Map */}
          <section aria-labelledby="addr" className="card p-5 sm:p-6">
            <h2 id="addr" className="flex items-center gap-2 font-extrabold text-lg text-slate-900">
              <MapPin className="text-brand-700" size={20} />
              {t('addressDirectionsTitle')}
            </h2>
            <p className="mt-2 text-slate-700 leading-relaxed">{h.address}</p>
            <p className="mt-1 text-xs text-slate-500 flex items-center gap-1.5">
              <RouteIcon size={13} className="text-brand-700 shrink-0" />
              {t('distancesFromLabel')} <strong className="text-slate-700">{originLabel}</strong>
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              {h.geoConfidence === 'verified' ? ds.verifiedCoords : ds.approxCoords}
            </p>

            <div className="mt-4">
              <MapPanel
                hospitals={[
                  {
                    ...h,
                    roadKm: effectiveRoadKm,
                    distanceKm: effectiveRoadKm,
                    etaMinutes: effectiveEtaMin,
                  },
                ]}
                center={{ lat: h.lat, lng: h.lng }}
                zoom={13}
                userLocation={
                  hasLocation && typeof location.lat === 'number' && typeof location.lng === 'number'
                    ? { lat: location.lat, lng: location.lng, accuracyM: location.accuracyM }
                    : null
                }
                selectedHospitalId={h.id}
                routeGeometry={routeData?.geometry ?? null}
                showTraffic
              />
            </div>

            <div className="mt-4">
              <LocationControls compact />
            </div>

            {routeData?.alternatives && routeData.alternatives.length > 1 && (
              <div className="mt-3" data-testid="alternative-routes">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{ds.alternatives}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {routeData.alternatives.map((alt, i) => (
                    <button
                      key={`${alt.distanceKm}-${i}`}
                      type="button"
                      onClick={() => setAltIndex(i)}
                      aria-pressed={altIndex === i}
                      className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold ${
                        altIndex === i
                          ? 'border-brand-700 bg-brand-700 text-white'
                          : 'border-slate-200 text-slate-700 hover:border-brand-400'
                      }`}
                    >
                      {alt.distanceKm.toFixed(1)} km · ~{alt.etaMinutes} min
                      {alt.description ? ` · ${alt.description}` : ''}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-[10px] text-slate-500">{ds.sameRouteNote}</p>
              </div>
            )}

            {routeData?.disclosure.text && (
              <p className="mt-2 text-[11px] text-slate-500">
                {routeData.disclosure.text}
                {routeData.computedAt && (
                  <> · {ds.lastUpdated} {new Date(routeData.computedAt).toLocaleTimeString()}</>
                )}
              </p>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href={
                  routeData?.navigateUrl ??
                  (hasLocation && typeof location.lat === 'number' && typeof location.lng === 'number'
                    ? directionsFromToUrl(location.lat, location.lng, h.lat, h.lng, h.shortName)
                    : `https://www.google.com/maps/dir/?api=1&destination=${h.lat},${h.lng}&travelmode=driving`)
                }
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary w-full sm:w-auto"
              >
                <Navigation size={18} /> {ds.navigateGmaps}
              </a>
            </div>
          </section>

          {/* IMDb-style Community Score + Google Ratings + Moderated Reviews */}
          <RatingsSection hospitalId={h.id} hospitalName={h.name} />

          {/* Specialities */}
          <section aria-labelledby="spec" className="card p-5 sm:p-6">
            <h2 id="spec" className="flex items-center gap-2 font-extrabold text-lg text-slate-900">
              <Stethoscope className="text-brand-700" size={20} />
              {t('specialitiesTitle')}
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {h.specialities.map((s) => (
                <span key={s} className="chip">
                  {tSpeciality(s, lang)}
                </span>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-500 flex items-start gap-1.5">
              <Info size={13} className="mt-0.5 shrink-0" />
              {t('doctorAvailNote')}
            </p>
          </section>

          {/* Facilities */}
          <section aria-labelledby="fac" className="card p-5 sm:p-6">
            <h2 id="fac" className="flex items-center gap-2 font-extrabold text-lg text-slate-900">
              <CheckCircle2 className="text-brand-700" size={20} />
              {t('facilitiesTitle')}
            </h2>
            <ul className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
              {h.facilities.map((f) => (
                <li
                  key={f}
                  className="flex items-center gap-2 rounded-xl bg-brand-50 border border-brand-100 px-3 py-2.5 font-medium text-brand-900"
                >
                  <CheckCircle2 size={15} className="text-brand-700 shrink-0" />
                  {tFacility(f, lang)}
                </li>
              ))}
            </ul>
            {h.emergency === 'verified' && emergencyNote && (
              <p className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-900">
                <Siren size={17} className="mt-0.5 shrink-0" />
                {emergencyNote}
              </p>
            )}
          </section>

          {/* OPD timings + cost profile */}
          <div className="grid sm:grid-cols-2 gap-5">
            <section aria-labelledby="opd" className="card p-5">
              <h2 id="opd" className="font-extrabold text-lg text-slate-900 flex items-center justify-between gap-2">
                {t('opdTimingsTitle')} <VerificationChip status={h.opdStatus} />
              </h2>
              <p className="mt-2 text-sm text-slate-700 leading-relaxed">{opdTimings ?? t('opdNotListed')}</p>
              <p className="mt-2 text-[11px] text-slate-500">{t('opdChangeNote')}</p>
            </section>
            <section aria-labelledby="cost" className="card p-5">
              <h2 id="cost" className="font-extrabold text-lg text-slate-900">
                {t('costProfileTitle')}
              </h2>
              <p className="mt-2 text-sm font-semibold text-slate-800">{t(COST_KEY[h.costProfile])}</p>
              <p className="mt-2 text-[11px] text-slate-500">
                {t('costProfileNotePre')}
                <Link href="/cost-estimator" className="underline text-brand-800 font-semibold">
                  {t('costProfileNoteLink')}
                </Link>
                {t('costProfileNotePost')}
              </p>
            </section>
          </div>

          {dataNote && (
            <p className="flex items-start gap-2 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
              <Info size={14} className="mt-0.5 shrink-0" />
              {dataNote}
            </p>
          )}
        </div>

        {/* ─── Sticky contact column ─── */}
        <aside className="lg:sticky lg:top-24 flex flex-col gap-4">
          <div className="card p-5 sm:p-6">
            <h2 className="font-extrabold text-lg text-slate-900 flex items-center gap-2">
              <PhoneCall className="text-brand-700" size={20} />
              {t('contactVisitTitle')}
            </h2>
            <dl className="mt-3 text-sm space-y-2.5 text-slate-700">
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                  {t('phoneListedLabel')}
                </dt>
                <dd className="font-semibold">
                  {h.phone ? (
                    <a href={`tel:${h.phone}`} className="text-brand-800 hover:underline">
                      {h.phone}
                    </a>
                  ) : (
                    t('phoneNotListed104')
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                  {t('emergencyLabel')}
                </dt>
                <dd>
                  {h.emergency === 'verified'
                    ? t('emergencyStatusVerified')
                    : h.emergency === 'unverified'
                      ? t('emergencyStatusUnverified')
                      : t('emergencyStatusNone')}
                </dd>
              </div>
            </dl>
            <div className="mt-4">
              <DetailActions hospital={h} />
            </div>
          </div>

          {/* Verification legend */}
          <div className="card p-5">
            <h2 className="font-extrabold text-sm uppercase tracking-wider text-slate-700">
              {t('howToReadLabels')}
            </h2>
            <ul className="mt-2.5 space-y-2 text-xs text-slate-600">
              <li className="flex items-center gap-2">
                <BadgeCheck size={16} className="text-green-700 shrink-0" />
                <span>
                  <strong>{t('verified')}</strong> — {t('legendVerified')}
                </span>
              </li>
              <li className="flex items-center gap-2">
                <HelpCircle size={16} className="text-amber-700 shrink-0" />
                <span>
                  <strong>{t('unverified')}</strong> — {t('legendUnverified')}
                </span>
              </li>
              <li className="flex items-center gap-2">
                <XCircle size={16} className="text-slate-500 shrink-0" />
                <span>
                  <strong>{t('unavailable')}</strong> — {t('legendNotListed')}
                </span>
              </li>
            </ul>
            <a
              href={`mailto:hello@jeevansetu.in?subject=${encodeURIComponent(`Correction: ${h.shortName}`)}`}
              className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-brand-800 hover:underline"
            >
              <Mail size={13} />
              {t('reportIncorrectInfo')}
            </a>
          </div>

          <Link
            href="/emergency"
            className="flex items-center justify-center gap-2 bg-red-700 hover:bg-red-800 text-white font-extrabold rounded-2xl px-4 py-4"
          >
            <Siren size={20} />
            {t('emergencyCall112First')}
          </Link>
        </aside>
      </div>
    </div>
  );
}
