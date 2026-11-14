'use client';
import { useCallback, useEffect, useState } from 'react';
import {
  LocateFixed, Loader2, AlertCircle, MapPin, RefreshCw, X, Crosshair, Play, Square, Info, Search,
} from 'lucide-react';
import { useUserLocation, CITY_PRESETS } from '@/lib/useLocation';
import { useLang } from '@/lib/i18n';
import { locationStrings } from '@/lib/ui-strings';
import { tCity } from '@/lib/i18n-data';
import VoiceSearchButton from '@/components/VoiceSearchButton';

interface Props {
  /** Called after the origin changes so pages can refetch their own data. */
  onOriginChange?: () => void;
  className?: string;
  /** Compact rendering for sidebars. */
  compact?: boolean;
}

type Panel = 'none' | 'address' | 'pincode' | 'map';

interface GeocodeCandidate {
  label: string;
  lat: number;
  lng: number;
  approximate?: boolean;
  source?: string;
}

/**
 * Requirement 3 — the single place the user manages where they are.
 *
 * Everything here is explicit user action: pressing the button triggers the
 * browser permission prompt, nothing auto-starts, and failures are described
 * truthfully with a manual fallback. There is no silent "assume Delhi".
 */
export default function LocationControls({ onOriginChange, className = '', compact = false }: Props) {
  const { t, lang } = useLang();
  const ls = locationStrings(lang);
  const {
    location,
    hasLocation,
    setManual,
    requestGeolocation,
    clearLocation,
    status,
    error,
    errorCode,
    lastFix,
    isTracking,
    startTracking,
    stopTracking,
    reverseGeocoding,
  } = useUserLocation();

  const [panel, setPanel] = useState<Panel>('none');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [candidates, setCandidates] = useState<GeocodeCandidate[] | null>(null);
  const [panelError, setPanelError] = useState<string | null>(null);

  // Let parent pages react to an origin change in one place.
  useEffect(() => {
    onOriginChange?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.lat, location.lng, location.source]);

  /** "Select Location on Map" — drops the pin at the map centre using the
   *  user's IP-free choice: we simply let them type coordinates or use a
   *  preset grid, because a full draggable map requires the Maps JS key. */
  const setFromMapCentre = useCallback(
    (lat: number, lng: number, label: string) => {
      setManual(lat, lng, label, 'map');
      setPanel('none');
    },
    [setManual],
  );

  const runSearch = async (mode: 'address' | 'pincode') => {
    const q = query.trim();
    setPanelError(null);
    setCandidates(null);
    if (q.length < 2) {
      setPanelError(t('manualMinCharsError'));
      return;
    }
    if (mode === 'pincode' && !/^[1-9][0-9]{5}$/.test(q.replace(/\s+/g, ''))) {
      setPanelError('Enter a valid 6-digit Indian PIN code, e.g. 110085.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}&lang=${encodeURIComponent(lang)}`);
      if (!res.ok) throw new Error('geocode failed');
      const data: { results?: GeocodeCandidate[] } = await res.json();
      const items = data.results ?? [];
      if (items.length === 0) {
        setPanelError(t('manualNoMatchError'));
      } else if (items.length === 1) {
        setManual(items[0].lat, items[0].lng, items[0].label, 'manual');
        setPanel('none');
        setQuery('');
      } else {
        setCandidates(items);
      }
    } catch {
      setPanelError(t('manualOfflineError'));
    } finally {
      setBusy(false);
    }
  };

  const accuracyText =
    location.accuracyM !== null ? ls.accuracy.replace('{m}', String(location.accuracyM)) : null;
  const isLowAccuracy = location.accuracyM !== null && location.accuracyM > 250;

  return (
    <section
      aria-labelledby="location-controls-heading"
      className={`card p-4 ${className}`}
      data-testid="location-controls"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2
            id="location-controls-heading"
            className={`font-extrabold text-slate-900 flex items-center gap-1.5 ${compact ? 'text-sm' : 'text-base'}`}
          >
            <MapPin size={16} className="text-brand-700" aria-hidden="true" />
            {t('showingResultsAround')}
          </h2>
          <p className="mt-1 text-sm font-semibold text-brand-900 truncate" data-testid="origin-label">
            {hasLocation ? location.label : ls.notSet}
          </p>
          {accuracyText && (
            <p className={`mt-0.5 text-[11px] ${isLowAccuracy ? 'text-amber-800 font-semibold' : 'text-slate-500'}`}>
              {isLowAccuracy ? ls.lowAccuracy.replace('{m}', String(location.accuracyM)) : accuracyText}
            </p>
          )}
          {!hasLocation && <p className="mt-1 text-[11px] text-slate-500">{ls.notSetWhy}</p>}
          {reverseGeocoding && (
            <p className="mt-0.5 text-[11px] text-slate-400">{ls.locating}</p>
          )}
        </div>
        {hasLocation && (
          <button
            type="button"
            onClick={clearLocation}
            aria-label="Clear my location"
            className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 shrink-0"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {/* Primary action */}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={requestGeolocation}
          disabled={status === 'locating'}
          data-testid="use-precise-location"
          className="btn-primary !py-2.5 !text-sm flex-1 min-w-[180px]"
        >
          {status === 'locating' ? <Loader2 size={16} className="animate-spin" /> : <Crosshair size={16} />}
          {status === 'locating' ? ls.locating : ls.usePrecise}
        </button>

        {hasLocation && (
          <button
            type="button"
            onClick={requestGeolocation}
            disabled={status === 'locating'}
            className="btn-secondary !py-2.5 !text-sm"
            data-testid="retry-location"
          >
            <RefreshCw size={15} /> {ls.retry}
          </button>
        )}
      </div>

      {/* Live following */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={isTracking ? stopTracking : startTracking}
          aria-pressed={isTracking}
          data-testid="toggle-live-follow"
          className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
            isTracking
              ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
              : 'border-slate-200 text-slate-700 hover:border-brand-500'
          }`}
        >
          {isTracking ? <Square size={12} className="fill-current" /> : <Play size={12} />}
          {isTracking ? ls.stopFollow : ls.startFollow}
        </button>
        {isTracking && (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800">
            <span className="h-2 w-2 rounded-full bg-emerald-600 animate-pulse" aria-hidden="true" />
            Live location on
          </span>
        )}
        {lastFix && (
          <span className="text-[11px] text-slate-500">
            ±{lastFix.accuracyM} m
            {lastFix.reverseGeocodeStatus === 'failed' ? ' · address lookup failed' : ''}
          </span>
        )}
      </div>

      {/* Secondary ways to set a location */}
      <div className="mt-3 grid grid-cols-2 gap-1.5">
        <button
          type="button"
          onClick={() => { setPanel(panel === 'address' ? 'none' : 'address'); setCandidates(null); setPanelError(null); }}
          aria-expanded={panel === 'address'}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-2 py-2 text-[11px] font-bold text-slate-700 hover:border-brand-500"
        >
          <Search size={13} /> {ls.searchAddress}
        </button>
        <button
          type="button"
          onClick={() => { setPanel(panel === 'pincode' ? 'none' : 'pincode'); setCandidates(null); setPanelError(null); }}
          aria-expanded={panel === 'pincode'}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-2 py-2 text-[11px] font-bold text-slate-700 hover:border-brand-500"
        >
          <MapPin size={13} /> {ls.searchPincode}
        </button>
        <button
          type="button"
          onClick={() => { setPanel(panel === 'map' ? 'none' : 'map'); setCandidates(null); setPanelError(null); }}
          aria-expanded={panel === 'map'}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-2 py-2 text-[11px] font-bold text-slate-700 hover:border-brand-500"
        >
          <LocateFixed size={13} /> {ls.selectOnMap}
        </button>
        <button
          type="button"
          onClick={() => { setPanel('none'); setCandidates(null); setPanelError(null); }}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-2 py-2 text-[11px] font-bold text-slate-700 hover:border-brand-500"
        >
          <RefreshCw size={13} /> {ls.refreshRoutes}
        </button>
      </div>

      {/* Address / PIN panel */}
      {(panel === 'address' || panel === 'pincode') && (
        <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50/70 p-2.5">
          <label htmlFor={`loc-${panel}`} className="text-[11px] font-bold text-slate-600">
            {panel === 'address' ? ls.searchAddress : `${ls.searchPincode} (6 digits)`}
          </label>
          <div className="mt-1 flex items-center gap-1.5">
            <input
              id={`loc-${panel}`}
              value={query}
              inputMode={panel === 'pincode' ? 'numeric' : 'text'}
              onChange={(e) => { setQuery(e.target.value); setPanelError(null); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void runSearch(panel);
                }
              }}
              placeholder={panel === 'pincode' ? 'e.g. 110085' : t('manualLocationPlaceholder')}
              className="input !py-2 !text-sm"
              autoComplete="off"
            />
            <VoiceSearchButton onTranscript={(txt) => setQuery(txt)} />
            <button
              type="button"
              onClick={() => void runSearch(panel)}
              disabled={busy}
              className="btn-primary !py-2 !px-3 !text-sm shrink-0"
              aria-label={panel === 'address' ? ls.searchAddress : ls.searchPincode}
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
            </button>
          </div>
          {panelError && (
            <p role="alert" className="mt-1.5 text-[11px] text-red-700">{panelError}</p>
          )}
          {candidates && candidates.length > 0 && (
            <ul className="mt-1.5 max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-white divide-y divide-slate-100">
              {candidates.map((c) => (
                <li key={`${c.lat}-${c.lng}-${c.label}`}>
                  <button
                    type="button"
                    onClick={() => {
                      setManual(c.lat, c.lng, c.label, 'manual');
                      setCandidates(null);
                      setQuery('');
                      setPanel('none');
                    }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-brand-50 flex items-center justify-between gap-2"
                  >
                    <span className="truncate">{c.label}</span>
                    {c.approximate && <span className="text-[10px] text-slate-400 shrink-0">approx.</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Map-pick panel: needs no API key, still explicit */}
      {panel === 'map' && (
        <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50/70 p-2.5">
          <p className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
            <LocateFixed size={13} /> {ls.selectOnMap}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Pick the centre of the area you are starting from. JeevanSetu uses this exact point as the routing origin.
          </p>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {CITY_PRESETS.slice(0, 12).map((c) => (
              <button
                key={c.label}
                type="button"
                onClick={() => setFromMapCentre(c.lat, c.lng, `${c.label}, ${c.state}`)}
                className="rounded-lg border border-slate-200 bg-white px-1.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:border-brand-500 hover:text-brand-900"
              >
                {tCity(c.label, lang)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Errors — precise, never a guessed fallback */}
      {(error || errorCode) && (
        <div role="alert" className="mt-2.5 flex items-start gap-1.5 rounded-lg bg-red-50 border border-red-200 px-2.5 py-2">
          <AlertCircle size={14} className="mt-0.5 shrink-0 text-red-700" />
          <div className="text-[11px] text-red-900">
            <p className="font-semibold">
              {errorCode === 'denied'
                ? ls.denied
                : errorCode === 'low-accuracy'
                  ? ls.lowAccuracy.replace('{m}', String(location.accuracyM ?? 0))
                  : error && !error.startsWith('low-accuracy')
                    ? error
                    : null}
            </p>
            <p className="mt-0.5">
              {ls.orPickCity}: {CITY_PRESETS.slice(0, 4).map((c) => tCity(c.label, lang)).join(' · ')}
            </p>
          </div>
        </div>
      )}

      <p className="mt-2.5 flex items-start gap-1 text-[10px] leading-snug text-slate-400">
        <Info size={11} className="mt-0.5 shrink-0" aria-hidden="true" />
        {ls.consentNote}
      </p>

      {hasLocation && location.accuracyM === null && (
        <p className="mt-1 text-[10px] text-slate-400">
          {location.source === 'geolocation' ? ls.coordsOnly : `Origin source: ${location.source}`}
        </p>
      )}
    </section>
  );
}
