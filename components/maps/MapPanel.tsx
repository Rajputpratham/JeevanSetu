'use client';
import dynamic from 'next/dynamic';
import type { ComponentProps } from 'react';
import { useLang } from '@/lib/i18n';

const GoogleMapViewLazy = dynamic(() => import('./GoogleMapView'), {
  ssr: false,
  loading: () => <MapSkeleton />,
});

function MapSkeleton() {
  const { t } = useLang();
  return (
    <div className="h-72 sm:h-96 w-full rounded-2xl border-2 border-brand-100 bg-brand-50 flex items-center justify-center text-brand-800 font-semibold animate-pulse">
      {t('loadingMap')}
    </div>
  );
}

/**
 * Client-only wrapper for the Google Map.
 *
 * The map is rendered ONLY when Google's browser key is configured (checked at
 * build time from the public env var). We deliberately do not ship a second map
 * provider as a stand-in: requirement 4 asks for Google Maps, and showing an
 * OpenStreetMap tile set while calling it "Google Maps" would be misleading.
 */
export default function MapPanel(props: ComponentProps<typeof GoogleMapViewLazy>) {
  if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY && !process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-brand-200 bg-brand-50/60 p-5 text-center"
        role="status"
        data-testid="map-key-missing"
      >
        <p className="text-sm font-bold text-brand-900">Interactive map unavailable</p>
        <p className="max-w-lg text-xs text-slate-600">
          Hospital lists, verified Google driving distances and directions all work. The interactive
          Google Map needs a browser-restricted <code className="rounded bg-white px-1">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code>.
        </p>
      </div>
    );
  }
  return <GoogleMapViewLazy {...props} />;
}
