'use client';
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Hospital } from '@/data/types';
import { formatDistance } from '@/lib/geo';
import { useLang } from '@/lib/i18n';

export type MapHospital = Hospital & { distanceKm?: number | null };

interface Props {
  hospitals: MapHospital[];
  center: { lat: number; lng: number };
  /** zoom level; defaults to 11 */
  zoom?: number;
  className?: string;
  /** show a highlighted marker at the user location */
  userLocation?: { lat: number; lng: number } | null;
}

function markerIcon(label: string, kind: 'govt' | 'private' | 'user'): L.DivIcon {
  const colors = {
    govt: { bg: '#1b5e45', ring: '#d7ece2' },
    private: { bg: '#0e7490', ring: '#cffafe' },
    user: { bg: '#b91c1c', ring: '#fee2e2' },
  }[kind];
  return L.divIcon({
    className: 'js-map-marker',
    html: `<div style="width:34px;height:34px;border-radius:9999px;background:${colors.bg};color:#fff;display:flex;align-items:center;justify-content:center;font:700 13px/1 'Segoe UI',system-ui,sans-serif;border:3px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.35),0 0 0 3px ${colors.ring};">${label}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -14],
  });
}

export default function MapView({ hospitals, center, zoom = 11, className = '', userLocation = null }: Props) {
  const { t, lang } = useLang();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  // Create map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { scrollWheelZoom: false, attributionControl: true }).setView([center.lat, center.lng], zoom);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
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

  // Recenter when center changes materially
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setView([center.lat, center.lng], zoom, { animate: false });
  }, [center.lat, center.lng, zoom]);

  // Redraw markers when the hospital set or language changes
  useEffect(() => {
    const layer = layerRef.current;
    const map = mapRef.current;
    if (!layer || !map) return;
    layer.clearLayers();

    hospitals.slice(0, 60).forEach((h, i) => {
      const icon = markerIcon(String(i + 1), h.type === 'government' ? 'govt' : 'private');
      const marker = L.marker([h.lat, h.lng], { icon, title: h.shortName });
      const dist = typeof h.distanceKm === 'number'
        ? `<div style="font-size:12px;color:#475569;margin-top:2px">${formatDistance(h.distanceKm, lang)} ${escapeHtml(t('away'))}</div>`
        : '';
      const typeLabel = h.type === 'government' ? t('govtBadge') : t('privateBadge');
      const emLabel = h.emergency === 'verified' ? ` · ${t('emergency247')}` : '';
      marker.bindPopup(
        `<div style="min-width:200px;max-width:260px">
           <div style="font-weight:700;font-size:13px;line-height:1.35">${i + 1}. ${escapeHtml(h.name)}</div>
           ${dist}
           <div style="font-size:11px;margin-top:4px;color:#1f7453;font-weight:600;text-transform:uppercase">${escapeHtml(typeLabel)}${escapeHtml(emLabel)}</div>
           <a href="/hospitals/${encodeURIComponent(h.id)}" style="display:inline-block;margin-top:6px;background:#1f7453;color:#fff;padding:6px 12px;border-radius:8px;font-size:12px;font-weight:700;text-decoration:none">${escapeHtml(t('viewDetails'))} →</a>
         </div>`,
      );
      marker.addTo(layer);
    });

    if (userLocation) {
      L.marker([userLocation.lat, userLocation.lng], { icon: markerIcon(t('youShort'), 'user'), title: t('yourLocation'), zIndexOffset: 1000 })
        .bindPopup(`<div style="font-weight:700;font-size:13px">${escapeHtml(t('yourLocation'))}</div>`)
        .addTo(layer);
    }
  }, [hospitals, userLocation, lang, t]);

  return <div ref={containerRef} className={`h-72 sm:h-96 w-full border border-brand-100 ${className}`} role="application" aria-label={t('mapAriaLabel')} />;
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
