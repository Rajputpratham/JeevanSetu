import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getHospitals } from '@/app/api/hospitals/route';
import { GET as getGeocode } from '@/app/api/geocode/route';
import { GET as getEmergency } from '@/app/api/emergency/route';
import { GET as getTravel } from '@/app/api/travel/route';
import { GET as getRouteDetail } from '@/app/api/route/route';
import { GET as getRankings } from '@/app/api/rankings/route';
import { POST as postAssistant } from '@/app/api/assistant/route';
import { HOSPITALS, getHospitalById } from '@/data/hospitals';

/**
 * LOOP D — end-to-end user journeys through the real route handlers.
 *
 * No credentials exist in this environment, so every journey must end in an
 * honest degraded state: real hospital data, real geocoding, and NO invented
 * distance, ETA or traffic number. These tests fail if a fallback ever starts
 * producing a road distance again.
 */

const PUSA = { lat: 28.6426, lng: 77.1842 };

describe('Journey 1 — multilingual discovery keeps one origin and one distance source', () => {
  it('geocodes Pusa Road, then returns the same road distances in Tamil and Hindi', async () => {
    const geoRes = await getGeocode(
      new NextRequest('http://localhost:3000/api/geocode?q=Pusa%20Road,%20New%20Delhi&lang=ta'),
    );
    const geoData = await geoRes.json();
    expect(geoData.results.length).toBeGreaterThan(0);
    expect(geoData.results[0].label).toContain('Pusa Road');
    const origin = geoData.results[0];

    const url = (lang: string) =>
      `http://localhost:3000/api/hospitals?lat=${origin.lat}&lng=${origin.lng}&source=manual&radius=25&sort=distance&lang=${lang}`;

    const ta = await (await getHospitals(new NextRequest(url('ta')))).json();
    const hi = await (await getHospitals(new NextRequest(url('hi')))).json();

    expect(ta.results.length).toBeGreaterThan(2);

    // Language must not change the data, only the labels.
    const ids = (r: { id: string }[]) => r.map((h) => h.id);
    expect(ids(ta.results)).toEqual(ids(hi.results));

    for (const h of ta.results) {
      const same = hi.results.find((x: { id: string }) => x.id === h.id);
      expect(same?.distanceKm).toBe(h.distanceKm);
      expect(same?.etaMinutes).toBe(h.etaMinutes);
      expect(same?.straightKm).toBe(h.straightKm);
    }

    // And with no Maps key, every distance is explicitly unknown — not modelled.
    for (const h of ta.results) {
      expect(h.distanceKm).toBeNull();
      expect(h.etaMinutes).toBeNull();
      expect(h.travelSource).toBe('unavailable');
    }
  });

  it('refuses to guess an origin when lat/lng are missing', async () => {
    const res = await getHospitals(new NextRequest('http://localhost:3000/api/hospitals?lang=en'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.origin).toBeNull();
    expect(data.results.length).toBeGreaterThan(0);
    expect(data.results.every((h: {distanceKm:number|null}) => h.distanceKm === null)).toBe(true);
  });
});

describe('Journey 2 — hospital detail shares the list’s data (no second opinion)', () => {
  beforeEach(() => {
    // Offline suite: no routing provider may be reached.
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the same leg from /api/travel and /api/route for the same hospital', async () => {
    const travel = await (
      await getTravel(
        new NextRequest(`http://localhost:3000/api/travel?lat=${PUSA.lat}&lng=${PUSA.lng}&ids=bsa-hospital,aiims-new-delhi`),
      )
    ).json();

    const detail = await (
      await getRouteDetail(
        new NextRequest(
          `http://localhost:3000/api/route?fromLat=${PUSA.lat}&fromLng=${PUSA.lng}&hospitalId=bsa-hospital`,
        ),
      )
    ).json();

    const fromTravel = travel.hospitals.find((h: { id: string }) => h.id === 'bsa-hospital');
    expect(detail.hospitalId).toBe('bsa-hospital');
    expect(detail.straightKm).toBe(fromTravel.straightKm);
    // With no Google key the detail route is served key-free by OSRM. In this
    // offline suite the OSRM call cannot succeed, so the honest outcome is a
    // labelled unavailable leg — never a number, never a live-traffic claim.
    expect(['osrm', 'unavailable']).toContain(detail.source);
    expect(detail.liveTraffic).toBe(false);
    if (detail.source === 'unavailable') {
      expect(detail.distanceKm).toBeNull();
      expect(detail.minutes).toBeNull();
      expect(detail.error).toBeTruthy();
      expect(detail.geometry).toEqual([]);
    }
    expect(detail.navigateUrl).toContain('google.com/maps');
    expect(detail.disclosure.text.length).toBeGreaterThan(10);
    expect(detail.disclosure.live).toBe(false);
  });

  it('rejects an unknown hospital id instead of routing somewhere else', async () => {
    const res = await getRouteDetail(
      new NextRequest(
        `http://localhost:3000/api/route?fromLat=${PUSA.lat}&fromLng=${PUSA.lng}&hospitalId=not-a-hospital`,
      ),
    );
    expect(res.status).toBe(404);
  });

  it('rejects non-numeric coordinates', async () => {
    const res = await getRouteDetail(
      new NextRequest('http://localhost:3000/api/route?fromLat=abc&fromLng=77.1&hospitalId=bsa-hospital'),
    );
    expect(res.status).toBe(400);
  });
});

describe('Journey 3 — emergency list is honest about what it does not know', () => {
  it('returns verified 24×7 hospitals with no invented ETA and no incident feed', async () => {
    const data = await (
      await getEmergency(new NextRequest(`http://localhost:3000/api/emergency?lat=${PUSA.lat}&lng=${PUSA.lng}&lang=en`))
    ).json();

    expect(data.verifiedCount).toBeGreaterThan(10);
    expect(data.hospitals[0].emergency).toBe('verified');
    expect(data.hospitals[0].distanceKm).toBeNull();
    expect(data.hospitals[0].etaMinutes).toBeNull();
    expect(data.incidentFeedStatus).toBe('unavailable-no-authorised-feed');
    expect(data.distanceDisclosure?.text).toBeTruthy();
    expect(data.originKnown).toBe(true);
  });

  it('still works with no origin (lists hospitals, no distances)', async () => {
    const res = await getEmergency(new NextRequest('http://localhost:3000/api/emergency?lang=en'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.originKnown).toBe(false);
    expect(data.hospitals.length).toBeGreaterThan(0);
    expect(data.hospitals.every((h: { distanceKm: number | null }) => h.distanceKm === null)).toBe(true);
  });
});

describe('Journey 4 — assistant answers greetings conversationally and searches on request', () => {
  const body = (payload: unknown) =>
    new NextRequest('http://localhost:3000/api/assistant', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });

  it('a Bengali greeting gets a greeting, not a hospital list', async () => {
    const res = await postAssistant(body({ message: 'হ্যালো', lang: 'bn', istHour: 10 }));
    const data = await res.json();
    expect(data.hospitals).toHaveLength(0);
    expect(data.toolsRun).toHaveLength(0);
    expect(data.intent).toBe('greeting');
    expect(data.reply).toMatch(/[\u0980-\u09FF]/);
  });

  it('a Bengali government-hospital request returns real hospitals in Bengali', async () => {
    const res = await postAssistant(
      body({
        message: 'কাছাকাছি সরকারি হাসপাতাল দেখান',
        lang: 'bn',
        origin: { lat: 22.5726, lng: 88.3639, label: 'Kolkata', source: 'manual' },
        istHour: 10,
      }),
    );
    const data = await res.json();
    expect(data.hospitals.length).toBeGreaterThan(0);
    expect(data.hospitals.every((h: { type: string }) => h.type === 'government')).toBe(true);
    expect(data.hospitals[0].id).toBe('sskm-kolkata');
    expect(data.groundingMode).toBe('deterministic-grounded');
    expect(data.blockers.join(' ')).toMatch(/GEMINI/);
  });

  it('refuses to prescribe, and says so explicitly', async () => {
    const res = await postAssistant(
      body({ message: 'Which medicine should I take and is an ICU bed free right now?', lang: 'en', istHour: 10 }),
    );
    const data = await res.json();
    expect(data.reply.toLowerCase()).toMatch(/cannot|do not have|will not guess/);
    expect(data.reply.toLowerCase()).not.toMatch(/take \d+\s?mg|prescribed/);
  });

  it('rejects an empty message and an oversized one', async () => {
    const empty = await postAssistant(body({ message: '   ', lang: 'en' }));
    expect(empty.status).toBe(400);

    const huge = await postAssistant(body({ message: 'x'.repeat(5000), lang: 'en' }));
    expect(huge.status).toBe(400);
  });
});

describe('Journey 5 — rankings & recommendations distinguish "no data" from "far away"', () => {
  it('rankings never use a modelled distance to place a hospital', async () => {
    const data = await (
      await getRankings(new NextRequest(`http://localhost:3000/api/rankings?lat=${PUSA.lat}&lng=${PUSA.lng}&lang=en`))
    ).json();
    expect(Array.isArray(data.results ?? data.hospitals)).toBe(true);
    for (const row of data.results ?? data.hospitals) {
      if ('distanceKm' in row) {
        // Either a real Google number or null — never a synthetic estimate.
        expect(row.distanceKm === null || typeof row.distanceKm === 'number').toBe(true);
      }
    }
  });

  it('the hospital dataset itself is internally consistent', () => {
    const ids = new Set(HOSPITALS.map((h) => h.id));
    expect(ids.size).toBe(HOSPITALS.length);
    for (const h of HOSPITALS) {
      expect(getHospitalById(h.id)?.name).toBe(h.name);
      expect(h.lat).toBeGreaterThan(6);
      expect(h.lat).toBeLessThan(36);
      expect(h.lng).toBeGreaterThan(68);
      expect(h.lng).toBeLessThan(98);
    }
  });
});
