'use client';

/**
 * Loader for the Google Maps JavaScript API (Requirement 4).
 *
 * The browser key here must be **referrer-restricted** and separate from the
 * server key used for Routes/Geocoding — see `.env.example` and the setup guide.
 * It is exposed as NEXT_PUBLIC_… by design (Google requires a browser key), but
 * it must never be a key that has Routes/Places enabled without restrictions.
 */

let loadPromise: Promise<boolean> | null = null;

export const GOOGLE_MAPS_CALLBACK = '__jeevansetuInitGoogleMaps';

export function getGoogleMapsKey(): string | null {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY;
  return key && key.trim().length > 0 ? key.trim() : null;
}

export function loadGoogleMaps(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if ((window as unknown as { google?: { maps?: unknown } }).google?.maps) return Promise.resolve(true);
  if (loadPromise) return loadPromise;

  const key = getGoogleMapsKey();
  if (!key) return Promise.resolve(false);

  loadPromise = new Promise<boolean>((resolve) => {
    const existing = document.getElementById('jeevansetu-google-maps');
    if (existing) {
      resolve(true);
      return;
    }

    const callbackName = GOOGLE_MAPS_CALLBACK;
    (window as unknown as Record<string, unknown>)[callbackName] = () => resolve(true);

    const script = document.createElement('script');
    script.id = 'jeevansetu-google-maps';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      key,
    )}&libraries=places,marker&loading=async&callback=${callbackName}&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });

  return loadPromise;
}
