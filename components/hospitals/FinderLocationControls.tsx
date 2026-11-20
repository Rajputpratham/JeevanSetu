'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { isLatLng, type LatLng } from '@/lib/distance';
import { useLang } from '@/lib/i18n';
import type { useUserLocation } from '@/hooks/useUserLocation';

export const LOCATION_DISCLOSURE_ID = 'finder-location-disclosure';
type Candidate = LatLng & { label: string };

export default function FinderLocationControls({ location, error, loading, request, clear, selectManual }: ReturnType<typeof useUserLocation>) {
  const { t } = useLang();
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<Candidate[]>([]);
  const [searchError, setSearchError] = useState('');
  const [searching, setSearching] = useState(false);
  const pending = useRef<AbortController | null>(null);

  useEffect(() => () => pending.current?.abort(), []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current && !pending.current.signal.aborted) return;
    const controller = new AbortController();
    pending.current = controller;
    setMatches([]);
    setSearchError('');
    setSearching(true);
    try {
      const response = await fetch('/api/geocode/finder', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim() }), signal: controller.signal,
      });
      const data = await response.json();
      if (controller.signal.aborted) return;
      if (!response.ok) throw new Error(data.error || 'Location search failed. Try again.');
      const results = Array.isArray(data.results) ? data.results.filter((item: unknown): item is Candidate =>
        isLatLng(item) && 'label' in item && typeof item.label === 'string') : [];
      if (results.length) setMatches(results);
      else setSearchError('No matching city or pincode found. Check the spelling or add a state name.');
    } catch (error) {
      if (!controller.signal.aborted) setSearchError(error instanceof Error ? error.message : 'Location search failed. Try again.');
    } finally {
      if (pending.current === controller) {
        pending.current = null;
        setSearching(false);
      }
    }
  }

  return (
    <section className="card min-w-0 p-4 lg:col-span-1" aria-labelledby="finder-location-title">
      <h2 id="finder-location-title" className="text-sm font-bold text-brand-900">Travel starting point</h2>
      <p id={LOCATION_DISCLOSURE_ID} className="mt-1 text-xs text-slate-600">
        Your chosen location is sent to OSRM to estimate hospital travel distance. Browser location requires HTTPS or localhost and your permission. Your choice is remembered only for this session.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" className="btn-primary !px-3 !py-2 !text-sm" onClick={request} disabled={loading} aria-describedby={LOCATION_DISCLOSURE_ID}>
          {error ? 'Retry location' : t('useMyLocation')}
        </button>
        {location && <button type="button" className="btn-ghost !px-2 !text-sm" onClick={clear}>Clear location</button>}
      </div>
      <p role="status" className="mt-1 break-words text-xs font-semibold text-slate-700">
        {loading ? 'Getting your location…' : location ? `Starting point: ${location.label}${location.method === 'manual' ? ' (approximate)' : ''}` : ''}
      </p>
      {error && <p role="alert" className="mt-1 text-xs text-red-700">{error}</p>}
      <form className="mt-2" onSubmit={submit}>
        <label className="label" htmlFor="finder-origin-query">Or enter a city or pincode</label>
        <div className="flex flex-wrap items-center gap-2">
          <input id="finder-origin-query" className="input min-w-0 flex-1 !py-2 !text-sm" value={query} minLength={2} maxLength={100}
            aria-describedby="finder-geocoder-note" required onChange={(event) => {
              pending.current?.abort();
              pending.current = null;
              setSearching(false);
              setQuery(event.target.value);
              setMatches([]);
              setSearchError('');
            }} />
          <button className="btn-secondary !px-3 !py-2 !text-sm" type="submit" disabled={searching}>Search</button>
        </div>
        <p id="finder-geocoder-note" className="mt-1 text-xs text-slate-600">
          Enter only a city or pincode, not a street address. Search sends it to Nominatim. © <a className="underline" href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>.
        </p>
      </form>
      <p role="status" className="mt-1 text-xs text-slate-700">
        {searching ? 'Searching for a starting point…' : matches.length > 1 ? 'Multiple matches. Choose the correct starting point.' : matches.length === 1 ? 'Confirm this starting point:' : ''}
      </p>
      {searchError && <p role="alert" className="mt-1 text-xs text-red-700">{searchError}</p>}
      {matches.length > 0 && <ul className="mt-1 divide-y divide-slate-100">
        {matches.map((match) => <li key={`${match.lat},${match.lng}`}>
          <button type="button" className="min-h-[44px] w-full break-words py-2 text-start text-xs font-bold text-brand-800 hover:underline"
            onClick={() => { selectManual(match); setMatches([]); }}>{match.label}</button>
        </li>)}
      </ul>}
    </section>
  );
}
