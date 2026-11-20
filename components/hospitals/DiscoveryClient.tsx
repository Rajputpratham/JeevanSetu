'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Search, SlidersHorizontal, Map as MapIcon, List,
  AlertCircle, Building2, Landmark, Siren, X, GitCompareArrows, Info,
  Bookmark, Navigation, Route as RouteIcon,
} from 'lucide-react';
import { useUserLocation } from '@/hooks/useUserLocation';
import { useHospitalDistances } from '@/hooks/useHospitalDistances';
import { formatDistance, isLatLng } from '@/lib/distance';
import { resolveHospitalGeo } from '@/data/hospital-locations';
import { ALL_SPECIALITIES } from '@/data/hospitals';
import HospitalCard, { EnrichedHospital } from '@/components/HospitalCard';
import MapPanel from '@/components/maps/MapPanel';
import FinderLocationControls from '@/components/hospitals/FinderLocationControls';
import VoiceSearchButton from '@/components/VoiceSearchButton';
import { useLang } from '@/lib/i18n';
import { tSpeciality } from '@/lib/i18n-data';
import { useCompare } from '@/lib/compare';
import { useSavedHospitals } from '@/lib/saved';
import { directionsUrl } from '@/lib/geo';
import { distanceStrings } from '@/lib/ui-strings';

/** Legacy Google Routes payload still used by the hospital detail page. */
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
  initialSort?: 'distance'|'rating'|'name'|'type';
  initialQ?: string;
  initialType?: 'government' | 'private' | 'all';
  initialSpeciality?: string;
  initialEmergency?: boolean;
  initialRadius?: number;
  initialEmpty?: boolean;
  initialSavedOnly?: boolean;
}

const locationPath = (query: string) => `/hospitals${query ? '?' + query : ''}`;

