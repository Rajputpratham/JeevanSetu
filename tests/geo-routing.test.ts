import { describe, it, expect } from 'vitest';
import {
  haversineKm,
  estimateRoadDistanceKm,
  estimateTravelMetrics,
  formatDistance,
  formatDuration,
  directionsUrl,
  directionsFromToUrl,
} from '@/lib/geo';
import { searchIndianLocalities } from '@/data/localities';
import { calculateRoute } from '@/lib/routing';

describe('Module 1, 2 & 3 — Geocoding, Distance Consistency & Traffic-Aware Routing', () => {
  it('geocodes Pusa Road, New Delhi accurately in offline gazetteer', () => {
    const matches = searchIndianLocalities('Pusa Road, New Delhi');
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].id).toBe('pusa-road-delhi');
    expect(matches[0].lat).toBeCloseTo(28.6426, 2);
    expect(matches[0].lng).toBeCloseTo(77.1842, 2);
  });

  it('supports pincode and multilingual locality queries', () => {
    const byPin = searchIndianLocalities('110029');
    expect(byPin[0]?.id).toBe('ansari-nagar-delhi');

    const byTamil = searchIndianLocalities('சென்னை');
    expect(byTamil[0]?.city).toBe('Chennai');

    const byBengali = searchIndianLocalities('কলকাতা');
    expect(byBengali[0]?.city).toBe('Kolkata');
  });

  it('computes consistent road distance >= straight-line Haversine distance', () => {
    const pusa = { lat: 28.6426, lng: 77.1842 };
    const blk = { lat: 28.6368, lng: 77.1682 };
    const straight = haversineKm(pusa.lat, pusa.lng, blk.lat, blk.lng);
    const road = estimateRoadDistanceKm(pusa.lat, pusa.lng, blk.lat, blk.lng);
    expect(road).toBeGreaterThan(straight);
    expect(road).toBeLessThan(straight * 1.5);
  });

  it('models peak vs off-peak traffic ETAs deterministically and labels source honestly', () => {
    const origin = { lat: 28.6426, lng: 77.1842 };
    const aiims = { lat: 28.5672, lng: 77.2100 };

    const peak = estimateTravelMetrics(origin.lat, origin.lng, aiims.lat, aiims.lng, 9); // 9 AM IST peak
    const night = estimateTravelMetrics(origin.lat, origin.lng, aiims.lat, aiims.lng, 2); // 2 AM IST off-peak

    expect(peak.roadKm).toBe(night.roadKm);
    expect(peak.trafficLevel).toBe('heavy');
    expect(night.trafficLevel).toBe('low');
    expect(peak.trafficMinutes).toBeGreaterThan(night.trafficMinutes);
    expect(peak.source).toBe('estimated-urban-model');
  });

  it('includes origin coordinates in Google Maps directions URLs', () => {
    const url = directionsUrl(28.5672, 77.21, 'AIIMS', { lat: 28.6426, lng: 77.1842 });
    expect(url).toBe(directionsFromToUrl(28.6426, 77.1842, 28.5672, 77.21, 'AIIMS'));
    expect(url).toContain('origin=28.6426,77.1842');
    expect(url).toContain('destination=28.5672,77.21');
  });

  it('formats distances and durations across Indian languages', () => {
    expect(formatDistance(4.25, 'en')).toBe('4.3 km');
    expect(formatDistance(4.25, 'ta')).toContain('கி.மீ');
    expect(formatDistance(4.25, 'bn')).toContain('কিমি');
    expect(formatDistance(4.25, 'ur')).toContain('کلومیٹر');
    expect(formatDuration(75, 'hi')).toContain('घंटा');
  });

  it('calculates route with geometry and honest traffic disclosure', async () => {
    const route = await calculateRoute(28.6426, 77.1842, 28.5672, 77.2100);
    expect(route.roadKm).toBeGreaterThan(0);
    expect(route.trafficMinutes).toBeGreaterThanOrEqual(route.baseMinutes);
    expect(route.geometry.length).toBeGreaterThanOrEqual(2);
    expect(route.trafficDisclosure.length).toBeGreaterThan(10);
  });
});
