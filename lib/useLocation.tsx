'use client';
/**
 * JeevanSetu central location store (React Context).
 *
 * Requirement 3 — PRECISE LOCATION DETECTION
 *  • Explicit user action only. The browser permission prompt is never triggered
 *    automatically.
 *  • `enableHighAccuracy: true, timeout: 15000, maximumAge: 0`.
 *  • The reported accuracy radius is always surfaced; we never claim "precise"
 *    positioning when the browser reports a large radius.
 *  • On failure we DO NOT silently fall back to Delhi. The origin becomes
 *    "unknown" and every distance is withheld until the user picks a location.
 *  • Optional live following with explicit start/stop, stopped on unmount.
 *  • Nothing is persisted without consent (`locationConsent`).
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';

export type LocationSource = 'geolocation' | 'manual' | 'preset' | 'map' | 'unknown';

export interface UserLocation {
  lat: number | null;
  lng: number | null;
  label: string;
  source: LocationSource;
  /** Reported GPS accuracy radius in metres (null when not from the device). */
  accuracyM: number | null;
  /** UTC ms timestamp of the fix. */
  capturedAt: number | null;
}

export const EMPTY_LOCATION: UserLocation = {
  lat: null,
  lng: null,
  label: 'Location not set',
  source: 'unknown',
  accuracyM: null,
  capturedAt: null,
};

/** Last-resort preset the user can explicitly choose — never applied silently. */
export const DEFAULT_LOCATION: UserLocation = {
  lat: 28.6139,
  lng: 77.2090,
  label: 'New Delhi (selected preset)',
  source: 'preset',
  accuracyM: null,
  capturedAt: null,
};

const STORAGE = 'jeevansetu-location-v2';
const CONSENT = 'jeevansetu-location-consent';

export const CITY_PRESETS: { label: string; lat: number; lng: number; state: string }[] = [
  { label: 'New Delhi', lat: 28.6139, lng: 77.2090, state: 'Delhi' },
  { label: 'Gurugram', lat: 28.4595, lng: 77.0266, state: 'Haryana' },
  { label: 'Noida', lat: 28.5355, lng: 77.3910, state: 'Uttar Pradesh' },
  { label: 'Ghaziabad', lat: 28.6692, lng: 77.4538, state: 'Uttar Pradesh' },
  { label: 'Faridabad', lat: 28.4089, lng: 77.3178, state: 'Haryana' },
  { label: 'Mumbai', lat: 19.0760, lng: 72.8777, state: 'Maharashtra' },
  { label: 'Pune', lat: 18.5204, lng: 73.8567, state: 'Maharashtra' },
  { label: 'Bengaluru', lat: 12.9716, lng: 77.5946, state: 'Karnataka' },
  { label: 'Chennai', lat: 13.0827, lng: 80.2707, state: 'Tamil Nadu' },
  { label: 'Kolkata', lat: 22.5726, lng: 88.3639, state: 'West Bengal' },
  { label: 'Ahmedabad', lat: 23.0225, lng: 72.5714, state: 'Gujarat' },
  { label: 'Jaipur', lat: 26.9124, lng: 75.7873, state: 'Rajasthan' },
  { label: 'Lucknow', lat: 26.8467, lng: 80.9462, state: 'Uttar Pradesh' },
  { label: 'Patna', lat: 25.5941, lng: 85.1376, state: 'Bihar' },
  { label: 'Bhopal', lat: 23.2599, lng: 77.4126, state: 'Madhya Pradesh' },
  { label: 'Hyderabad', lat: 17.3850, lng: 78.4867, state: 'Telangana' },
  { label: 'Chandigarh', lat: 30.7333, lng: 76.7794, state: 'Chandigarh' },
  { label: 'Nagpur', lat: 21.1458, lng: 79.0882, state: 'Maharashtra' },
  { label: 'Varanasi', lat: 25.3176, lng: 82.9739, state: 'Uttar Pradesh' },
  { label: 'Dehradun', lat: 30.3165, lng: 78.0322, state: 'Uttarakhand' },
  { label: 'Bhubaneswar', lat: 20.2961, lng: 85.8245, state: 'Odisha' },
  { label: 'Kochi', lat: 9.9312, lng: 76.2673, state: 'Kerala' },
];

export type GeoErrorCode =
  | 'unavailable' // browser has no geolocation at all
  | 'denied' // permission refused
  | 'position-unavailable' // GPS disabled / no fix
  | 'timeout'
  | 'insecure-context' // page not served over HTTPS
  | 'low-accuracy'
  | 'reverse-geocode-failed'
  | 'failed';

/** Anything above this radius is reported as low accuracy rather than "precise". */
export const LOW_ACCURACY_THRESHOLD_M = 250;

export interface PreciseFix {
  lat: number;
  lng: number;
  accuracyM: number;
  label: string;
  timestamp: number;
  isLowAccuracy: boolean;
  reverseGeocodeStatus: 'ok' | 'failed' | 'skipped';
}

