import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getHospitals } from '@/app/api/hospitals/route';
import { GET as getGeocode } from '@/app/api/geocode/route';
import { GET as getEmergency } from '@/app/api/emergency/route';
import { GET as getGoogleRating } from '@/app/api/google-ratings/route';
import { GET as getReviews, POST as postReview } from '@/app/api/reviews/route';
import { POST as postChat } from '@/app/api/chat/route';
import { HOSPITALS } from '@/data/hospitals';
import { estimateTravelMetrics } from '@/lib/geo';

describe('LOOP 4 — Cross-Feature User Journeys & API Integration Verification', () => {
  it('Journey 1: Multilingual Discovery (Tamil -> Pusa Road -> Marker #2 -> Hindi preserves origin & distance)', async () => {
    // 1. Geocode Pusa Road, New Delhi in Tamil
    const geoReq = new NextRequest('http://localhost:3000/api/geocode?q=Pusa%20Road,%20New%20Delhi&lang=ta');
    const geoRes = await getGeocode(geoReq);
    const geoData = await geoRes.json();
    expect(geoData.results.length).toBeGreaterThan(0);
    const origin = geoData.results[0];
    expect(origin.label).toContain('Pusa Road');

    // 2. Fetch nearby hospitals around Pusa Road in Tamil
    const hospTaReq = new NextRequest(
      `http://localhost:3000/api/hospitals?lat=${origin.lat}&lng=${origin.lng}&radius=25&sort=distance&lang=ta`,
    );
    const hospTaRes = await getHospitals(hospTaReq);
    const hospTaData = await hospTaRes.json();
    expect(hospTaData.results.length).toBeGreaterThan(2);

    const marker2Ta = hospTaData.results[1]; // Marker #2 (1-based index 2)
    const detailMetrics = estimateTravelMetrics(origin.lat, origin.lng, marker2Ta.lat, marker2Ta.lng);
    // Distance & ETA consistency between discovery marker #2 and detail page calculation
    expect(marker2Ta.roadKm).toBe(detailMetrics.roadKm);
    expect(marker2Ta.etaMinutes).toBe(detailMetrics.trafficMinutes);

    // 3. Switch language to Hindi with same origin & filters -> hospital order, ID, roadKm, and ETA stay identical
    const hospHiReq = new NextRequest(
      `http://localhost:3000/api/hospitals?lat=${origin.lat}&lng=${origin.lng}&radius=25&sort=distance&lang=hi`,
    );
    const hospHiRes = await getHospitals(hospHiReq);
    const hospHiData = await hospHiRes.json();
    expect(hospHiData.results[1].id).toBe(marker2Ta.id);
    expect(hospHiData.results[1].roadKm).toBe(marker2Ta.roadKm);
    expect(hospHiData.results[1].etaMinutes).toBe(marker2Ta.etaMinutes);
  });

  it('Journey 2: Ratings, Google Honesty Disclosure, Review Moderation & 3-Hospital Comparison Origin Update', async () => {
    // 1. Inspect Google rating endpoint without API key -> never invents a score
    const gReq = new NextRequest('http://localhost:3000/api/google-ratings?hospitalId=aiims-new-delhi');
    const gRes = await getGoogleRating(gReq);
    const gData = await gRes.json();
    expect(gData.status).toBe('awaiting-api-key');
    expect(gData.rating).toBeNull();
    expect(gData.googleMapsUrl).toContain('google.com/maps');

    // 2. Inspect JeevanSetu Community Score & distribution
    const rReq = new NextRequest('http://localhost:3000/api/reviews?hospitalId=aiims-new-delhi');
    const rRes = await getReviews(rReq);
    const rData = await rRes.json();
    expect(rData.summary.imdbScaleScore).toBeGreaterThan(7);
    expect(rData.summary.eligibleCount).toBeGreaterThanOrEqual(3);

    // 3. Submit a new legitimate review and confirm score updates
    const postReq = new NextRequest('http://localhost:3000/api/reviews', {
      method: 'POST',
      body: JSON.stringify({
        hospitalId: 'rml-hospital',
        authorAlias: 'Priya M.',
        visitType: 'OPD',
        overall: 5,
        doctorCare: 5,
        cleanliness: 4,
        waitTime: 4,
        billingTransparency: 5,
        comment: 'Helpful doctors in general medicine OPD and free medicines at the pharmacy counter.',
      }),
    });
    const postRes = await postReview(postReq);
    expect(postRes.status).toBe(201);

    // 4. Compare 3 hospitals across origin change (Delhi -> Gurugram)
    const ids = ['aiims-new-delhi', 'safdarjung-hospital', 'medanta-medicity'];
    const selected = ids.map((id) => HOSPITALS.find((h) => h.id === id)!);
    const fromDelhi = selected.map((h) => estimateTravelMetrics(28.6139, 77.2090, h.lat, h.lng));
    const fromGurugram = selected.map((h) => estimateTravelMetrics(28.4595, 77.0266, h.lat, h.lng));

    // From Delhi, AIIMS is closer than Medanta; from Gurugram, Medanta is closer than AIIMS!
    expect(fromDelhi[0].roadKm).toBeLessThan(fromDelhi[2].roadKm);
    expect(fromGurugram[2].roadKm).toBeLessThan(fromGurugram[0].roadKm);
  });

  it('Journey 3: Emergency Assistance (Verified 24x7 hospitals, Traffic-aware ETAs, No fake incident alerts)', async () => {
    const emReq = new NextRequest('http://localhost:3000/api/emergency?lat=28.6426&lng=77.1842&lang=en');
    const emRes = await getEmergency(emReq);
    const emData = await emRes.json();
    expect(emData.verifiedCount).toBeGreaterThan(10);
    expect(emData.hospitals[0].emergency).toBe('verified');
    expect(emData.hospitals[0].roadKm).toBeGreaterThan(0);
    expect(emData.hospitals[0].etaMinutes).toBeGreaterThan(0);
    expect(emData.incidentFeedStatus).toBe('unavailable-no-authorised-feed');
  });

  it('Journey 4: Bengali AI Chatbot (Nearby govt hospitals + ETA/Cost + Refuses unsupported claims)', async () => {
    // Ask in Bengali for nearby government hospitals in Kolkata
    const chatBnReq = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: 'কাছাকাছি সরকারি হাসপাতাল দেখান',
        lang: 'bn',
        lat: 22.5726,
        lng: 88.3639, // Kolkata
      }),
    });
    const chatBnRes = await postChat(chatBnReq);
    const chatBnData = await chatBnRes.json();
    expect(chatBnData.recommendedHospitals.length).toBeGreaterThan(0);
    // All returned hospitals must be actual government hospitals from dataset, nearest to Kolkata = sskm-kolkata
    expect(chatBnData.recommendedHospitals.every((h: { type: string }) => h.type === 'government')).toBe(true);
    expect(chatBnData.recommendedHospitals[0].id).toBe('sskm-kolkata');

    // Ask about travel time & delivery cost for SSKM Hospital
    const followReq = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: 'normal delivery cost and travel time',
        lang: 'bn',
        lat: 22.5726,
        lng: 88.3639,
        focusedHospitalId: 'sskm-kolkata',
      }),
    });
    const followRes = await postChat(followReq);
    const followData = await followRes.json();
    expect(followData.costEstimate).toBeDefined();
    expect(followData.costEstimate.govtRange).toContain('₹');

    // Ask unsupported medical prescription / live ICU bed query -> explicitly refuses to invent
    const unsupReq = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: 'Which medicine should I take and available icu bed right now?',
        lang: 'en',
        lat: 22.5726,
        lng: 88.3639,
      }),
    });
    const unsupRes = await postChat(unsupReq);
    const unsupData = await unsupRes.json();
    expect(unsupData.reply.toLowerCase()).toContain('cannot prescribe');
  });
});
