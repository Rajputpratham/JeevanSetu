'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Hospital } from '@/data/types';
import { formatDrivingKm, formatDuration } from '@/lib/geo';
import { useLang } from '@/lib/i18n';
import { distanceStrings } from '@/lib/ui-strings';
import { loadGoogleMaps, getGoogleMapsKey } from './google-maps-loader';

/* Minimal structural typings for the Maps JS API (avoids adding @types/google.maps). */
interface GLatLngLiteral { lat: number; lng: number }
interface GMap {
  setCenter: (p: GLatLngLiteral) => void;
  setZoom: (z: number) => void;
  fitBounds: (b: GBounds, padding?: number) => void;
  panTo: (p: GLatLngLiteral) => void;
  addListener: (target: unknown, event: string, handler: () => void) => void;
}
interface GBounds { extend: (p: GLatLngLiteral) => void }
interface GMarker {
  setMap: (m: GMap | null) => void;
  setIcon: (i: unknown) => void;
  setZIndex: (z: number) => void;
  addListener: (event: string, handler: () => void) => void;
  getPosition: () => { lat: () => number; lng: () => number } | undefined;
}
interface GPolyline { setMap: (m: GMap | null) => void }
interface GCircle { setMap: (m: GMap | null) => void }
interface GInfoWindow {
  open: (o: { map: GMap; anchor?: GMarker }) => void;
  close: () => void;
  setContent: (c: string) => void;
}
interface GTrafficLayer { setMap: (m: GMap | null) => void }
interface GMapsNamespace {
  Map: new (el: HTMLElement, opts: Record<string, unknown>) => GMap;
  Marker: new (opts: Record<string, unknown>) => GMarker;
  Polyline: new (opts: Record<string, unknown>) => GPolyline;
  Circle: new (opts: Record<string, unknown>) => GCircle;
  InfoWindow: new (opts?: Record<string, unknown>) => GInfoWindow;
  TrafficLayer: new () => GTrafficLayer;
  LatLngBounds: new () => GBounds;
  SymbolPath: { CIRCLE: number };
  Size: new (w: number, h: number) => unknown;
  Point: new (x: number, y: number) => unknown;
}

export interface GoogleMapHospital extends Hospital {
  roadKm?: number | null;
  distanceKm?: number | null;
  etaMinutes?: number | null;
  trafficImpactMinutes?: number | null;
}

interface Props {
  hospitals: GoogleMapHospital[];
  center: { lat: number; lng: number };
  zoom?: number;
  className?: string;
  userLocation?: { lat: number; lng: number; accuracyM?: number | null } | null;
  selectedHospitalId?: string | null;
  onSelectHospital?: (hospitalId: string, indexOneBased: number) => void;
  routeGeometry?: [number, number][] | null;
  alternativeGeometries?: [number, number][][] | null;
  /** Called when the user clicks the map to choose an origin. */
  onPickPoint?: (lat: number, lng: number) => void;
  showTraffic?: boolean;
}

/**
 * Requirement 4 — Google Maps JavaScript API renderer.
 *
 * Marker N always matches list item N (both are driven by the same ordered
 * array), clicking a card selects its marker and vice versa, the route polyline
 * is the decoded Google `encodedPolyline`, and traffic can be overlaid with the
 * TrafficLayer.
 *
 * When NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is absent this component reports that
 * honestly instead of replacing it with a look-alike map.
 */
