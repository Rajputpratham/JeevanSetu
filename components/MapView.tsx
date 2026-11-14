'use client';
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Hospital } from '@/data/types';
import { formatDistance, formatDuration } from '@/lib/geo';
import { useLang } from '@/lib/i18n';

export type MapHospital = Hospital & {
  distanceKm?: number | null;
  roadKm?: number | null;
  etaMinutes?: number | null;
};

interface Props {
  hospitals: MapHospital[];
  center: { lat: number; lng: number };
  /** zoom level; defaults to 11 */
  zoom?: number;
  className?: string;
  /** show a highlighted marker at the user location */
  userLocation?: { lat: number; lng: number } | null;
  /** currently selected hospital ID (highlights marker & syncs with card) */
  selectedHospitalId?: string | null;
  /** callback when user clicks a numbered marker */
  onSelectHospital?: (hospitalId: string, indexOneBased: number) => void;
  /** optional route polyline coordinates [[lat, lng], ...] */
  routeGeometry?: [number, number][] | null;
}

function markerIcon(
  label: string,
  kind: 'govt' | 'private' | 'user',
  isSelected = false,
): L.DivIcon {
  const colors = {
    govt: { bg: isSelected ? '#0f3d2c' : '#1b5e45', ring: isSelected ? '#fde047' : '#d7ece2' },
    private: { bg: isSelected ? '#0c4a6e' : '#0e7490', ring: isSelected ? '#fde047' : '#cffafe' },
    user: { bg: '#b91c1c', ring: '#fee2e2' },
  }[kind];
  const size = isSelected ? 40 : 34;
  return L.divIcon({
    className: 'js-map-marker',
    html: `<div data-marker-label="${escapeHtml(label)}" style="width:${size}px;height:${size}px;border-radius:9999px;background:${colors.bg};color:#fff;display:flex;align-items:center;justify-content:center;font:800 ${isSelected ? '14px' : '13px'}/1 'Segoe UI',system-ui,sans-serif;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.4),0 0 0 ${isSelected ? 4 : 3}px ${colors.ring};transition:transform .15s ease;">${escapeHtml(label)}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2)],
  });
}

export default function MapView({
  hospitals,
  center,
  zoom = 11,
  className = '',
  userLocation = null,
  selectedHospitalId = null,
  onSelectHospital,
  routeGeometry = null,
}: Props) {
  const { t, lang } = useLang();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const markersByIdRef = useRef<Map<string, L.Marker>>(new Map());

  // Create map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { scrollWheelZoom: false, attributionControl: true }).setView(
      [center.lat, center.lng],
      zoom,
    );
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
    }).addTo(map);
    map.on('focus', () => map.scrollWheelZoom.enable());
    map.on('blur', () => map.scrollWheelZoom.disable());
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recenter when center changes materially (unless route bounds handle it)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || (routeGeometry && routeGeometry.length >= 2)) return;
    map.setView([center.lat, center.lng], zoom, { animate: false });
  }, [center.lat, center.lng, zoom, routeGeometry]);

  // Redraw markers and route polyline
  useEffect(() => {
    const layer = layerRef.current;
    const map = mapRef.current;
    if (!layer || !map) return;
    layer.clearLayers();
    markersByIdRef.current.clear();

    if (routeGeometry && routeGeometry.length >= 2) {
      const poly = L.polyline(routeGeometry, {
        color: '#1b5e45',
        weight: 5,
        opacity: 0.85,
        dashArray: routeGeometry.length <= 5 ? '8, 6' : undefined,
      }).addTo(layer);
      try {
        map.fitBounds(poly.getBounds(), { padding: [36, 36], maxZoom: 14 });
      } catch { /* ignore bounds edge cases */ }
    }

    hospitals.slice(0, 60).forEach((h, i) => {
      const idx = i + 1;
      const isSelected = selectedHospitalId === h.id;
      const icon = markerIcon(String(idx), h.type === 'government' ? 'govt' : 'private', isSelected);
      const marker = L.marker([h.lat, h.lng], {
        icon,
        title: `${idx}. ${h.shortName}`,
        zIndexOffset: isSelected ? 900 : 0,
      });

      const roadDist = h.roadKm ?? h.distanceKm;
      const eta = h.etaMinutes;
      const distLine =
        typeof roadDist === 'number'
          ? `<div style="font-size:12px;color:#334155;margin-top:3px;font-weight:600">${formatDistance(roadDist, lang)}${
              typeof eta === 'number' ? ` · ~${formatDuration(eta, lang)}` : ''
            }</div>`
          : '';
      const typeLabel = h.type === 'government' ? t('govtBadge') : t('privateBadge');
      const emLabel = h.emergency === 'verified' ? ` · ${t('emergency247')}` : '';

      marker.bindPopup(
        `<div style="min-width:210px;max-width:270px">
           <div style="font-weight:800;font-size:13px;line-height:1.35">${idx}. ${escapeHtml(h.name)}</div>
           ${distLine}
           <div style="font-size:11px;margin-top:4px;color:#1f7453;font-weight:700;text-transform:uppercase">${escapeHtml(typeLabel)}${escapeHtml(emLabel)}</div>
           <a href="/hospitals/${encodeURIComponent(h.id)}" style="display:inline-block;margin-top:7px;background:#1f7453;color:#fff;padding:6px 12px;border-radius:8px;font-size:12px;font-weight:700;text-decoration:none">${escapeHtml(t('viewDetails'))} →</a>
         </div>`,
      );

      marker.on('click', () => {
        onSelectHospital?.(h.id, idx);
      });

      marker.addTo(layer);
      markersByIdRef.current.set(h.id, marker);

      if (isSelected) {
        marker.openPopup();
      }
    });

    if (userLocation) {
      L.marker([userLocation.lat, userLocation.lng], {
        icon: markerIcon(t('youShort'), 'user'),
        title: t('yourLocation'),
        zIndexOffset: 1000,
      })
        .bindPopup(`<div style="font-weight:700;font-size:13px">${escapeHtml(t('yourLocation'))}</div>`)
        .addTo(layer);
    }
  }, [hospitals, userLocation, selectedHospitalId, routeGeometry, onSelectHospital, lang, t]);

  return (
    <div
      ref={containerRef}
      className={`h-72 sm:h-96 w-full border border-brand-100 ${className}`}
      role="application"
      aria-label={t('mapAriaLabel')}
    />
  );
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
