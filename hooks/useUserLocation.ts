'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { isLatLng, type LatLng } from '@/lib/distance';

const STORAGE_KEY = 'jeevansetu:finder-origin:v1';
export type FinderLocation = LatLng & { method: 'device' | 'manual'; label: string };

function store(location: FinderLocation | null) {
  try {
    if (location) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(location));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch { /* Storage may be disabled. */ }
}

/** Finder-only consent; never inherits the legacy cross-page localStorage origin. */
export function useUserLocation() {
  const [location, setLocation] = useState<FinderLocation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const requestId = useRef(0);

  const invalidateRequest = useCallback(() => { requestId.current++; }, []);

  useEffect(() => {
    try {
      const parsed = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null');
      if (isLatLng(parsed) && 'method' in parsed && (parsed.method === 'device' || parsed.method === 'manual') &&
        'label' in parsed && typeof parsed.label === 'string') {
        setLocation({ lat: parsed.lat, lng: parsed.lng, method: parsed.method, label: parsed.label });
      }
    } catch { /* Invalid or inaccessible storage is equivalent to no consent. */ }
    return invalidateRequest;
  }, [invalidateRequest]);

  const clear = useCallback(() => {
    invalidateRequest();
    setLocation(null);
    setLoading(false);
    setError(null);
    store(null);
  }, [invalidateRequest]);

  const selectManual = useCallback((candidate: LatLng & { label: string }) => {
    if (!isLatLng(candidate)) return;
    clear();
    const origin: FinderLocation = { lat: candidate.lat, lng: candidate.lng, label: candidate.label, method: 'manual' };
    store(origin);
    setLocation(origin);
  }, [clear]);

  const request = useCallback(() => {
    clear();
    const id = requestId.current;
    const fail = (message: string) => {
      if (id !== requestId.current) return;
      setLoading(false);
      setError(message);
    };
    if (!window.isSecureContext) {
      fail('Browser location requires HTTPS or localhost and your permission. You can search by city or pincode instead.');
      return;
    }
    if (!navigator.geolocation) {
      fail('This browser does not support location detection. Search by city or pincode instead.');
      return;
    }
    setLoading(true);
    try {
      navigator.geolocation.getCurrentPosition(({ coords }) => {
        if (id !== requestId.current) return;
        const origin: FinderLocation = { lat: coords.latitude, lng: coords.longitude, label: 'Device location', method: 'device' };
        if (!isLatLng(origin)) return fail('Your device returned an invalid position. Try again or enter a city or pincode.');
        store(origin);
        setLocation(origin);
        setLoading(false);
      }, ({ code }) => {
        fail(code === 1 ? 'Location blocked. Allow access in browser settings' : code === 3
          ? 'Location detection timed out. Try again or enter a city or pincode.'
          : 'Your device could not determine its position. Try again or enter a city or pincode.');
      }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
    } catch {
      fail('Browser location could not be requested. Try again or enter a city or pincode.');
    }
  }, [clear]);

  return { location, error, loading, request, clear, selectManual };
}
