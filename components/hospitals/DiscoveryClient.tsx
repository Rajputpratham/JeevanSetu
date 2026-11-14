'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Search, LocateFixed, Loader2, SlidersHorizontal, Map as MapIcon, List,
  AlertCircle, Building2, Landmark, Siren, X, MapPin, GitCompareArrows, Info,
  Bookmark, Clock, Navigation, Route as RouteIcon,
} from 'lucide-react';
import { useUserLocation } from '@/lib/useLocation';
import { ALL_SPECIALITIES } from '@/data/hospitals';
import HospitalCard, { EnrichedHospital } from '@/components/HospitalCard';
import MapPanel from '@/components/maps/MapPanel';
import LocationControls from '@/components/LocationControls';
import VoiceSearchButton from '@/components/VoiceSearchButton';
import { useLang } from '@/lib/i18n';
import { tSpeciality } from '@/lib/i18n-data';
import { useCompare } from '@/lib/compare';
import { useSavedHospitals } from '@/lib/saved';
import { formatDrivingKm, formatDuration, directionsUrl } from '@/lib/geo';
import { distanceStrings, locationStrings } from '@/lib/ui-strings';

/** Shape returned by /api/route (Google Routes derived). */
export interface RouteDetailPayload {
  hospitalId: string;
  distanceKm: number | null;
  distanceMeters: number | null;
  etaMinutes: number | null;
  staticMinutes: number | null;
  trafficImpactMinutes: number | null;
  straightKm: number | null;
  source: 'google-routes-api' | 'google-route-matrix' | 'unavailable';
  computedAt: string | null;
  error: string | null;
  disclosure: { text: string; live: boolean };
  geometry: [number, number][];
  alternatives: { distanceKm: number; etaMinutes: number; description: string | null; labels: string[] }[];
  selectedIndex: number;
  polylineSource: string;
  navigateUrl: string | null;
}

interface DiscoveryProps {
  initialQ?: string;
  initialType?: 'government' | 'private' | 'all';
  initialSpeciality?: string;
  initialEmergency?: boolean;
  initialRadius?: number;
  initialEmpty?: boolean;
  initialSavedOnly?: boolean;
}

