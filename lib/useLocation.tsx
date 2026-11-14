'use client';
import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';

export interface UserLocation {
  lat: number;
  lng: number;
  label: string;
  /** 'default' = we don't know where the user is and assumed Delhi */
  source: 'geolocation' | 'manual' | 'preset' | 'default';
}

export const DEFAULT_LOCATION: UserLocation = {
  lat: 28.6139,
  lng: 77.2090,
  label: 'New Delhi (default — share your location for accurate distances)',
  source: 'default',
};

const STORAGE = 'jeevansetu-location';

/** Quick-pick Indian cities for offline/manual selection. */
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

export type GeoErrorCode = 'unavailable' | 'denied' | 'failed';

interface LocationCtxValue {
  location: UserLocation;
  setManual: (lat: number, lng: number, label: string, source?: 'manual' | 'preset') => void;
  requestGeolocation: () => void;
  status: 'idle' | 'locating' | 'error';
  error: string | null;
  errorCode: GeoErrorCode | null;
}

const LocationCtx = createContext<LocationCtxValue | null>(null);

function useLocationInternal(): LocationCtxValue {
  const [location, setLocation] = useState<UserLocation>(DEFAULT_LOCATION);
  const [status, setStatus] = useState<'idle' | 'locating' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<GeoErrorCode | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE);
      if (saved) {
        const parsed = JSON.parse(saved) as UserLocation;
        if (typeof parsed?.lat === 'number' && typeof parsed?.lng === 'number' && !Number.isNaN(parsed.lat) && !Number.isNaN(parsed.lng)) {
          setLocation(parsed);
        }
      }
    } catch { /* ignore */ }
  }, []);

  const persist = useCallback((loc: UserLocation) => {
    setLocation(loc);
    try { window.localStorage.setItem(STORAGE, JSON.stringify(loc)); } catch { /* ignore */ }
  }, []);

  const requestGeolocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus('error');
      setErrorCode('unavailable');
      setError('Location is not available on this device. Please pick a city below.');
      return;
    }
    setStatus('locating');
    setError(null);
    setErrorCode(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        persist({
          lat: Number(pos.coords.latitude.toFixed(5)),
          lng: Number(pos.coords.longitude.toFixed(5)),
          label: 'Your current location',
          source: 'geolocation',
        });
        setStatus('idle');
      },
      (err) => {
        setStatus('error');
        const denied = err.code === err.PERMISSION_DENIED;
        setErrorCode(denied ? 'denied' : 'failed');
        setError(
          denied
            ? 'Location permission was denied. You can still search by typing your city below.'
            : 'Could not detect your location. Please try again or pick a city below.',
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 180000 },
    );
  }, [persist]);

  const setManual = useCallback((lat: number, lng: number, label: string, source: 'manual' | 'preset' = 'manual') => {
    setStatus('idle');
    setError(null);
    setErrorCode(null);
    persist({ lat: Number(lat.toFixed(5)), lng: Number(lng.toFixed(5)), label, source });
  }, [persist]);

  return { location, setManual, requestGeolocation, status, error, errorCode };
}

export function LocationProvider({ children }: { children: ReactNode }) {
  const val = useLocationInternal();
  return <LocationCtx.Provider value={val}>{children}</LocationCtx.Provider>;
}

export function useUserLocation(): LocationCtxValue {
  const ctx = useContext(LocationCtx);
  const fallback = useLocationInternal();
  return ctx ?? fallback;
}
