'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Search, LocateFixed, Loader2, SlidersHorizontal, Map as MapIcon, List,
  AlertCircle, Building2, Landmark, Siren, X, MapPin, GitCompareArrows, Info,
} from 'lucide-react';
import { useUserLocation, CITY_PRESETS } from '@/lib/useLocation';
import { ALL_SPECIALITIES } from '@/data/hospitals';
import { Hospital } from '@/data/types';
import HospitalCard from '@/components/HospitalCard';
import MapViewClient from '@/components/MapViewClient';
import { useLang } from '@/lib/i18n';
import { tCity, tPresetLabel, tSpeciality, tState } from '@/lib/i18n-data';
import { useCompare } from '@/lib/compare';

type ResultHospital = Hospital & { distanceKm: number };

interface DiscoveryProps {
  initialQ?: string;
  initialType?: 'government' | 'private' | 'all';
  initialSpeciality?: string;
  initialEmergency?: boolean;
  initialRadius?: number;
  initialEmpty?: boolean;
}

export default function DiscoveryClient({
  initialQ = '', initialType = 'all', initialSpeciality = '', initialEmergency = false, initialRadius = 25, initialEmpty = false,
}: DiscoveryProps) {
  const { t, lang } = useLang();
  const { ids: compareIds } = useCompare();
  const { location, setManual, requestGeolocation, status, errorCode } = useUserLocation();

  const [q, setQ] = useState(initialQ);
  const [type, setType] = useState<'all' | 'government' | 'private'>(initialType);
  const [speciality, setSpeciality] = useState(initialSpeciality);
  const [emergencyOnly, setEmergencyOnly] = useState(initialEmergency);
  const [radius, setRadius] = useState(initialRadius);
  const [sort, setSort] = useState<'distance' | 'name' | 'type'>('distance');
  const [showEmptyNotice, setShowEmptyNotice] = useState(initialEmpty && !initialQ && !initialSpeciality);

  const [manualInput, setManualInput] = useState('');
  const [manualResults, setManualResults] = useState<{ label: string; lat: number; lng: number }[] | null>(null);
  const [manualBusy, setManualBusy] = useState(false);
  const [manualErrorKey, setManualErrorKey] = useState<'manualMinCharsError' | 'manualNoMatchError' | 'manualOfflineError' | null>(null);

  const [results, setResults] = useState<ResultHospital[] | null>(null);
  const [fellBack, setFellBack] = useState(false);
  const [listError, setListError] = useState(false);
  const [mobileView, setMobileView] = useState<'list' | 'map'>('list');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchHospitals = useCallback(() => {
    const params = new URLSearchParams({
      lat: String(location.lat), lng: String(location.lng),
      radius: String(radius), type, sort, lang,
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
      })
      .catch(() => setListError(true));
  }, [location.lat, location.lng, radius, type, speciality, emergencyOnly, q, sort, lang]);

  // Debounced refetch on any control change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(fetchHospitals, 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [fetchHospitals]);

  const runManualGeocode = useCallback(async () => {
    const query = manualInput.trim();
    setManualErrorKey(null);
    if (query.length < 2) { setManualErrorKey('manualMinCharsError'); return; }
    setManualBusy(true);
    setManualResults(null);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&countrycodes=in&limit=5&q=${encodeURIComponent(query)}`, { headers: { 'Accept-Language': lang } });
      if (!res.ok) throw new Error('geocode failed');
      const data: { display_name: string; lat: string; lon: string }[] = await res.json();
      if (data.length === 0) {
        setManualErrorKey('manualNoMatchError');
      } else {
        setManualResults(data.map((d) => ({ label: d.display_name.split(',').slice(0, 3).join(', '), lat: parseFloat(d.lat), lng: parseFloat(d.lon) })));
      }
    } catch {
      const presets = CITY_PRESETS.filter(
        (c) => c.label.toLowerCase().includes(query.toLowerCase()) || tCity(c.label, 'hi').includes(query),
      ).map((c) => ({ label: `${tCity(c.label, lang)}, ${tState(c.state, lang)}`, lat: c.lat, lng: c.lng }));
      if (presets.length) setManualResults(presets);
      else setManualErrorKey('manualOfflineError');
    } finally {
      setManualBusy(false);
    }
  }, [manualInput, lang]);

  const clearFilters = () => {
    setQ(''); setType('all'); setSpeciality(''); setEmergencyOnly(false); setRadius(25); setSort('distance');
    setShowEmptyNotice(false);
  };

  const hasActiveFilters = q !== '' || type !== 'all' || speciality !== '' || emergencyOnly;
  const govtCount = useMemo(() => results?.filter((r) => r.type === 'government').length ?? 0, [results]);
  const privCount = useMemo(() => results?.filter((r) => r.type === 'private').length ?? 0, [results]);

  const displayLocationLabel =
    location.source === 'default'
      ? t('defaultLocationLabel')
      : location.source === 'geolocation'
        ? t('yourLocation')
        : tPresetLabel(location.label, lang);

  const geoErrorText =
    errorCode === 'unavailable'
      ? t('geoUnavailableError')
      : errorCode === 'denied'
        ? t('geoDeniedError')
        : errorCode === 'failed'
          ? t('geoFailedError')
          : null;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
      {/* Page heading */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-brand-700">{t('discoveryEyebrow')}</p>
          <h1 className="mt-1 text-3xl sm:text-4xl font-extrabold tracking-tight text-brand-950">{t('discoveryTitle')}</h1>
          <p className="mt-1 text-slate-600 max-w-xl">{t('discoverySub')}</p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <button type="button" onClick={requestGeolocation} disabled={status === 'locating'} className="btn-primary !py-2.5 !text-sm">
            {status === 'locating' ? <Loader2 size={17} className="animate-spin" /> : <LocateFixed size={17} />} {t('useMyLocation')}
          </button>
        </div>
      </div>

      {/* Location status */}
      <p className="mt-2 text-xs text-slate-500 flex items-center gap-1.5">
        <MapPin size={13} className="shrink-0" /> {t('showingResultsAround')} <strong className="text-slate-700">{displayLocationLabel}</strong>
      </p>
      {geoErrorText && <p role="alert" className="mt-1.5 flex items-center gap-1.5 text-xs text-red-700"><AlertCircle size={14} className="shrink-0" />{geoErrorText}</p>}

      {/* Empty search notice */}
      {showEmptyNotice && (
        <div role="status" className="mt-4 flex items-start justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="flex items-start gap-2">
            <Info size={17} className="mt-0.5 shrink-0 text-amber-700" />
            <span>{t('emptySearchBanner')}</span>
          </p>
          <button type="button" onClick={() => setShowEmptyNotice(false)} aria-label={t('clearFilters')} className="text-amber-800 hover:text-amber-950 p-1">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Search + manual location */}
      <div className="card mt-4 p-4 sm:p-5 grid gap-3 lg:grid-cols-2">
        <div>
          <label htmlFor="hosp-search" className="label">{t('searchHospitalLabel')}</label>
          <div className="relative">
            <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              id="hosp-search"
              value={q}
              onChange={(e) => { setQ(e.target.value); if (showEmptyNotice) setShowEmptyNotice(false); }}
              placeholder={t('searchHospitalPlaceholder')}
              className="input !pl-12"
              autoComplete="off"
            />
          </div>
        </div>
        <div>
          <label htmlFor="manual-loc" className="label">{t('manualLocationLabel')}</label>
          <div className="flex gap-2">
            <input id="manual-loc" value={manualInput} onChange={(e) => { setManualInput(e.target.value); setManualResults(null); setManualErrorKey(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); runManualGeocode(); } }}
              placeholder={t('manualLocationPlaceholder')} className="input" aria-describedby="manual-hint" />
            <button type="button" onClick={runManualGeocode} disabled={manualBusy} className="btn-secondary !px-4" aria-label={t('searchLocationAria')}>
              {manualBusy ? <Loader2 size={20} className="animate-spin" /> : <Search size={20} />}
            </button>
          </div>
          <p id="manual-hint" className="sr-only">{t('manualHintSr')}</p>
          {manualErrorKey && <p role="alert" className="mt-1.5 text-xs text-red-700">{t(manualErrorKey)}</p>}
          {manualResults && (
            <ul className="mt-1.5 rounded-xl border border-slate-200 bg-white shadow-lg divide-y divide-slate-100 overflow-hidden">
              {manualResults.map((r) => (
                <li key={`${r.lat}-${r.lng}-${r.label}`}>
                  <button type="button" onClick={() => { setManual(r.lat, r.lng, r.label); setManualResults(null); setManualInput(''); }}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-brand-50 focus:bg-brand-50">{r.label}</button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="text-[11px] text-slate-500 py-1">{t('quickPicks')}</span>
            {CITY_PRESETS.slice(0, 8).map((c) => (
              <button key={c.label} type="button" onClick={() => setManual(c.lat, c.lng, `${c.label}, ${c.state}`, 'preset')}
                className="text-[11px] font-semibold rounded-full border border-slate-200 px-2.5 py-1 text-slate-600 hover:border-brand-500 hover:text-brand-800">{tCity(c.label, lang)}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Filters bar */}
      <div className="mt-3 card p-3 sm:p-4">
        <div className="flex lg:hidden items-center justify-between">
          <button type="button" onClick={() => setFiltersOpen(!filtersOpen)} className="btn-ghost !text-sm" aria-expanded={filtersOpen} aria-controls="filter-panel">
            <SlidersHorizontal size={18} /> {t('filtersBtn')} {hasActiveFilters && '•'}
          </button>
          <div className="flex rounded-xl border border-slate-200 overflow-hidden text-sm font-bold" role="group" aria-label={t('viewModeAria')}>
            <button type="button" onClick={() => setMobileView('list')} aria-pressed={mobileView === 'list'} className={`flex items-center gap-1.5 px-4 py-2.5 ${mobileView === 'list' ? 'bg-brand-700 text-white' : 'bg-white text-slate-600'}`}><List size={16} />{t('listView')}</button>
            <button type="button" onClick={() => setMobileView('map')} aria-pressed={mobileView === 'map'} className={`flex items-center gap-1.5 px-4 py-2.5 ${mobileView === 'map' ? 'bg-brand-700 text-white' : 'bg-white text-slate-600'}`}><MapIcon size={16} />{t('mapView')}</button>
          </div>
        </div>
        <div id="filter-panel" className={`${filtersOpen ? 'grid' : 'hidden'} lg:grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2 items-end mt-2 lg:mt-0`}>
          <div>
            <label htmlFor="f-type" className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{t('filterTypeLabel')}</label>
            <select id="f-type" value={type} onChange={(e) => setType(e.target.value as typeof type)} className="input !py-2.5 !text-sm mt-1">
              <option value="all">{t('filterTypeAll')}</option>
              <option value="government">{t('filterTypeGovt')}</option>
              <option value="private">{t('filterTypePrivate')}</option>
            </select>
          </div>
          <div className="col-span-2 md:col-span-1">
            <label htmlFor="f-spec" className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{t('filterSpecLabel')}</label>
            <select id="f-spec" value={speciality} onChange={(e) => { setSpeciality(e.target.value); if (showEmptyNotice) setShowEmptyNotice(false); }} className="input !py-2.5 !text-sm mt-1">
              <option value="">{t('allSpecialities')}</option>
              {ALL_SPECIALITIES.map((s) => <option key={s} value={s}>{tSpeciality(s, lang)}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="f-radius" className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{t('filterRadiusLabel')}</label>
            <select id="f-radius" value={radius} onChange={(e) => setRadius(Number(e.target.value))} className="input !py-2.5 !text-sm mt-1">
              {[5, 10, 25, 50, 100, 500].map((r) => (
                <option key={r} value={r}>
                  {r === 500 ? t('filterRadiusAnywhere') : t('filterRadiusWithin', { km: r })}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="f-sort" className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{t('filterSortLabel')}</label>
            <select id="f-sort" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="input !py-2.5 !text-sm mt-1">
              <option value="distance">{t('filterSortDistance')}</option>
              <option value="name">{t('filterSortName')}</option>
              <option value="type">{t('filterSortType')}</option>
            </select>
          </div>
          <div className="flex items-center">
            <label className="flex items-center gap-2 cursor-pointer select-none rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 w-full min-h-[48px]">
              <input type="checkbox" checked={emergencyOnly} onChange={(e) => setEmergencyOnly(e.target.checked)} className="w-5 h-5 accent-red-700" />
              <span className="text-sm font-bold text-red-800 flex items-center gap-1.5"><Siren size={16} />{t('emergency247')}</span>
            </label>
          </div>
          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <button type="button" onClick={clearFilters} className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-red-700 py-2">
                <X size={16} /> {t('clearFilters')}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Compare status banner when user has selected hospitals */}
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
        <p><strong className="text-brand-800">{results === null ? '…' : results.length}</strong> {results?.length === 1 ? t('hospitalFoundOne') : t('hospitalFoundMany')}
          {results !== null && results.length > 0 && <> · <span className="inline-flex items-center gap-1"><Landmark size={13} />{govtCount} {t('govtShort')}</span> · <span className="inline-flex items-center gap-1"><Building2 size={13} />{privCount} {t('privateShort')}</span></>}
        </p>
        {fellBack && results !== null && results.length > 0 && <p role="status" className="text-amber-800 font-medium">{t('fallbackRadiusNote')}</p>}
      </div>

      {/* Results: map + list */}
      <div className="mt-3 grid lg:grid-cols-5 gap-4 items-start">
        <div className={`${mobileView === 'map' ? 'block' : 'hidden'} lg:block lg:col-span-2 lg:sticky lg:top-24`}>
          <MapViewClient hospitals={results ?? []} center={{ lat: location.lat, lng: location.lng }} userLocation={location.source !== 'default' ? { lat: location.lat, lng: location.lng } : null} />
          <p className="mt-1.5 text-[11px] text-slate-500 text-center">{t('mapAttributionNote')}</p>
        </div>
        <div className={`${mobileView === 'list' ? 'grid' : 'hidden'} lg:grid gap-4 lg:col-span-3`}>
          {listError ? (
            <div role="alert" className="card p-6 text-center">
              <AlertCircle className="mx-auto text-red-600" size={32} />
              <p className="mt-2 font-semibold text-slate-800">{t('listLoadError')}</p>
              <button type="button" onClick={fetchHospitals} className="btn-primary mt-4">{t('retryBtn')}</button>
            </div>
          ) : results === null ? (
            [0, 1, 2].map((i) => (
              <div key={i} className="card p-5 animate-pulse" aria-hidden="true">
                <div className="h-5 w-2/3 bg-slate-200 rounded" />
                <div className="h-4 w-1/2 bg-slate-100 rounded mt-3" />
                <div className="h-4 w-full bg-slate-100 rounded mt-3" />
                <div className="h-4 w-4/5 bg-slate-100 rounded mt-2" />
              </div>
            ))
          ) : results.length === 0 ? (
            <div className="card p-8 text-center">
              <Search className="mx-auto text-slate-300" size={36} />
              <h2 className="mt-2 font-bold text-lg text-slate-800">
                {q.trim() ? t('noHospitalsMatchQuery', { query: q.trim() }) : t('noHospitalsMatch')}
              </h2>
              <p className="mt-1 text-sm text-slate-600">{t('noHospitalsMatchHint')}</p>
              <button type="button" onClick={clearFilters} className="btn-primary mt-4">{t('clearAllFilters')}</button>
            </div>
          ) : (
            results.map((h) => <HospitalCard key={h.id} hospital={h} />)
          )}
        </div>
      </div>
    </div>
  );
}