export default function DiscoveryClient({
  initialQ = '',
  initialType = 'all',
  initialSpeciality = '',
  initialEmergency = false,
  initialRadius = 25,
  initialEmpty = false,
  initialSavedOnly = false,
}: DiscoveryProps) {
  const { t, lang } = useLang();
  const { ids: compareIds } = useCompare();
  const { savedIds } = useSavedHospitals();
  const { location, requestGeolocation, status, errorCode, hasLocation } = useUserLocation();

  const [q, setQ] = useState(initialQ);
  const [type, setType] = useState<'all' | 'government' | 'private'>(initialType);
  const [speciality, setSpeciality] = useState(initialSpeciality);
  const [emergencyOnly, setEmergencyOnly] = useState(initialEmergency);
  const [savedOnly, setSavedOnly] = useState(initialSavedOnly);
  const [radius, setRadius] = useState(initialRadius);
  const [sort, setSort] = useState<'distance' | 'rating' | 'name' | 'type'>('distance');
  const [showEmptyNotice, setShowEmptyNotice] = useState(initialEmpty && !initialQ && !initialSpeciality);

  const [results, setResults] = useState<EnrichedHospital[] | null>(null);
  const [fellBack, setFellBack] = useState(false);
  const [listError, setListError] = useState(false);
  const [mobileView, setMobileView] = useState<'list' | 'map'>('list');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [selectedHospitalId, setSelectedHospitalId] = useState<string | null>(null);
  const [activeRoute, setActiveRoute] = useState<RouteDetailPayload | null>(null);
  const [routeBusy, setRouteBusy] = useState(false);
  const [showTraffic, setShowTraffic] = useState(true);
  const [distanceMeta, setDistanceMeta] = useState<{
    source: string;
    disclosure: { text: string; live: boolean };
    blockers: string[];
    computedAt: string;
  } | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchHospitals = useCallback(() => {
    /**
     * No origin → no request. The previous version silently sent Delhi's
     * coordinates, which is how different pages ended up showing different
     * distances for the same hospital.
     */
    if (!hasLocation) {
      setResults(null);
      setDistanceMeta(null);
      return;
    }
    const params = new URLSearchParams({
      lat: String(location.lat),
      lng: String(location.lng),
      source: location.source,
      radius: String(savedOnly ? 1000 : radius),
      type,
      sort,
      lang,
    });
    if (q.trim()) params.set('q', q.trim());
    if (speciality) params.set('speciality', speciality);
    if (emergencyOnly) params.set('emergency', '1');
    setListError(false);
    fetch(`/api/hospitals?${params}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Request failed'))))
      .then((data) => {
        setResults(data.results ?? []);
        setFellBack(Boolean(data.fellBack));
        setDistanceMeta({
          source: data.distanceSource ?? 'unavailable',
          disclosure: data.distanceDisclosure ?? { text: '', live: false },
          blockers: data.blockers ?? [],
          computedAt: data.travelComputedAt ?? '',
        });
      })
      .catch(() => setListError(true));
  }, [hasLocation, location.lat, location.lng, location.source, radius, savedOnly, type, speciality, emergencyOnly, q, sort, lang]);

  // Debounced refetch on control change (preserves origin, selectedHospitalId, and filters across language switch!)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(fetchHospitals, 180);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fetchHospitals]);

  const displayedResults = useMemo(() => {
    if (!results) return null;
    if (!savedOnly) return results;
    return results.filter((h) => savedIds.includes(h.id));
  }, [results, savedOnly, savedIds]);

  const selectedHospital = useMemo(
    () => displayedResults?.find((h) => h.id === selectedHospitalId) ?? null,
    [displayedResults, selectedHospitalId],
  );

  /**
   * Route preview for the selected hospital.
   *
   * Requested by stable hospital id so the SERVER resolves the destination from
   * the verified coordinate registry — the client can never pass a stale or
   * wrong coordinate into a distance calculation. The `cancelled` flag discards
   * out-of-order responses so an older route can never overwrite a newer one.
   */
  useEffect(() => {
    if (!selectedHospital || !hasLocation || !Number.isFinite(location.lat)) {
      setActiveRoute(null);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    setRouteBusy(true);
    setActiveRoute(null);
    fetch(
      `/api/route?fromLat=${location.lat}&fromLng=${location.lng}&hospitalId=${encodeURIComponent(
        selectedHospital.id,
      )}&lang=${lang}`,
      { signal: controller.signal },
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((data: RouteDetailPayload | null) => {
        if (!cancelled) setActiveRoute(data);
      })
      .catch(() => {
        if (!cancelled) setActiveRoute(null);
      })
      .finally(() => {
        if (!cancelled) setRouteBusy(false);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [selectedHospital, hasLocation, location.lat, location.lng, lang]);

  const handleSelectHospital = useCallback((hospitalId: string) => {
    setSelectedHospitalId(hospitalId);
    if (typeof document !== 'undefined') {
      const el = document.getElementById(`hospital-card-${hospitalId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, []);

  const clearFilters = () => {
    setQ('');
    setType('all');
    setSpeciality('');
    setEmergencyOnly(false);
    setSavedOnly(false);
    setRadius(25);
    setSort('distance');
    setSelectedHospitalId(null);
    setActiveRoute(null);
    setShowEmptyNotice(false);
  };

  const hasActiveFilters = q !== '' || type !== 'all' || speciality !== '' || emergencyOnly || savedOnly;
  const govtCount = useMemo(
    () => displayedResults?.filter((r) => r.type === 'government').length ?? 0,
    [displayedResults],
  );
  const privCount = useMemo(
    () => displayedResults?.filter((r) => r.type === 'private').length ?? 0,
    [displayedResults],
  );

  const ls = locationStrings(lang);
  const ds = distanceStrings(lang);
  const geoErrorText =
    errorCode === 'unavailable'
      ? t('geoUnavailableError')
      : errorCode === 'denied'
        ? ls.denied
        : errorCode === 'position-unavailable' || errorCode === 'timeout'
          ? t('geoFailedError')
          : null;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
      {/* Page heading */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-brand-700">{t('discoveryEyebrow')}</p>
          <h1 className="mt-1 text-3xl sm:text-4xl font-extrabold tracking-tight text-brand-950">{t('discoveryTitle')}</h1>
          <p className="mt-1 text-slate-600 max-w-2xl">{t('discoverySub')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 text-sm">
          <button
            type="button"
            onClick={() => setSavedOnly((v) => !v)}
            aria-pressed={savedOnly}
            className={`btn !py-2.5 !px-4 !text-sm border-2 ${
              savedOnly
                ? 'border-amber-600 bg-amber-50 text-amber-900'
                : 'border-slate-200 bg-white text-slate-700 hover:border-amber-400'
            }`}
          >
            <Bookmark size={16} className={savedOnly ? 'fill-amber-500 text-amber-600' : ''} />
            {t('savedLabel')} ({savedIds.length})
          </button>
          <button
            type="button"
            onClick={requestGeolocation}
            disabled={status === 'locating'}
            className="btn-primary !py-2.5 !text-sm"
          >
            {status === 'locating' ? <Loader2 size={17} className="animate-spin" /> : <LocateFixed size={17} />}{' '}
            {t('useMyLocation')}
          </button>
        </div>
      </div>

      {/* ── Central location control (requirement 3) ── */}
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <LocationControls onOriginChange={() => setSelectedHospitalId(null)} />
        </div>
        <div className="card p-4 lg:col-span-2">
          <label htmlFor="hosp-search" className="label">
            {t('searchHospitalLabel')}
          </label>
          <div className="relative flex items-center">
            <Search size={20} className="absolute left-4 text-slate-400 pointer-events-none" aria-hidden="true" />
            <input
              id="hosp-search"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                if (showEmptyNotice) setShowEmptyNotice(false);
              }}
              placeholder={t('searchHospitalPlaceholder')}
              className="input !pl-12 !pr-12"
              autoComplete="off"
            />
            <div className="absolute right-2">
              <VoiceSearchButton
                onTranscript={(txt) => {
                  setQ(txt);
                  if (showEmptyNotice) setShowEmptyNotice(false);
                }}
              />
            </div>
          </div>
          {geoErrorText && (
            <p role="alert" className="mt-2 flex items-center gap-1.5 text-xs text-red-700">
              <AlertCircle size={14} className="shrink-0" />
              {geoErrorText}
            </p>
          )}
          {!hasLocation && (
            <p role="status" className="mt-2 flex items-start gap-1.5 text-xs text-amber-800">
              <Info size={14} className="mt-0.5 shrink-0" />
              {ls.notSetWhy}
            </p>
          )}
          {distanceMeta && (
            <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-snug text-slate-500" data-testid="distance-disclosure">
              <RouteIcon size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>
                {distanceMeta.disclosure.text}
                {distanceMeta.blockers.length > 0 && (
                  <span className="mt-0.5 block font-semibold text-amber-800">{distanceMeta.blockers[0]}</span>
                )}
              </span>
            </p>
          )}
        </div>
      </div>

      {/* Empty search notice */}
      {showEmptyNotice && (
        <div
          role="status"
          className="mt-4 flex items-start justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
        >
          <p className="flex items-start gap-2">
            <Info size={17} className="mt-0.5 shrink-0 text-amber-700" />
            <span>{t('emptySearchBanner')}</span>
          </p>
          <button
            type="button"
            onClick={() => setShowEmptyNotice(false)}
            aria-label={t('clearFilters')}
            className="text-amber-800 hover:text-amber-950 p-1"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Filters bar */}
      <div className="mt-3 card p-3 sm:p-4">
        <div className="flex lg:hidden items-center justify-between">
          <button
            type="button"
            onClick={() => setFiltersOpen(!filtersOpen)}
            className="btn-ghost !text-sm"
            aria-expanded={filtersOpen}
            aria-controls="filter-panel"
          >
            <SlidersHorizontal size={18} /> {t('filtersBtn')} {hasActiveFilters && '•'}
          </button>
          <div
            className="flex rounded-xl border border-slate-200 overflow-hidden text-sm font-bold"
            role="group"
            aria-label={t('viewModeAria')}
          >
            <button
              type="button"
              onClick={() => setMobileView('list')}
              aria-pressed={mobileView === 'list'}
              className={`flex items-center gap-1.5 px-4 py-2.5 ${
                mobileView === 'list' ? 'bg-brand-700 text-white' : 'bg-white text-slate-600'
              }`}
            >
              <List size={16} />
              {t('listView')}
            </button>
            <button
              type="button"
              onClick={() => setMobileView('map')}
              aria-pressed={mobileView === 'map'}
              className={`flex items-center gap-1.5 px-4 py-2.5 ${
                mobileView === 'map' ? 'bg-brand-700 text-white' : 'bg-white text-slate-600'
              }`}
            >
              <MapIcon size={16} />
              {t('mapView')}
            </button>
          </div>
        </div>
        <div
          id="filter-panel"
          className={`${
            filtersOpen ? 'grid' : 'hidden'
          } lg:grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2 items-end mt-2 lg:mt-0`}
        >
          <div>
            <label htmlFor="f-type" className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
              {t('filterTypeLabel')}
            </label>
            <select
              id="f-type"
              value={type}
              onChange={(e) => setType(e.target.value as typeof type)}
              className="input !py-2.5 !text-sm mt-1"
            >
              <option value="all">{t('filterTypeAll')}</option>
              <option value="government">{t('filterTypeGovt')}</option>
              <option value="private">{t('filterTypePrivate')}</option>
            </select>
          </div>
          <div className="col-span-2 md:col-span-1">
            <label htmlFor="f-spec" className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
              {t('filterSpecLabel')}
            </label>
            <select
              id="f-spec"
              value={speciality}
              onChange={(e) => {
                setSpeciality(e.target.value);
                if (showEmptyNotice) setShowEmptyNotice(false);
              }}
              className="input !py-2.5 !text-sm mt-1"
            >
              <option value="">{t('allSpecialities')}</option>
              {ALL_SPECIALITIES.map((s) => (
                <option key={s} value={s}>
                  {tSpeciality(s, lang)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="f-radius" className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
              {t('filterRadiusLabel')}
            </label>
            <select
              id="f-radius"
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              className="input !py-2.5 !text-sm mt-1"
            >
              {[5, 10, 25, 50, 100, 500].map((r) => (
                <option key={r} value={r}>
                  {r === 500 ? t('filterRadiusAnywhere') : t('filterRadiusWithin', { km: r })}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="f-sort" className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
              {t('filterSortLabel')}
            </label>
            <select
              id="f-sort"
              value={sort}
              onChange={(e) => setSort(e.target.value as typeof sort)}
              className="input !py-2.5 !text-sm mt-1"
            >
              <option value="distance">{t('filterSortDistance')}</option>
              <option value="rating">{t('filterSortRating')}</option>
              <option value="name">{t('filterSortName')}</option>
              <option value="type">{t('filterSortType')}</option>
            </select>
          </div>
          <div className="flex items-center">
            <label className="flex items-center gap-2 cursor-pointer select-none rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 w-full min-h-[48px]">
              <input
                type="checkbox"
                checked={emergencyOnly}
                onChange={(e) => setEmergencyOnly(e.target.checked)}
                className="w-5 h-5 accent-red-700"
              />
              <span className="text-sm font-bold text-red-800 flex items-center gap-1.5">
                <Siren size={16} />
                {t('emergency247')}
              </span>
            </label>
          </div>
          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-red-700 py-2"
              >
                <X size={16} /> {t('clearFilters')}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Compare status banner */}
      {compareIds.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm">
          <span className="inline-flex items-center gap-2 font-semibold text-brand-900">
            <GitCompareArrows size={17} className="text-brand-700" />
            {t('compareBarText', { count: compareIds.length })}
          </span>
          <Link href="/compare" className="font-extrabold text-brand-800 hover:underline">
            {t('compareBarAction')}
          </Link>
        </div>
      )}

      {/* Result summary */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600" aria-live="polite">
        <p>
          <strong className="text-brand-800">{displayedResults === null ? '…' : displayedResults.length}</strong>{' '}
          {displayedResults?.length === 1 ? t('hospitalFoundOne') : t('hospitalFoundMany')}
          {displayedResults !== null && displayedResults.length > 0 && (
            <>
              {' '}
              ·{' '}
              <span className="inline-flex items-center gap-1">
                <Landmark size={13} />
                {govtCount} {t('govtShort')}
              </span>{' '}
              ·{' '}
              <span className="inline-flex items-center gap-1">
                <Building2 size={13} />
                {privCount} {t('privateShort')}
              </span>
            </>
          )}
        </p>
        {fellBack && displayedResults !== null && displayedResults.length > 0 && !savedOnly && (
          <p role="status" className="text-amber-800 font-medium">
            {t('fallbackRadiusNote')}
          </p>
        )}
      </div>

      {/* Results: map + route preview + list */}
      <div className="mt-3 grid lg:grid-cols-5 gap-4 items-start">
        <div className={`${mobileView === 'map' ? 'block' : 'hidden'} lg:block lg:col-span-2 lg:sticky lg:top-24`}>
          <MapPanel
            hospitals={displayedResults ?? []}
            center={
              selectedHospital
                ? { lat: selectedHospital.lat, lng: selectedHospital.lng }
                : hasLocation
                  ? { lat: location.lat as number, lng: location.lng as number }
                  : { lat: 20.5937, lng: 78.9629 }
            }
            zoom={selectedHospital ? 13 : 11}
            userLocation={
              hasLocation && typeof location.lat === 'number' && typeof location.lng === 'number'
                ? { lat: location.lat, lng: location.lng, accuracyM: location.accuracyM }
                : null
            }
            selectedHospitalId={selectedHospitalId}
            onSelectHospital={(id) => handleSelectHospital(id)}
            routeGeometry={activeRoute?.geometry ?? null}
            showTraffic={showTraffic}
          />

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
              <input
                type="checkbox"
                checked={showTraffic}
                onChange={(e) => setShowTraffic(e.target.checked)}
                className="h-4 w-4 accent-brand-700"
              />
              Live traffic layer
            </label>
            <span className="text-[10px] text-slate-400">
              {distanceMeta?.computedAt
                ? `${ds.lastUpdated}: ${new Date(distanceMeta.computedAt).toLocaleTimeString()}`
                : ds.sourceGoogle}
            </span>
          </div>

          {/* Selected route: Google-derived distance, ETA, traffic impact */}
          {selectedHospital && (
            <div
              className="mt-3 card p-4 border-2 border-brand-500 bg-brand-50/40"
              data-testid="selected-route-panel"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[11px] font-extrabold uppercase tracking-wider text-brand-700 flex items-center gap-1">
                    <RouteIcon size={13} /> {ds.drivingDistance}
                  </p>
                  <h2 className="font-extrabold text-sm text-slate-900 mt-0.5">{selectedHospital.name}</h2>
                  <p className="mt-0.5 text-[10px] text-slate-500">
                    {selectedHospital.geoConfidence === 'verified' ? ds.verifiedCoords : ds.approxCoords}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedHospitalId(null);
                    setActiveRoute(null);
                  }}
                  aria-label="Close route preview"
                  className="text-slate-400 hover:text-slate-700 p-1"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="mt-2.5 grid grid-cols-2 gap-2 text-center">
                <div className="rounded-xl bg-white border border-brand-100 p-2.5">
                  <p className="text-[10px] uppercase font-bold text-slate-500">{ds.drivingDistance}</p>
                  <p className="text-base font-black text-brand-900" data-testid="route-panel-distance">
                    {routeBusy
                      ? '…'
                      : formatDrivingKm(activeRoute?.distanceKm ?? selectedHospital.roadKm ?? null, lang) ?? '—'}
                  </p>
                </div>
                <div className="rounded-xl bg-white border border-brand-100 p-2.5">
                  <p className="text-[10px] uppercase font-bold text-slate-500">{ds.eta}</p>
                  <p className="text-base font-black text-brand-900 flex items-center justify-center gap-1" data-testid="route-panel-eta">
                    {routeBusy ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : activeRoute?.etaMinutes || selectedHospital.etaMinutes ? (
                      <>
                        <Clock size={14} className="text-brand-700" /> ~
                        {formatDuration(activeRoute?.etaMinutes ?? selectedHospital.etaMinutes, lang)}
                      </>
                    ) : (
                      <span className="text-xs font-bold text-amber-800">{ds.noLiveTraffic}</span>
                    )}
                  </p>
                </div>
              </div>

              {typeof (activeRoute?.trafficImpactMinutes ?? selectedHospital.trafficImpactMinutes) === 'number' && (
                <p className="mt-2 text-[11px] font-semibold text-amber-900">
                  {ds.trafficImpact}: +{activeRoute?.trafficImpactMinutes ?? selectedHospital.trafficImpactMinutes} min
                </p>
              )}

              {activeRoute?.alternatives && activeRoute.alternatives.length > 1 && (
                <p className="mt-1 text-[10px] text-slate-500">
                  {ds.alternatives}: {activeRoute.alternatives.length - 1} ·{' '}
                  {ds.sameRouteNote}
                </p>
              )}

              {(activeRoute?.disclosure.text || distanceMeta?.disclosure.text) && (
                <p className="mt-2 text-[10px] text-slate-500 leading-snug">
                  {activeRoute?.disclosure.text || distanceMeta?.disclosure.text}
                </p>
              )}
              {activeRoute?.error && (
                <p className="mt-1 text-[10px] font-semibold text-amber-800" data-testid="route-error">
                  {activeRoute.error} — {ds.distanceUnavailableWhy}
                </p>
              )}

              <div className="mt-2 flex flex-wrap gap-2">
                <a
                  href={
                    activeRoute?.navigateUrl ??
                    directionsUrl(
                      selectedHospital.lat,
                      selectedHospital.lng,
                      selectedHospital.shortName,
                      hasLocation && typeof location.lat === 'number' && typeof location.lng === 'number'
                        ? { lat: location.lat, lng: location.lng }
                        : null,
                    )
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary !py-2 !px-3 !text-xs !min-h-[38px] flex-1"
                >
                  <Navigation size={14} /> {ds.navigateGmaps}
                </a>
                <Link
                  href={`/hospitals/${selectedHospital.id}`}
                  className="btn-secondary !py-2 !px-3 !text-xs !min-h-[38px]"
                >
                  {t('viewDetails')} →
                </Link>
              </div>
            </div>
          )}
        </div>

        <div className={`${mobileView === 'list' ? 'grid' : 'hidden'} lg:grid gap-4 lg:col-span-3`}>
          {listError ? (
            <div role="alert" className="card p-6 text-center">
              <AlertCircle className="mx-auto text-red-600" size={32} />
              <p className="mt-2 font-semibold text-slate-800">{t('listLoadError')}</p>
              <button type="button" onClick={fetchHospitals} className="btn-primary mt-4">
                {t('retryBtn')}
              </button>
            </div>
          ) : !hasLocation ? (
            <div className="card p-6 text-center" role="status" data-testid="origin-required">
              <MapPin className="mx-auto text-brand-400" size={34} />
              <h2 className="mt-2 font-bold text-lg text-slate-800">{ls.notSet}</h2>
              <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">{ls.notSetWhy}</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <button type="button" onClick={requestGeolocation} className="btn-primary !py-2.5 !text-sm">
                  <LocateFixed size={16} /> {ls.usePrecise}
                </button>
              </div>
            </div>
          ) : displayedResults === null ? (
            [0, 1, 2].map((i) => (
              <div key={i} className="card p-5 animate-pulse" aria-hidden="true">
                <div className="h-5 w-2/3 bg-slate-200 rounded" />
                <div className="h-4 w-1/2 bg-slate-100 rounded mt-3" />
                <div className="h-4 w-full bg-slate-100 rounded mt-3" />
                <div className="h-4 w-4/5 bg-slate-100 rounded mt-2" />
              </div>
            ))
          ) : displayedResults.length === 0 ? (
            <div className="card p-8 text-center">
              <Search className="mx-auto text-slate-300" size={36} />
              <h2 className="mt-2 font-bold text-lg text-slate-800">
                {q.trim() ? t('noHospitalsMatchQuery', { query: q.trim() }) : t('noHospitalsMatch')}
              </h2>
              <p className="mt-1 text-sm text-slate-600">{t('noHospitalsMatchHint')}</p>
              <button type="button" onClick={clearFilters} className="btn-primary mt-4">
                {t('clearAllFilters')}
              </button>
            </div>
          ) : (
            displayedResults.map((h, idx) => (
              <HospitalCard
                key={h.id}
                hospital={h}
                markerIndex={idx + 1}
                selected={selectedHospitalId === h.id}
                onSelect={handleSelectHospital}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