export default function DiscoveryClient({
  initialSort = 'distance',
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
  const originControls = useUserLocation();
  const { location } = originControls;

  const [q, setQ] = useState(initialQ);
  const [type, setType] = useState<'all' | 'government' | 'private'>(initialType);
  const [speciality, setSpeciality] = useState(initialSpeciality);
  const [emergencyOnly, setEmergencyOnly] = useState(initialEmergency);
  const [savedOnly, setSavedOnly] = useState(initialSavedOnly);
  const [radius, setRadius] = useState(initialRadius);
  const [sort, setSort] = useState<'distance' | 'rating' | 'name' | 'type'>(initialSort);
  const [showEmptyNotice, setShowEmptyNotice] = useState(initialEmpty && !initialQ && !initialSpeciality);

  const [directory, setDirectory] = useState<{ query: string; results: EnrichedHospital[] } | null>(null);
  const [listError, setListError] = useState(false);
  const [mobileView, setMobileView] = useState<'list' | 'map'>('list');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [selectedHospitalId, setSelectedHospitalId] = useState<string | null>(null);
  const [showTraffic, setShowTraffic] = useState(true);

  const directoryQuery = useMemo(() => {
    const params = new URLSearchParams({ type, lang, unrestrictedRadius: '1' });
    if (q.trim()) params.set('q', q.trim());
    if (speciality) params.set('speciality', speciality);
    if (emergencyOnly) params.set('emergency', '1');
    return params.toString();
  }, [type, lang, q, speciality, emergencyOnly]);
  const results = directory?.query === directoryQuery ? directory.results : null;

  const pending = useRef<AbortController | null>(null);
  const fetchHospitals = useCallback(() => {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setListError(false);
    fetch(`/api/hospitals?${directoryQuery}`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Request failed'))))
      .then((data) => {
        if (!controller.signal.aborted) setDirectory({ query: directoryQuery, results: data.results ?? [] });
      })
      .catch(() => { if (!controller.signal.aborted) setListError(true); });
  }, [directoryQuery]);

  useEffect(() => {
    const timer = setTimeout(fetchHospitals, 180);
    return () => {
      pending.current?.abort();
      clearTimeout(timer);
    };
  }, [fetchHospitals]);

  // Next can restore a cached route tree on Back. Its server props predate any
  // in-place filter edits, so restore the actual history entry before writing it.
  const [urlReady,setUrlReady] = useState(false);
  useEffect(() => {
    const restore = () => {
      if (window.location.pathname !== '/hospitals') return;
      const params = new URLSearchParams(window.location.search);
      const type = params.get('type'), sort = params.get('sort');
      setQ(params.get('q') ?? '');
      setType(type === 'government' || type === 'private' ? type : 'all');
      setSort(sort === 'rating' || sort === 'name' || sort === 'type' ? sort : 'distance');
      setSpeciality(params.get('speciality') ?? '');
      setRadius(Math.min(1000,Math.max(1, Number(params.get('radius')) || 25)));
      setEmergencyOnly(params.get('emergency') === '1');
      setSavedOnly(params.get('saved') === '1');
      setUrlReady(true);
    };
    restore();
    window.addEventListener('popstate',restore);
    return () => window.removeEventListener('popstate',restore);
  }, []);

  // Keep only directory controls in shareable URLs, never a routing origin.
  useEffect(() => {
    if (!urlReady) return;
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (type !== 'all') params.set('type', type);
    if (speciality) params.set('speciality', speciality);
    if (emergencyOnly) params.set('emergency','1');
    if (savedOnly) params.set('saved','1');
    if (radius !== 25) params.set('radius', String(radius));
    if (sort !== 'distance') params.set('sort', sort);
    const search = params.toString();
    window.history.replaceState(null, '', locationPath(search));
  }, [urlReady,q,type,speciality,emergencyOnly,savedOnly,radius,sort]);

  const candidates = useMemo(() => {
    if (!results) return null;
    return savedOnly ? results.filter((h) => savedIds.includes(h.id)) : results;
  }, [results, savedOnly, savedIds]);

  const destinations = useMemo(() => (candidates ?? []).map((hospital) => {
    const geo = resolveHospitalGeo(hospital);
    return geo.valid && geo.confidence === 'verified'
      ? { id: hospital.id, lat: geo.lat, lng: geo.lng }
      : { id: hospital.id };
  }), [candidates]);
  const verifiedIds = useMemo(() => new Set(destinations.filter((h) => h.lat !== undefined).map((h) => h.id)), [destinations]);
  const { distances, retry } = useHospitalDistances(location, destinations);
  const displayedResults = useMemo(() => {
    if (!candidates) return null;
    const km = (id: string) => distances.get(id)?.km ?? Infinity;
    const nearest = (a: EnrichedHospital, b: EnrichedHospital) => km(a.id) - km(b.id) || 0;
    const sorted = [...candidates].sort((a, b) => {
      if (sort === 'name') return a.shortName.localeCompare(b.shortName);
      if (sort === 'type') return a.type.localeCompare(b.type) || nearest(a, b);
      if (sort === 'rating') return (b.communityScore ?? 0) - (a.communityScore ?? 0) || nearest(a, b);
      return nearest(a, b);
    });
    const within = !savedOnly && radius < 500 && sorted.some((h) => km(h.id) <= radius);
    // Keep unknown distances visible; we cannot tell whether they are in range.
    return within ? sorted.filter((h) => km(h.id) <= radius || km(h.id) === Infinity) : sorted;
  }, [candidates, distances, radius, savedOnly, sort]);
  const fellBack = !savedOnly && radius < 500 && [...distances.values()].some((result) => result.km !== null) &&
    ![...distances.values()].some((result) => result.km !== null && result.km <= radius);
  const finderDistanceLabel = useCallback((id: string) => {
    if (!verifiedIds.has(id)) return 'Location not available for this hospital.';
    const result = distances.get(id);
    if (!result) return location ? 'Calculating…' : 'Enable location to see distance';
    return formatDistance(result) + (result.source === 'road' ? ' (estimated)' : '');
  }, [distances, location, verifiedIds]);
  const selectedHospital = displayedResults?.find((h) => h.id === selectedHospitalId);
  const selectedDistance = selectedHospital ? distances.get(selectedHospital.id) : undefined;
  const estimatesLoading = Boolean(location && destinations.some((h) => verifiedIds.has(h.id) && !distances.has(h.id)));

  useEffect(() => { setSelectedHospitalId(null); }, [location]);

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
    setShowEmptyNotice(false);
  };

  const chips = [
    {label:q, clear:()=>setQ('')},
    {label:type === 'all' ? '' : t(type === 'government' ? 'govtBadge' : 'privateBadge'),clear:()=>setType('all')},
    {label:speciality && tSpeciality(speciality,lang), clear:()=>setSpeciality('')},
    {label:emergencyOnly && t('emergency247'),clear:()=>setEmergencyOnly(false)},
    {label:savedOnly && t('savedLabel'),clear:()=>setSavedOnly(false)},
    {label:radius !== 25 && (radius >= 500 ? t('filterRadiusAnywhere') : `${radius} km`),clear:()=>setRadius(25)},
  ].filter(chip=>chip.label);
  const hasActiveFilters = chips.length > 0 || sort !== 'distance';
  const govtCount = useMemo(
    () => displayedResults?.filter((r) => r.type === 'government').length ?? 0,
    [displayedResults],
  );
  const privCount = useMemo(
    () => displayedResults?.filter((r) => r.type === 'private').length ?? 0,
    [displayedResults],
  );

  const ds = distanceStrings(lang);

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

        </div>
      </div>

      {/* ── Central location control (requirement 3) ── */}
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <FinderLocationControls {...originControls} />
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
          {location && (
            <p className="mt-2 text-xs text-slate-600" data-testid="distance-disclosure">
              OSRM driving estimates do not include live traffic. If a road route is unavailable, the labeled straight-line distance is used for nearest sorting and the radius filter.
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
            aria-pressed={hasActiveFilters}
            aria-controls="filter-panel"
          >
            <SlidersHorizontal size={18} />
            {t('filtersBtn')}
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

      {chips.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{chips.map((chip,i)=><button key={i} className="chip min-h-[40px] max-w-full" onClick={chip.clear}><span className="truncate">{chip.label}</span><X size={14}/></button>)}</div>}
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

      <p role="status" className="sr-only">{estimatesLoading ? 'Calculating hospital distances…' : distances.size ? 'Hospital distance estimates updated.' : ''}</p>

      {/* Results: map, selected hospital and list */}
      <div className="mt-3 grid lg:grid-cols-5 gap-4 items-start">
        <div className={`${mobileView === 'map' ? 'block' : 'hidden'} lg:block lg:col-span-2 lg:sticky lg:top-24`}>
          <MapPanel
            hospitals={displayedResults ?? []}
            center={
              isLatLng(selectedHospital)
                ? { lat: selectedHospital.lat, lng: selectedHospital.lng }
                : location
                  ? { lat: location.lat, lng: location.lng }
                  : { lat: 20.5937, lng: 78.9629 }
            }
            zoom={selectedHospital ? 13 : 11}
            userLocation={location}
            finderDistanceLabel={finderDistanceLabel}
            selectedHospitalId={selectedHospitalId}
            onSelectHospital={(id) => handleSelectHospital(id)}
            showTraffic={showTraffic}
          />

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
              <input
                type="checkbox"
                disabled={!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY && !process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY}
                checked={showTraffic && Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY)}
                onChange={(e) => setShowTraffic(e.target.checked)}
                className="h-4 w-4 accent-brand-700"
              />
              Live traffic layer
            </label>
          </div>

          {selectedHospital && (
            <div className="mt-3 card p-4 border-2 border-brand-500 bg-brand-50/40" data-testid="selected-route-panel">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-extrabold text-sm text-slate-900">{selectedHospital.name}</h2>
                  <p className="mt-0.5 text-xs text-slate-600">
                    {verifiedIds.has(selectedHospital.id) ? ds.verifiedCoords : ds.approxCoords}
                  </p>
                </div>
                <button type="button" onClick={() => setSelectedHospitalId(null)} aria-label="Close destination preview"
                  className="text-slate-500 hover:text-slate-700 p-1"><X size={16} /></button>
              </div>
              <p className="mt-2 flex items-center gap-1 text-sm font-bold text-brand-900">
                <RouteIcon size={15} aria-hidden="true" />
                {!verifiedIds.has(selectedHospital.id) ? 'Location not available for this hospital.'
                  : location && !selectedDistance ? 'Calculating…' : formatDistance(selectedDistance)}
              </p>
              {selectedDistance?.source === 'road' && <p className="text-xs text-slate-600">Estimated driving route, no live traffic</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                <a href={directionsUrl(selectedHospital.lat, selectedHospital.lng, `${selectedHospital.name}, ${selectedHospital.address}`, location)}
                  target="_blank" rel="noopener noreferrer" className="btn-primary !py-2 !px-3 !text-xs !min-h-[38px] flex-1">
                  <Navigation size={14} /> {ds.navigateGmaps}
                </a>
                <Link href={`/hospitals/${selectedHospital.id}`} className="btn-secondary !py-2 !px-3 !text-xs !min-h-[38px]">
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
                {savedOnly && !savedIds.length ? (lang === 'hi' ? 'अभी कोई अस्पताल सहेजा नहीं गया है' : 'No saved hospitals yet') : q.trim() ? t('noHospitalsMatchQuery', { query: q.trim() }) : t('noHospitalsMatch')}
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
                finderDistance={{
                  origin: location,
                  verified: verifiedIds.has(h.id),
                  result: distances.get(h.id),
                  error: originControls.error,
                  locating: originControls.loading,
                  enable: originControls.request,
                  retry: () => {
                    const destination = destinations.find((item) => item.id === h.id);
                    if (destination) retry(destination);
                  },
                }}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