interface LocationCtxValue {
  location: UserLocation;
  /**
   * Numeric origin for call sites that already guard on `hasLocation`.
   * When unknown this is NaN on purpose: a NaN origin makes `Number.isFinite`
   * checks fail loudly instead of quietly routing from (0,0).
   */
  coords: { lat: number; lng: number };
  /** True only when we have a usable numeric origin. */
  hasLocation: boolean;
  /** Convenience origin for services; null when unknown. */
  origin: { lat: number; lng: number } | null;
  setManual: (lat: number, lng: number, label: string, source?: LocationSource) => void;
  requestGeolocation: () => void;
  clearLocation: () => void;
  status: 'idle' | 'locating' | 'tracking' | 'error';
  error: string | null;
  errorCode: GeoErrorCode | null;
  /** Latest successful device fix (used for the accuracy circle on the map). */
  lastFix: PreciseFix | null;
  /** Live following controls. */
  startTracking: () => void;
  stopTracking: () => void;
  isTracking: boolean;
  reverseGeocoding: boolean;
  /** True when the user explicitly allowed their origin to be remembered. */
  consent: boolean;
}

const LocationCtx = createContext<LocationCtxValue | null>(null);

function round5(n: number): number {
  return Number(n.toFixed(5));
}

async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(`/api/geocode/reverse?lat=${lat}&lng=${lng}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = (await res.json()) as { label?: string };
    return typeof data.label === 'string' && data.label.length > 0 ? data.label : null;
  } catch {
    return null;
  }
}

function useLocationInternal(): LocationCtxValue {
  const [location, setLocation] = useState<UserLocation>(EMPTY_LOCATION);
  const [status, setStatus] = useState<'idle' | 'locating' | 'tracking' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<GeoErrorCode | null>(null);
  const [lastFix, setLastFix] = useState<PreciseFix | null>(null);
  const [reverseGeocoding, setReverseGeocoding] = useState(false);
  const [consent, setConsent] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Restore a previously saved origin ONLY when consent was recorded.
  useEffect(() => {
    try {
      const hadConsent = window.localStorage.getItem(CONSENT) === '1';
      setConsent(hadConsent);
      if (!hadConsent) {
        window.localStorage.removeItem(STORAGE);
        return;
      }
      const saved = window.localStorage.getItem(STORAGE);
      if (!saved) return;
      const parsed = JSON.parse(saved) as UserLocation;
      if (
        typeof parsed?.lat === 'number' &&
        typeof parsed?.lng === 'number' &&
        Number.isFinite(parsed.lat) &&
        Number.isFinite(parsed.lng)
      ) {
        setLocation(parsed);
      }
    } catch {
      /* private mode / disabled storage */
    }
  }, []);

  const persist = useCallback((loc: UserLocation, grantConsent: boolean) => {
    setLocation(loc);
    try {
      if (grantConsent) {
        window.localStorage.setItem(CONSENT, '1');
        window.localStorage.setItem(STORAGE, JSON.stringify(loc));
        setConsent(true);
      } else if (window.localStorage.getItem(CONSENT) === '1') {
        window.localStorage.setItem(STORAGE, JSON.stringify(loc));
      }
    } catch {
      /* ignore quota / privacy-mode errors */
    }
  }, []);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    watchIdRef.current = null;
    setStatus((s) => (s === 'tracking' ? 'idle' : s));
  }, []);

  const applyFix = useCallback(
    (position: GeolocationPosition) => {
      const accuracyM = Math.round(position.coords.accuracy ?? 0);
      const lat = round5(position.coords.latitude);
      const lng = round5(position.coords.longitude);
      const isLowAccuracy = accuracyM > LOW_ACCURACY_THRESHOLD_M;

      const provisional: UserLocation = {
        lat,
        lng,
        label: isLowAccuracy
          ? `Approximate device location (±${accuracyM} m)`
          : `Your current location (±${accuracyM} m)`,
        source: 'geolocation',
        accuracyM,
        capturedAt: position.timestamp ?? Date.now(),
      };
      persist(provisional, true);
      setLastFix({
        lat,
        lng,
        accuracyM,
        label: provisional.label,
        timestamp: provisional.capturedAt ?? Date.now(),
        isLowAccuracy,
        reverseGeocodeStatus: 'skipped',
      });
      setError(isLowAccuracy ? 'low-accuracy' : null);
      setErrorCode(isLowAccuracy ? 'low-accuracy' : null);
      setReverseGeocoding(true);

      void reverseGeocode(lat, lng).then((label) => {
        if (!mountedRef.current) return;
        setReverseGeocoding(false);
        if (label) {
          const refined: UserLocation = { ...provisional, label };
          setLocation(refined);
          try {
            if (window.localStorage.getItem(CONSENT) === '1') {
              window.localStorage.setItem(STORAGE, JSON.stringify(refined));
            }
          } catch {
            /* ignore */
          }
          setLastFix((prev) =>
            prev ? { ...prev, label, reverseGeocodeStatus: 'ok' } : prev,
          );
        } else {
          setLastFix((prev) => (prev ? { ...prev, reverseGeocodeStatus: 'failed' } : prev));
        }
      });
    },
    [persist],
  );

  const mapGeolocationError = useCallback((err: GeolocationPositionError) => {
    setStatus('error');
    if (err.code === err.PERMISSION_DENIED) {
      setErrorCode('denied');
      setError(
        'Location permission was denied, so no coordinates were guessed. Search by address, enter a PIN code, or pick your city below.',
      );
      return;
    }
    if (err.code === err.POSITION_UNAVAILABLE) {
      setErrorCode('position-unavailable');
      setError(
        'Your device could not obtain a GPS fix (GPS may be switched off). Try again outdoors, or search by address or PIN code.',
      );
      return;
    }
    setErrorCode('timeout');
    setError('Location detection timed out. Try again, or search by address or PIN code.');
  }, []);

  const requestGeolocation = useCallback(() => {
    setError(null);
    setErrorCode(null);

    if (typeof window === 'undefined' || !navigator.geolocation) {
      setStatus('error');
      setErrorCode('unavailable');
      setError('This browser does not support location detection. Please search by address, PIN code or city.');
      return;
    }
    if (!window.isSecureContext) {
      setStatus('error');
      setErrorCode('insecure-context');
      setError(
        'Location can only be detected on a secure (HTTPS) connection. Please search by address or PIN code instead.',
      );
      return;
    }

    setStatus('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!mountedRef.current) return;
        applyFix(pos);
        setStatus('idle');
      },
      (err) => {
        if (!mountedRef.current) return;
        mapGeolocationError(err);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }, [applyFix, mapGeolocationError]);

  const startTracking = useCallback(() => {
    setError(null);
    setErrorCode(null);
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus('error');
      setErrorCode('unavailable');
      setError('This browser does not support live location following.');
      return;
    }
    if (!window.isSecureContext) {
      setStatus('error');
      setErrorCode('insecure-context');
      setError('Live location following requires HTTPS.');
      return;
    }
    if (watchIdRef.current !== null) return;

    setStatus('tracking');
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        if (!mountedRef.current) return;
        applyFix(pos);
      },
      (err) => {
        if (!mountedRef.current) return;
        stopTracking();
        mapGeolocationError(err);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }, [applyFix, mapGeolocationError, stopTracking]);

  // Always release the watcher when the provider unmounts.
  useEffect(() => () => {
    if (watchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const setManual = useCallback(
    (lat: number, lng: number, label: string, source: LocationSource = 'manual') => {
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      setStatus('idle');
      setError(null);
      setErrorCode(null);
      setLastFix(null);
      persist(
        { lat: round5(lat), lng: round5(lng), label, source, accuracyM: null, capturedAt: Date.now() },
        false,
      );
    },
    [persist],
  );

  const clearLocation = useCallback(() => {
    stopTracking();
    setStatus('idle');
    setError(null);
    setErrorCode(null);
    setLastFix(null);
    setLocation(EMPTY_LOCATION);
    try {
      window.localStorage.removeItem(STORAGE);
      window.localStorage.removeItem(CONSENT);
      setConsent(false);
    } catch {
      /* ignore */
    }
  }, [stopTracking]);

  const hasLocation =
    typeof location.lat === 'number' && typeof location.lng === 'number' && Number.isFinite(location.lat);

  return {
    location,
    coords: hasLocation
      ? { lat: location.lat as number, lng: location.lng as number }
      : { lat: Number.NaN, lng: Number.NaN },
    hasLocation,
    origin: hasLocation ? { lat: location.lat as number, lng: location.lng as number } : null,
    setManual,
    requestGeolocation,
    clearLocation,
    status,
    error,
    errorCode,
    lastFix,
    startTracking,
    stopTracking,
    isTracking: status === 'tracking',
    reverseGeocoding,
    /** True when the user has explicitly allowed this device's location to be remembered. */
    consent,
  };
}

/** Exposed so callers can render the consent notice state. */
export function useLocationConsent(): boolean {
  const [granted, setGranted] = useState(false);
  useEffect(() => {
    try {
      setGranted(window.localStorage.getItem(CONSENT) === '1');
    } catch {
      /* ignore */
    }
  }, []);
  return granted;
}

export function LocationProvider({ children }: { children: ReactNode }) {
  const val = useLocationInternal();
  return <LocationCtx.Provider value={val}>{children}</LocationCtx.Provider>;
}

/**
 * Safe accessor. Previously this fell back to a NEW independent state instance
 * when no provider was found, which let different components hold different
 * origins — a direct cause of inconsistent distances. Callers now get an empty
 * (unknown) origin in that case, so nothing can display a wrong number.
 */
export function useUserLocation(): LocationCtxValue {
  const ctx = useContext(LocationCtx);
  return ctx ?? FALLBACK_CTX;
}

const FALLBACK_CTX: LocationCtxValue = {
  location: EMPTY_LOCATION,
  coords: { lat: Number.NaN, lng: Number.NaN },
  hasLocation: false,
  origin: null,
  setManual: () => {},
  requestGeolocation: () => {},
  clearLocation: () => {},
  status: 'idle',
  error: null,
  errorCode: null,
  lastFix: null,
  startTracking: () => {},
  stopTracking: () => {},
  isTracking: false,
  reverseGeocoding: false,
  consent: false,
};
