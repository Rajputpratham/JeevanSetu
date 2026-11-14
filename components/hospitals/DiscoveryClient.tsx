'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Search, LocateFixed, Loader2, SlidersHorizontal, Map as MapIcon, List,
  AlertCircle, Building2, Landmark, Siren, X, MapPin,
} from 'lucide-react';
import { useUserLocation, CITY_PRESETS } from '@/lib/useLocation';
import { ALL_SPECIALITIES } from '@/data/hospitals';
import { Hospital } from '@/data/types';
import HospitalCard from '@/components/HospitalCard';
import MapViewClient from '@/components/MapViewClient';

type ResultHospital = Hospital & { distanceKm: number };

interface DiscoveryProps {
  initialQ?: string;
  initialType?: 'government' | 'private' | 'all';
  initialSpeciality?: string;
  initialEmergency?: boolean;
  initialRadius?: number;
}

export default function DiscoveryClient({
  initialQ = '', initialType = 'all', initialSpeciality = '', initialEmergency = false, initialRadius = 25,
}: DiscoveryProps) {
  const { location, setManual, requestGeolocation, status, error: geoError } = useUserLocation();

  const [q, setQ] = useState(initialQ);
  const [type, setType] = useState<'all' | 'government' | 'private'>(initialType);
  const [speciality, setSpeciality] = useState(initialSpeciality);
  const [emergencyOnly, setEmergencyOnly] = useState(initialEmergency);
  const [radius, setRadius] = useState(initialRadius);
  const [sort, setSort] = useState<'distance' | 'name' | 'type'>('distance');

  const [manualInput, setManualInput] = useState('');
  const [manualResults, setManualResults] = useState<{ label: string; lat: number; lng: number }[] | null>(null);
  const [manualBusy, setManualBusy] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

  const [results, setResults] = useState<ResultHospital[] | null>(null);
  const [listNote, setListNote] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<'list' | 'map'>('list');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchHospitals = useCallback(() => {
    const params = new URLSearchParams({
      lat: String(location.lat), lng: String(location.lng),
      radius: String(radius), type, sort,
    });
    if (q.trim()) params.set('q', q.trim());
    if (speciality) params.set('speciality', speciality);
    if (emergencyOnly) params.set('emergency', '1');
    setListError(null);
    fetch(`/api/hospitals?${params}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Request failed'))))
      .then((data) => {
        setResults(data.results ?? []);
        setListNote(data.note ?? null);
      })
      .catch(() => setListError('Could not load hospitals. Please check your connection and try again.'));
  }, [location.lat, location.lng, radius, type, speciality, emergencyOnly, q, sort]);

  // Debounced refetch on any control change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(fetchHospitals, 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [fetchHospitals]);

  const runManualGeocode = useCallback(async () => {
    const query = manualInput.trim();
    setManualError(null);
    if (query.length < 2) { setManualError('Please type at least 2 characters, e.g. “Rohini” or “Pune”.'); return; }
    setManualBusy(true);
    setManualResults(null);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&countrycodes=in&limit=5&q=${encodeURIComponent(query)}`, { headers: { 'Accept-Language': 'en' } });
      if (!res.ok) throw new Error('geocode failed');
      const data: { display_name: string; lat: string; lon: string }[] = await res.json();
      if (data.length === 0) {
        setManualError('No matching Indian place found. Try a nearby town or district name.');
      } else {
        setManualResults(data.map((d) => ({ label: d.display_name.split(',').slice(0, 3).join(', '), lat: parseFloat(d.lat), lng: parseFloat(d.lon) })));
      }
    } catch {
      // Offline fallback: quick-pick presets
      const presets = CITY_PRESETS.filter((c) => c.label.toLowerCase().includes(query.toLowerCase()))
        .map((c) => ({ label: `${c.label}, ${c.state}`, lat: c.lat, lng: c.lng }));
      if (presets.length) setManualResults(presets);
      else setManualError('Could not search online right now. Please pick your city from the list instead.');
    } finally {
      setManualBusy(false);
    }
  }, [manualInput]);

  const clearFilters = () => {
    setQ(''); setType('all'); setSpeciality(''); setEmergencyOnly(false); setRadius(25); setSort('distance');
  };

  const hasActiveFilters = q !== '' || type !== 'all' || speciality !== '' || emergencyOnly;
  const govtCount = useMemo(() => results?.filter((r) => r.type === 'government').length ?? 0, [results]);
  const privCount = useMemo(() => results?.filter((r) => r.type === 'private').length ?? 0, [results]);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
      {/* Page heading */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-brand-700">Feature 1 · Discovery</p>
          <h1 className="mt-1 text-3xl sm:text-4xl font-extrabold tracking-tight text-brand-950">Find Hospitals Near You</h1>
          <p className="mt-1 text-slate-600 max-w-xl">Government and private hospitals with distance, contact, facilities and directions. No account needed.</p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <button type="button" onClick={requestGeolocation} disabled={status === 'locating'} className="btn-primary !py-2.5 !text-sm">
            {status === 'locating' ? <Loader2 size={17} className="animate-spin" /> : <LocateFixed size={17} />} Use my location
          </button>
        </div>
      </div>

      {/* Location status */}
      <p className="mt-2 text-xs text-slate-500 flex items-center gap-1.5">
        <MapPin size={13} className="shrink-0" /> Showing results around: <strong className="text-slate-700">{location.label}</strong>
      </p>
      {geoError && <p role="alert" className="mt-1.5 flex items-center gap-1.5 text-xs text-red-700"><AlertCircle size={14} className="shrink-0" />{geoError}</p>}

      {/* Search + manual location */}
      <div className="card mt-4 p-4 sm:p-5 grid gap-3 lg:grid-cols-2">
        <div>
          <label htmlFor="hosp-search" className="label">Search by hospital, speciality, city or facility</label>
          <div className="relative">
            <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input id="hosp-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. AIIMS, cardiology, dialysis…" className="input !pl-12" autoComplete="off" />
          </div>
        </div>
        <div>
          <label htmlFor="manual-loc" className="label">Or type your village, town or city</label>
          <div className="flex gap-2">
            <input id="manual-loc" value={manualInput} onChange={(e) => { setManualInput(e.target.value); setManualResults(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); runManualGeocode(); } }}
              placeholder="e.g. Rohini, Rampur, Pune…" className="input" aria-describedby="manual-hint" />
            <button type="button" onClick={runManualGeocode} disabled={manualBusy} className="btn-secondary !px-4" aria-label="Search location">
              {manualBusy ? <Loader2 size={20} className="animate-spin" /> : <Search size={20} />}
            </button>
          </div>
          <p id="manual-hint" className="sr-only">Press Enter or the search button to geocode your place in India</p>
          {manualError && <p role="alert" className="mt-1.5 text-xs text-red-700">{manualError}</p>}
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
            <span className="text-[11px] text-slate-500 py-1">Quick picks:</span>
            {CITY_PRESETS.slice(0, 8).map((c) => (
              <button key={c.label} type="button" onClick={() => setManual(c.lat, c.lng, `${c.label}, ${c.state}`, 'preset')}
                className="text-[11px] font-semibold rounded-full border border-slate-200 px-2.5 py-1 text-slate-600 hover:border-brand-500 hover:text-brand-800">{c.label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Filters bar */}
      <div className="mt-3 card p-3 sm:p-4">
        <div className="flex lg:hidden items-center justify-between">
          <button type="button" onClick={() => setFiltersOpen(!filtersOpen)} className="btn-ghost !text-sm" aria-expanded={filtersOpen} aria-controls="filter-panel">
            <SlidersHorizontal size={18} /> Filters {hasActiveFilters && '•'}
          </button>
          <div className="flex rounded-xl border border-slate-200 overflow-hidden text-sm font-bold" role="group" aria-label="View mode">
            <button type="button" onClick={() => setMobileView('list')} aria-pressed={mobileView === 'list'} className={`flex items-center gap-1.5 px-4 py-2.5 ${mobileView === 'list' ? 'bg-brand-700 text-white' : 'bg-white text-slate-600'}`}><List size={16} />List</button>
            <button type="button" onClick={() => setMobileView('map')} aria-pressed={mobileView === 'map'} className={`flex items-center gap-1.5 px-4 py-2.5 ${mobileView === 'map' ? 'bg-brand-700 text-white' : 'bg-white text-slate-600'}`}><MapIcon size={16} />Map</button>
          </div>
        </div>
        <div id="filter-panel" className={`${filtersOpen ? 'grid' : 'hidden'} lg:grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2 items-end mt-2 lg:mt-0`}>
          <div>
            <label htmlFor="f-type" className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Hospital type</label>
            <select id="f-type" value={type} onChange={(e) => setType(e.target.value as typeof type)} className="input !py-2.5 !text-sm mt-1">
              <option value="all">All types</option>
              <option value="government">Government only</option>
              <option value="private">Private only</option>
            </select>
          </div>
          <div className="col-span-2 md:col-span-1">
            <label htmlFor="f-spec" className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Speciality</label>
            <select id="f-spec" value={speciality} onChange={(e) => setSpeciality(e.target.value)} className="input !py-2.5 !text-sm mt-1">
              <option value="">All specialities</option>
              {ALL_SPECIALITIES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="f-radius" className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Max distance</label>
            <select id="f-radius" value={radius} onChange={(e) => setRadius(Number(e.target.value))} className="input !py-2.5 !text-sm mt-1">
              {[5, 10, 25, 50, 100, 500].map((r) => <option key={r} value={r}>{r === 500 ? 'Anywhere in dataset' : `Within ${r} km`}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="f-sort" className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Sort by</label>
            <select id="f-sort" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="input !py-2.5 !text-sm mt-1">
              <option value="distance">Nearest first</option>
              <option value="name">Name (A–Z)</option>
              <option value="type">Type, then nearest</option>
            </select>
          </div>
          <div className="flex items-center">
            <label className="flex items-center gap-2 cursor-pointer select-none rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 w-full min-h-[48px]">
              <input type="checkbox" checked={emergencyOnly} onChange={(e) => setEmergencyOnly(e.target.checked)} className="w-5 h-5 accent-red-700" />
              <span className="text-sm font-bold text-red-800 flex items-center gap-1.5"><Siren size={16} />Emergency 24×7</span>
            </label>
          </div>
          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <button type="button" onClick={clearFilters} className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-red-700 py-2">
                <X size={16} /> Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Result summary */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600" aria-live="polite">
        <p><strong className="text-brand-800">{results === null ? '…' : results.length}</strong> hospital{results?.length === 1 ? '' : 's'} found
          {results !== null && results.length > 0 && <> · <span className="inline-flex items-center gap-1"><Landmark size={13} />{govtCount} govt</span> · <span className="inline-flex items-center gap-1"><Building2 size={13} />{privCount} private</span></>}
        </p>
        {listNote && <p role="status" className="text-amber-800 font-medium">{listNote}</p>}
      </div>

      {/* Results: map + list */}
      <div className="mt-3 grid lg:grid-cols-5 gap-4 items-start">
        <div className={`${mobileView === 'map' ? 'block' : 'hidden'} lg:block lg:col-span-2 lg:sticky lg:top-24`}>
          <MapViewClient hospitals={results ?? []} center={{ lat: location.lat, lng: location.lng }} userLocation={location.source !== 'default' ? { lat: location.lat, lng: location.lng } : null} />
          <p className="mt-1.5 text-[11px] text-slate-500 text-center">Map © OpenStreetMap contributors · Markers numbered as in the list · Tap a marker for details</p>
        </div>
        <div className={`${mobileView === 'list' ? 'grid' : 'hidden'} lg:grid gap-4 lg:col-span-3`}>
          {listError ? (
            <div role="alert" className="card p-6 text-center">
              <AlertCircle className="mx-auto text-red-600" size={32} />
              <p className="mt-2 font-semibold text-slate-800">{listError}</p>
              <button type="button" onClick={fetchHospitals} className="btn-primary mt-4">Retry</button>
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
              <h2 className="mt-2 font-bold text-lg text-slate-800">No hospitals match these filters</h2>
              <p className="mt-1 text-sm text-slate-600">Try clearing the search, increasing the distance limit, or removing the speciality filter.</p>
              <button type="button" onClick={clearFilters} className="btn-primary mt-4">Clear all filters</button>
            </div>
          ) : (
            results.map((h) => <HospitalCard key={h.id} hospital={h} />)
          )}
        </div>
      </div>
    </div>
  );
}
