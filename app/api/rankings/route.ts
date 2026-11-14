import { NextRequest, NextResponse } from 'next/server';
import { HOSPITALS } from '@/data/hospitals';
import { rankHospitals } from '@/lib/ratings';
import { getTravelSnapshot } from '@/lib/travel';
import { cached, travelCacheKey } from '@/lib/travel-cache';

export const dynamic = 'force-dynamic';

const CACHE_TTL_MS = 60_000;

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const city = (sp.get('city') ?? '').trim();
    const type = (sp.get('type') ?? 'all').trim();
    const speciality = (sp.get('speciality') ?? '').trim();
    const emergencyOnly = sp.get('emergency') === '1';
    const lat = parseFloat(sp.get('lat') ?? '');
    const lng = parseFloat(sp.get('lng') ?? '');

    let filtered = [...HOSPITALS];
    if (city) filtered = filtered.filter((h) => h.city.toLowerCase() === city.toLowerCase());
    if (type === 'government' || type === 'private') filtered = filtered.filter((h) => h.type === type);
    if (speciality) filtered = filtered.filter((h) => h.specialities.includes(speciality));
    if (emergencyOnly) filtered = filtered.filter((h) => h.emergency === 'verified');

    const ranked = rankHospitals(filtered);

    // Distances only when we actually know where the user is.
    let legs: Record<string, { distanceKm: number | null; etaMinutes: number | null; source: string }> = {};
    let distanceSource = 'unavailable';
    let distanceDisclosure = {
      text: 'Rankings do not require a location. Share your location to see driving distances.',
      live: false,
    };
    let blockers: string[] = [];

    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      const snapshot = await cached(
        travelCacheKey(['rankings', lat, lng, filtered.map((h) => h.id).join('+')]),
        CACHE_TTL_MS,
        () => getTravelSnapshot({ origin: { lat, lng }, hospitals: filtered, language: 'en-IN' }),
      );
      distanceSource = snapshot.source;
      distanceDisclosure = snapshot.disclosure;
      blockers = snapshot.blockers;
      legs = Object.fromEntries(
        Object.entries(snapshot.legs).map(([id, leg]) => [
          id,
          { distanceKm: leg.distanceKm, etaMinutes: leg.etaMinutes, source: leg.source },
        ]),
      );
    }

    return NextResponse.json({
      count: ranked.length,
      methodology:
        'Composite Score (0–100) = Verified Facilities (30) + Specialities (25) + Verified 24×7 Emergency (15) + Public Affordability (15) + IMDb-style Bayesian Community Score (15). Not a clinical mortality/outcome ranking.',
      results: ranked.map((entry) => ({
        ...entry,
        roadKm: legs[entry.hospital.id]?.distanceKm ?? null,
        distanceKm: legs[entry.hospital.id]?.distanceKm ?? null,
        etaMinutes: legs[entry.hospital.id]?.etaMinutes ?? null,
      })),
      distanceSource,
      distanceDisclosure,
      blockers,
    });
  } catch (err) {
    console.error('[api/rankings]', err);
    return NextResponse.json({ error: 'Failed to load rankings.' }, { status: 500 });
  }
}