export default function GoogleMapView({
  hospitals,
  center,
  zoom = 11,
  className = '',
  userLocation = null,
  selectedHospitalId = null,
  onSelectHospital,
  routeGeometry = null,
  alternativeGeometries = null,
  onPickPoint,
  showTraffic = false,
}: Props) {
  const { lang } = useLang();
  const ds = distanceStrings(lang);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<GMap | null>(null);
  const markersRef = useRef<Map<string, GMarker>>(new Map());
  const lineRef = useRef<GPolyline[]>([]);
  const altRef = useRef<GPolyline[]>([]);
  const circleRef = useRef<GCircle | null>(null);
  const trafficRef = useRef<GTrafficLayer | null>(null);
  const infoRef = useRef<GInfoWindow | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const hasKey = Boolean(getGoogleMapsKey());

  // ── Boot the map once ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!hasKey) return;
    let cancelled = false;
    void loadGoogleMaps().then((ok) => {
      if (cancelled) return;
      if (!ok || !containerRef.current) {
        setFailed(true);
        return;
      }
      const g = (window as unknown as { google: { maps: GMapsNamespace } }).google.maps;
      const map = new g.Map(containerRef.current, {
        center,
        zoom,
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: true,
        zoomControl: true,
        clickableIcons: false,
      });
      mapRef.current = map;
      infoRef.current = new g.InfoWindow();
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
    // The map is created ONCE per key availability. `center`/`zoom` are applied
    // by the recenter effect below, so they must not recreate the map (doing so
    // would reset the user's pan whenever the origin changes).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasKey]);

  /**
   * Map click → choose origin ("Select Location on Map").
   * Registered on the raw map instance; the Maps JS API passes the event object
   * (with `latLng`) to listeners as the first argument.
   */
  useEffect(() => {
    if (!ready || !onPickPoint || !mapRef.current) return;
    const map = mapRef.current as unknown as {
      addListener?: (event: string, handler: (ev: { latLng?: { lat: () => number; lng: () => number } }) => void) => void;
    };
    if (typeof map.addListener !== 'function') return;
    map.addListener('click', (ev) => {
      if (!ev?.latLng) return;
      onPickPoint(Number(ev.latLng.lat().toFixed(5)), Number(ev.latLng.lng().toFixed(5)));
    });
  }, [ready, onPickPoint]);

  // Recenter.
  // Intentionally keyed on the numeric fields rather than the `center` object:
  // callers re-create the object literal on every render, and depending on the
  // object would re-centre the map on every keystroke elsewhere in the page.
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    mapRef.current.setCenter({ lat: center.lat, lng: center.lng });
    mapRef.current.setZoom(zoom);
  }, [ready, center.lat, center.lng, zoom]);

  // ── Markers + polylines ───────────────────────────────────────────────────
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const g = (window as unknown as { google: { maps: GMapsNamespace } }).google.maps;
    const map = mapRef.current;

    for (const m of markersRef.current.values()) m.setMap(null);
    markersRef.current.clear();
    for (const p of lineRef.current) p.setMap(null);
    lineRef.current = [];
    for (const p of altRef.current) p.setMap(null);
    altRef.current = [];

    const bounds = new g.LatLngBounds();
    let drewBounds = false;

    // Alternative route previews (thin, grey) — the selected route is bold.
    for (const alt of alternativeGeometries ?? []) {
      if (alt.length < 2) continue;
      const line = new g.Polyline({
        path: alt.map(([lat, lng]) => ({ lat, lng })),
        strokeColor: '#94a3b8',
        strokeOpacity: 0.55,
        strokeWeight: 4,
        map,
        zIndex: 1,
      });
      altRef.current.push(line);
    }

    if (routeGeometry && routeGeometry.length >= 2) {
      const line = new g.Polyline({
        path: routeGeometry.map(([lat, lng]) => ({ lat, lng })),
        strokeColor: '#1b5e45',
        strokeOpacity: 0.9,
        strokeWeight: 6,
        map,
        zIndex: 3,
      });
      lineRef.current.push(line);
      for (const [lat, lng] of routeGeometry) {
        bounds.extend({ lat, lng });
        drewBounds = true;
      }
    }

    // Numbered markers — index + 1 is the shared identity with the list.
    hospitals.slice(0, 60).forEach((h, i) => {
      const idx = i + 1;
      const isSelected = selectedHospitalId === h.id;
      const marker = new g.Marker({
        position: { lat: h.lat, lng: h.lng },
        map,
        zIndex: isSelected ? 900 : 100,
        title: `${idx}. ${h.shortName}`,
        label: { text: String(idx), color: '#ffffff', fontSize: isSelected ? '14px' : '12px', fontWeight: '800' },
        icon: {
          path: g.SymbolPath.CIRCLE,
          scale: isSelected ? 19 : 15,
          fillColor: isSelected ? '#0f3d2c' : h.type === 'government' ? '#1b5e45' : '#0e7490',
          fillOpacity: 1,
          strokeColor: isSelected ? '#fde047' : '#ffffff',
          strokeWeight: isSelected ? 4 : 2.5,
        },
      });

      marker.addListener('click', () => {
        onSelectHospital?.(h.id, idx);
        const driving = formatDrivingKm(h.roadKm ?? h.distanceKm ?? null, lang);
        const eta = typeof h.etaMinutes === 'number' ? formatDuration(h.etaMinutes, lang) : null;
        if (infoRef.current) {
          infoRef.current.setContent?.(
            `<div style="font:600 13px/1.4 system-ui,sans-serif;max-width:240px">
               <div style="font-weight:800;margin-bottom:4px">${idx}. ${escapeHtml(h.name)}</div>
               <div style="color:#334155;font-size:12px">${escapeHtml(ds.drivingDistance)}: ${
                 driving ? escapeHtml(driving) : `<span style="color:#b45309">${escapeHtml(ds.distanceUnavailable)}</span>`
               }</div>
               ${eta ? `<div style="color:#334155;font-size:12px">${escapeHtml(ds.eta)}: ~${escapeHtml(eta)}</div>` : ''}
               <a href="/hospitals/${encodeURIComponent(h.id)}" style="display:inline-block;margin-top:6px;background:#1f7453;color:#fff;padding:5px 10px;border-radius:7px;font-size:12px;font-weight:700;text-decoration:none">Details →</a>
             </div>`,
          );
          infoRef.current.open({ map, anchor: marker });
        }
      });

      markersRef.current.set(h.id, marker);
      if (isSelected) {
        bounds.extend({ lat: h.lat, lng: h.lng });
        drewBounds = true;
      }
    });

    // Distinct user-location marker (blue dot) + accuracy circle.
    if (userLocation) {
      new g.Marker({
        position: userLocation,
        map,
        zIndex: 1000,
        title: ds.drivingDistance,
        icon: {
          path: g.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: '#1a73e8',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 3,
        },
      });
      if (circleRef.current) circleRef.current.setMap(null);
      if (typeof userLocation.accuracyM === 'number' && userLocation.accuracyM > 0) {
        circleRef.current = new g.Circle({
          center: userLocation,
          radius: userLocation.accuracyM,
          strokeColor: '#1a73e8',
          strokeOpacity: 0.6,
          strokeWeight: 1,
          fillColor: '#1a73e8',
          fillOpacity: 0.12,
          map,
        });
      }
      bounds.extend(userLocation);
      drewBounds = true;
    }

    if (drewBounds) {
      try {
        map.fitBounds(bounds, 48);
      } catch {
        /* single point */
      }
    }
  }, [
    ready, hospitals, userLocation, selectedHospitalId, routeGeometry, alternativeGeometries,
    onSelectHospital, lang, ds,
  ]);

  // Traffic overlay toggle
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const g = (window as unknown as { google: { maps: GMapsNamespace } }).google.maps;
    if (showTraffic) {
      if (!trafficRef.current) trafficRef.current = new g.TrafficLayer();
      trafficRef.current.setMap(mapRef.current);
    } else if (trafficRef.current) {
      trafficRef.current.setMap(null);
    }
  }, [ready, showTraffic]);

  const recenter = useCallback(() => {
    if (!mapRef.current) return;
    mapRef.current.panTo(center);
    mapRef.current.setZoom(zoom);
  }, [center, zoom]);

  if (!hasKey) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand-200 bg-brand-50/60 p-6 text-center ${className}`}
        role="status"
        data-testid="google-maps-unavailable"
      >
        <p className="text-sm font-bold text-brand-900">Map preview unavailable</p>
        <p className="max-w-md text-xs text-slate-600">
          Use the directions link to open Google Maps separately.
        </p>
      </div>
    );
  }

  if (failed) {
    return (
      <div className={`flex items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center ${className}`} role="alert">
        <p className="text-sm font-semibold text-amber-900">
          Google Maps could not load. Use the hospital’s directions link instead.
        </p>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <div ref={containerRef} className="h-72 w-full rounded-2xl border border-brand-100 sm:h-96" role="application" aria-label="Google map of nearby hospitals" />
      <button
        type="button"
        onClick={recenter}
        className="absolute bottom-3 right-3 rounded-full bg-white px-3 py-2 text-xs font-bold text-brand-900 shadow-lg border border-brand-200"
      >
        Recenter
      </button>
    </div>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
