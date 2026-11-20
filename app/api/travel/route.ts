import { NextRequest, NextResponse } from 'next/server';
import { HOSPITALS } from '@/data/hospitals';
import { resolveHospitalGeo } from '@/data/hospital-locations';
import { getTravelSnapshot, hasServerMapsKey } from '@/lib/travel';
import { cached, travelCacheKey } from '@/lib/travel-cache';
import { getLangMeta, isValidLang } from '@/lib/lang-meta';
import { enforceRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const CACHE_TTL_MS = 60_000;

/**
 * GET /api/travel — the ONLY endpoint any component should use for driving
 * distances. Returns one snapshot (single origin, single route source) that the
 * cards, map, comparison, emergency list and assistant all render from.
 *
 * Query: lat, lng, source, accuracy, label, ids (comma separated), lang
 *
 * Rate limited per IP: each cache miss fans out to the billed Google Routes API.
 */
export async function GET(request: NextRequest) {
  const limited = enforceRateLimit(
    request,
    'travel',
    'Too many distance requests. Please wait a moment before retrying.',
  );
  if (limited) return limited;

  const sp = request.nextUrl.searchParams;
  const lat = parseFloat(sp.get('lat') ?? '');
  const lng = parseFloat(sp.get('lng') ?? '');

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json(
      {
        error: 'A valid origin (lat, lng) is required. JeevanSetu never guesses your location.',
        code: 'ORIGIN_REQUIRED',
      },
      { status: 400 },
    );
  }
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ error: 'Origin coordinates are out of range.', code: 'BAD_ORIGIN' }, { status: 400 });
  }

  const langRaw = sp.get('lang') ?? 'en';
  const lang = isValidLang(langRaw) ? langRaw : 'en';
  const sourceRaw = sp.get('source');
  const originSource =
    sourceRaw === 'geolocation' || sourceRaw === 'manual' || sourceRaw === 'preset' || sourceRaw === 'map'
      ? sourceRaw
      : 'unknown';
  const accuracy = parseFloat(sp.get('accuracy') ?? '');
  const label = (sp.get('label') ?? '').slice(0, 160);

  const idsParam = (sp.get('ids') ?? '').trim();
  let targets = HOSPITALS;
  if (idsParam) {
    const wanted = new Set(idsParam.split(',').map((s) => s.trim()).filter(Boolean));
    targets = HOSPITALS.filter((h) => wanted.has(h.id));
    if (targets.length === 0) {
      return NextResponse.json({ error: 'None of the requested hospital ids exist.', code: 'UNKNOWN_IDS' }, { status: 404 });
    }
  }

  try {
    const snapshot = await cached(
      travelCacheKey(['snapshot', lat, lng, targets.map((h) => h.id).join('+'), lang]),
      CACHE_TTL_MS,
      () =>
        getTravelSnapshot({
          origin: { lat, lng },
          originSource,
          originLabel: label,
          originAccuracyM: Number.isFinite(accuracy) ? accuracy : null,
          hospitals: targets,
          // Google expects a BCP-47 code; `speechLocale` already maps every
          // supported language to its Indian regional variant (hi-IN, ta-IN, …).
          language: getLangMeta(lang).speechLocale,
        }),
    );

    return NextResponse.json({
      ...snapshot,
      /** Every hospital the caller asked about, with validated coordinates attached. */
      hospitals: targets.map((h) => {
        const geo = resolveHospitalGeo(h);
        const leg = snapshot.legs[h.id];
        return {
          id: h.id,
          shortName: h.shortName,
          city: h.city,
          lat: geo.lat,
          lng: geo.lng,
          coordinateConfidence: geo.confidence,
          coordinateNote: geo.note,
          distanceKm: leg?.distanceKm ?? null,
          distanceMeters: leg?.distanceMeters ?? null,
          straightKm: leg?.straightKm ?? null,
          etaMinutes: leg?.etaMinutes ?? null,
          staticMinutes: leg?.staticMinutes ?? null,
          trafficImpactMinutes: leg?.trafficImpactMinutes ?? null,
          source: leg?.source ?? 'unavailable',
          error: leg?.error ?? null,
        };
      }),
      apiStatus: {
        serverKeyConfigured: hasServerMapsKey(),
        publicBrowserKeyConfigured: Boolean(
          process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY,
        ),
      },
    });
  } catch (err) {
    console.error('[api/travel]', err);
    return NextResponse.json(
      { error: 'Could not calculate travel distances right now.', code: 'TRAVEL_FAILED' },
      { status: 500 },
    );
  }
}
