/**
 * JeevanSetu AI Assistant — tool layer.
 *
 * Requirement 7: the assistant must combine conversation with real application
 * functionality through structured actions:
 *   searchHospitals, getHospitalDetails, getCurrentLocation, calculateDrivingRoute,
 *   compareHospitals, getHospitalRatings, getEstimatedCosts, getEmergencyHospitals
 *
 * Every tool here returns *grounded* data. If a value is not in our dataset or
 * not returned by Google, the field is null and the assistant says so — it never
 * invents distances, ratings, costs or bed counts.
 */

import { HOSPITALS, getHospitalById } from '@/data/hospitals';
import { TREATMENTS } from '@/data/treatments';
import { resolveHospitalGeo } from '@/data/hospital-locations';
import { computeCommunityScore, getAllReviews } from '@/lib/ratings';
import { estimateTreatment } from '@/lib/cost-estimate';
import { formatRange } from '@/lib/format';
import { getRouteDetail, getTravelSnapshot, type TravelLeg } from '@/lib/travel';
import { HOSPITAL_ALIASES } from './intent';
import type { Lang } from '@/lib/lang-meta';

export interface OriginInput {
  lat: number;
  lng: number;
  label: string;
  source: 'geolocation' | 'manual' | 'preset' | 'map' | 'unknown';
  accuracyM?: number | null;
}

export interface AssistantHospital {
  id: string;
  name: string;
  shortName: string;
  type: 'government' | 'private';
  city: string;
  address: string;
  phone: string | null;
  emergency: string;
  specialities: string[];
  facilities: string[];
  costProfile: string;
  lat: number;
  lng: number;
  /** Driving distance in km from Google Routes, or null when unknown. */
  distanceKm: number | null;
  etaMinutes: number | null;
  trafficImpactMinutes: number | null;
  straightKm: number | null;
  travelSource: string;
  travelError: string | null;
  communityScore: number | null;
  imdbScore: number | null;
  reviewCount: number;
  coordinateConfidence: 'verified' | 'approximate';
}

export interface ToolResult<T> {
  ok: boolean;
  data: T | null;
  /** Machine-readable failure, echoed to the user verbatim when relevant. */
  error: string | null;
  /** Tools that need the user's position and did not get one. */
  needsOrigin?: boolean;
}

function toAssistantHospital(
  id: string,
  leg: TravelLeg | undefined,
): AssistantHospital | null {
  const h = getHospitalById(id);
  if (!h) return null;
  const geo = resolveHospitalGeo(h);
  const community = computeCommunityScore(h.id, getAllReviews());
  return {
    id: h.id,
    name: h.name,
    shortName: h.shortName,
    type: h.type,
    city: h.city,
    address: geo.address,
    phone: h.phone,
    emergency: h.emergency,
    specialities: h.specialities,
    facilities: h.facilities,
    costProfile: h.costProfile,
    lat: geo.lat,
    lng: geo.lng,
    distanceKm: leg?.distanceKm ?? null,
    etaMinutes: leg?.etaMinutes ?? null,
    trafficImpactMinutes: leg?.trafficImpactMinutes ?? null,
    straightKm: leg?.straightKm ?? null,
    travelSource: leg?.source ?? 'unavailable',
    travelError: leg?.error ?? null,
    communityScore: community.weightedStarScore,
    imdbScore: community.imdbScaleScore,
    reviewCount: community.eligibleCount,
    coordinateConfidence: geo.confidence,
  };
}

/** Resolve a free-text hospital reference to a stable JeevanSetu id. */
export function resolveHospitalReference(text: string): string[] {
  const ids: string[] = [];
  for (const alias of HOSPITAL_ALIASES) {
    if (alias.term.test(text)) ids.push(alias.id);
  }
  // Direct name/id substring matches as a second pass.
  const lower = text.toLowerCase();
  for (const h of HOSPITALS) {
    const nameHit =
      lower.includes(h.shortName.toLowerCase()) ||
      lower.includes(h.id.replace(/-/g, ' ')) ||
      lower.includes(h.name.toLowerCase().slice(0, Math.min(24, h.name.length)));
    if (nameHit) ids.push(h.id);
  }
  return [...new Set(ids)];
}

/**
 * Ordering rule used by every hospital list: real Google road distance first,
 * then straight-line distance (clearly a different measurement, used only for
 * ordering), then stable dataset order. Never a modelled road distance.
 */
function distanceKey(leg: { distanceKm: number | null; straightKm: number | null } | undefined): number {
  if (leg && typeof leg.distanceKm === 'number') return leg.distanceKm;
  if (leg && typeof leg.straightKm === 'number') return leg.straightKm + 1000; // behind real road distances
  return Number.POSITIVE_INFINITY;
}

export interface SearchHospitalsInput {
  query?: string;
  speciality?: string | null;
  type?: 'government' | 'private' | 'any';
  emergencyOnly?: boolean;
  limit?: number;
  origin: OriginInput | null;
  city?: string | null;
}

/**
 * searchHospitals — real dataset search, then Google Routes for the ordering.
 * NEVER call this for a greeting: the orchestrator gates it on intent.
 */
export async function searchHospitals(input: SearchHospitalsInput): Promise<ToolResult<AssistantHospital[]>> {
  const limit = Math.min(Math.max(input.limit ?? 4, 1), 8);
  let pool = [...HOSPITALS];

  if (input.type && input.type !== 'any') pool = pool.filter((h) => h.type === input.type);
  if (input.speciality) pool = pool.filter((h) => h.specialities.includes(input.speciality as string));
  if (input.emergencyOnly) pool = pool.filter((h) => h.emergency === 'verified');
  if (input.city) {
    const city = input.city.toLowerCase();
    const cityFiltered = pool.filter((h) => h.city.toLowerCase().includes(city));
    if (cityFiltered.length > 0) pool = cityFiltered;
  }
  if (input.query) {
    const q = input.query.toLowerCase().trim();
    const matched = pool.filter((h) =>
      [h.name, h.shortName, h.city, h.state, h.address, ...h.specialities, ...h.facilities]
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
    if (matched.length > 0) pool = matched;
  }

  if (pool.length === 0) {
    return { ok: true, data: [], error: null };
  }

  /**
   * When the user names a city, that city wins over GPS for *ordering*:
   * "government hospitals in Kolkata" asked from Delhi must return Kolkata
   * hospitals, not the nearest Delhi ones. Distances are then calculated from
   * the stated origin only if one exists, and are otherwise left unknown.
   */
  const cityTargeted = Boolean(input.city && pool.every((h) => h.city.toLowerCase().includes(input.city!.toLowerCase())));

  if (cityTargeted && !input.origin) {
    return {
      ok: true,
      data: pool
        .slice(0, limit)
        .map((h) => toAssistantHospital(h.id, undefined))
        .filter(Boolean) as AssistantHospital[],
      error: null,
      needsOrigin: true,
    };
  }

  if (!input.origin) {
    // No origin: still return hospitals, but with no distances at all.
    return {
      ok: true,
      data: pool.slice(0, limit).map((h) => toAssistantHospital(h.id, undefined)).filter(Boolean) as AssistantHospital[],
      error: null,
      needsOrigin: true,
    };
  }

  const snapshot = await getTravelSnapshot({
    origin: { lat: input.origin.lat, lng: input.origin.lng },
    originSource: input.origin.source,
    originLabel: input.origin.label,
    originAccuracyM: input.origin.accuracyM ?? null,
    hospitals: pool,
  });

  const ranked = pool
    .map((h) => ({ id: h.id, leg: snapshot.legs[h.id] }))
    .sort((a, b) => {
      // A named city is the primary key; Google distance only breaks ties.
      if (cityTargeted) {
        const city = input.city!.toLowerCase();
        const aMatch = HOSPITALS.find((h) => h.id === a.id)!.city.toLowerCase().includes(city) ? 0 : 1;
        const bMatch = HOSPITALS.find((h) => h.id === b.id)!.city.toLowerCase().includes(city) ? 0 : 1;
        if (aMatch !== bMatch) return aMatch - bMatch;
      }
      return distanceKey(a.leg) - distanceKey(b.leg);
    })
    .slice(0, limit)
    .map(({ id, leg }) => toAssistantHospital(id, leg))
    .filter(Boolean) as AssistantHospital[];

  return { ok: true, data: ranked, error: snapshot.blockers[0] ?? null };
}

export async function getEmergencyHospitals(
  origin: OriginInput | null,
  limit = 3,
): Promise<ToolResult<AssistantHospital[]>> {
  const pool = HOSPITALS.filter((h) => h.emergency === 'verified');
  if (!origin) {
    return {
      ok: true,
      data: pool.slice(0, limit).map((h) => toAssistantHospital(h.id, undefined)).filter(Boolean) as AssistantHospital[],
      error: null,
      needsOrigin: true,
    };
  }
  const snapshot = await getTravelSnapshot({
    origin: { lat: origin.lat, lng: origin.lng },
    originSource: origin.source,
    originLabel: origin.label,
    hospitals: pool,
  });
  const ranked = pool
    .map((h) => ({ id: h.id, leg: snapshot.legs[h.id] }))
    .sort((a, b) => distanceKey(a.leg) - distanceKey(b.leg))
    .slice(0, limit)
    .map(({ id, leg }) => toAssistantHospital(id, leg))
    .filter(Boolean) as AssistantHospital[];
  return { ok: true, data: ranked, error: snapshot.blockers[0] ?? null };
}

export interface HospitalDetailsToolResult {
  hospital: AssistantHospital;
  opdTimings: string | null;
  emergencyNote: string | null;
  beds: number | null;
  dataNote: string | null;
  travel: {
    distanceKm: number | null;
    etaMinutes: number | null;
    trafficImpactMinutes: number | null;
    alternatives: number;
    geometryPoints: number;
    navigateUrl: string | null;
    source: string;
  } | null;
}

export async function getHospitalDetails(
  hospitalId: string,
  origin: OriginInput | null,
): Promise<ToolResult<HospitalDetailsToolResult>> {
  const h = getHospitalById(hospitalId);
  if (!h) return { ok: false, data: null, error: 'Hospital not found in the JeevanSetu dataset.' };
  const geo = resolveHospitalGeo(h);

  let travel: HospitalDetailsToolResult['travel'] = null;
  if (origin) {
    const detail = await getRouteDetail({
      origin: { lat: origin.lat, lng: origin.lng },
      hospital: h,
    });
    travel = {
      distanceKm: detail.distanceKm,
      etaMinutes: detail.etaMinutes,
      trafficImpactMinutes: detail.trafficImpactMinutes,
      alternatives: detail.alternatives.length,
      geometryPoints: detail.geometry.length,
      navigateUrl: detail.navigateUrl,
      source: detail.source,
    };
  }

  const leg: TravelLeg | undefined = travel
    ? {
        hospitalId: h.id,
        distanceKm: travel.distanceKm,
        distanceMeters: travel.distanceKm === null ? null : Math.round(travel.distanceKm * 1000),
        etaMinutes: travel.etaMinutes,
        staticMinutes: null,
        trafficImpactMinutes: travel.trafficImpactMinutes,
        straightKm: 0,
        source: travel.source as TravelLeg['source'],
        computedAt: new Date().toISOString(),
        error: null,
        disclosure: { text: '', live: true },
      }
    : undefined;

  const hospital = toAssistantHospital(h.id, leg);
  if (!hospital) return { ok: false, data: null, error: 'Hospital could not be prepared.' };

  return {
    ok: true,
    data: {
      hospital: { ...hospital, address: geo.address },
      opdTimings: h.opdTimings,
      emergencyNote: h.emergencyNote ?? null,
      beds: h.beds,
      dataNote: h.dataNote ?? null,
      travel,
    },
    error: null,
  };
}

export interface CompareToolResult {
  a: AssistantHospital | null;
  b: AssistantHospital | null;
  rows: { label: string; aValue: string; bValue: string; comparable: boolean }[];
  limits: string[];
  originLabel: string | null;
}

export async function compareHospitals(
  ids: [string, string],
  origin: OriginInput | null,
): Promise<ToolResult<CompareToolResult>> {
  const [aId, bId] = ids;
  const aRaw = getHospitalById(aId);
  const bRaw = getHospitalById(bId);
  if (!aRaw || !bRaw) {
    return { ok: false, data: null, error: 'One of those hospitals is not in the JeevanSetu dataset.' };
  }

  let legs: Record<string, TravelLeg> = {};
  if (origin) {
    const snapshot = await getTravelSnapshot({
      origin: { lat: origin.lat, lng: origin.lng },
      originSource: origin.source,
      originLabel: origin.label,
      hospitals: [aRaw, bRaw],
    });
    legs = snapshot.legs;
  }

  const a = toAssistantHospital(aId, legs[aId]);
  const b = toAssistantHospital(bId, legs[bId]);

  const rows: CompareToolResult['rows'] = [
    {
      label: 'Type',
      aValue: aRaw.type === 'government' ? 'Government' : 'Private',
      bValue: bRaw.type === 'government' ? 'Government' : 'Private',
      comparable: true,
    },
    {
      label: 'Driving distance',
      aValue: a?.distanceKm !== null && a?.distanceKm !== undefined ? `${a.distanceKm.toFixed(1)} km` : 'not available',
      bValue: b?.distanceKm !== null && b?.distanceKm !== undefined ? `${b.distanceKm.toFixed(1)} km` : 'not available',
      comparable: Boolean(origin),
    },
    {
      label: 'Estimated drive',
      aValue: a?.etaMinutes ? `${a.etaMinutes} min` : 'not available',
      bValue: b?.etaMinutes ? `${b.etaMinutes} min` : 'not available',
      comparable: Boolean(origin),
    },
    {
      label: 'Specialities listed',
      aValue: String(aRaw.specialities.length),
      bValue: String(bRaw.specialities.length),
      comparable: true,
    },
    {
      label: 'Facilities listed',
      aValue: String(aRaw.facilities.length),
      bValue: String(bRaw.facilities.length),
      comparable: true,
    },
    {
      label: '24×7 emergency',
      aValue: aRaw.emergency === 'verified' ? 'Verified' : aRaw.emergency === 'unverified' ? 'Unverified' : 'Not listed',
      bValue: bRaw.emergency === 'verified' ? 'Verified' : bRaw.emergency === 'unverified' ? 'Unverified' : 'Not listed',
      comparable: true,
    },
    {
      label: 'Approx. beds',
      aValue: aRaw.beds ? String(aRaw.beds) : 'not listed',
      bValue: bRaw.beds ? String(bRaw.beds) : 'not listed',
      comparable: true,
    },
    {
      label: 'Cost profile',
      aValue: aRaw.costProfile.replace('-', ' '),
      bValue: bRaw.costProfile.replace('-', ' '),
      comparable: true,
    },
    {
      label: 'JeevanSetu community score',
      aValue: a?.imdbScore ? `${a.imdbScore.toFixed(1)}/10 (${a.reviewCount} reviews)` : 'no eligible reviews',
      bValue: b?.imdbScore ? `${b.imdbScore.toFixed(1)}/10 (${b.reviewCount} reviews)` : 'no eligible reviews',
      comparable: true,
    },
  ];

  return {
    ok: true,
    data: {
      a,
      b,
      rows,
      limits: [
        'Speciality and facility lists are what each hospital publishes — not a measure of clinical outcomes.',
        'JeevanSetu community scores come from moderated user reviews, not from clinical audits.',
        'Google ratings, when connected, reflect public opinion, not medical quality.',
        'Travel figures come from Google Routes for the same origin you selected.',
      ],
      originLabel: origin?.label ?? null,
    },
    error: null,
  };
}

export interface RatingsToolResult {
  hospitalId: string;
  name: string;
  communityScore: number | null;
  imdbScore: number | null;
  reviewCount: number;
  distribution: Record<string, number> | null;
  googleStatus: 'awaiting-api-key' | 'connected' | 'unknown';
  googleRating: number | null;
  googleCount: number | null;
  note: string;
}

export async function getHospitalRatings(hospitalId: string): Promise<ToolResult<RatingsToolResult>> {
  const h = getHospitalById(hospitalId);
  if (!h) return { ok: false, data: null, error: 'Hospital not found.' };
  const community = computeCommunityScore(h.id, getAllReviews());
  return {
    ok: true,
    data: {
      hospitalId: h.id,
      name: h.shortName,
      communityScore: community.weightedStarScore,
      imdbScore: community.imdbScaleScore,
      reviewCount: community.eligibleCount,
      distribution: community.distribution ?? null,
      googleStatus: process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY ? 'unknown' : 'awaiting-api-key',
      googleRating: null,
      googleCount: null,
      note:
        process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY
          ? 'Google ratings are fetched live on the hospital page; community scores come from moderated JeevanSetu reviews.'
          : 'Live Google ratings are not connected, so only moderated JeevanSetu community scores are shown — never a fabricated Google number.',
    },
    error: null,
  };
}

export interface CostToolResult {
  treatmentId: string;
  treatmentName: string;
  govtRange: string;
  privateRange: string;
  sourceNote: string;
  note: string | null;
}

const TREATMENT_ALIASES: { re: RegExp; id: string }[] = [
  { re: /c-section|caesarean|cesarean|सिज़ेरियन/i, id: 'caesarean' },
  { re: /normal delivery|delivery|maternity|प्रसव|डिलीवरी/i, id: 'normal-delivery' },
  { re: /cataract|मोतियाबिंद/i, id: 'cataract' },
  { re: /angioplasty|stent|एंजियोप्लास्टी/i, id: 'angioplasty' },
  { re: /dialysis|डायलिसिस/i, id: 'dialysis-session' },
  { re: /\bmri\b|एमआरआई/i, id: 'mri' },
  { re: /x-ray|xray|एक्स-रे/i, id: 'chest-xray' },
  { re: /ultrasound|sonography/i, id: 'ultrasound' },
  { re: /\becg\b/i, id: 'ecg' },
  { re: /\bcbc\b|blood test/i, id: 'cbc-test' },
  { re: /appendix|appendectomy|अपेंडिक्स/i, id: 'appendectomy' },
  { re: /hernia|हर्निया/i, id: 'hernia-repair' },
  { re: /fracture|plaster|फ्रैक्चर/i, id: 'fracture-minor' },
  { re: /dengue|डेंगू/i, id: 'dengue-admit' },
  { re: /typhoid|टाइफाइड/i, id: 'typhoid' },
  { re: /knee replacement|घुटना/i, id: 'knee-replacement' },
  { re: /chemo|cancer|कैमो|कैंसर/i, id: 'chemotherapy' },
];

export async function getEstimatedCosts(text: string, lang: Lang): Promise<ToolResult<CostToolResult[]>> {
  const matches = TREATMENT_ALIASES.filter((a) => a.re.test(text)).map((a) => a.id);
  const unique = [...new Set(matches)];
  const treatments =
    unique.length > 0 ? TREATMENTS.filter((t) => unique.includes(t.id)) : TREATMENTS.filter((t) => t.id === 'general-consultation');

  if (treatments.length === 0) {
    return { ok: false, data: null, error: 'No published tariff range matches that procedure in JeevanSetu.' };
  }

  const results: CostToolResult[] = treatments.slice(0, 3).map((t) => {
    const est = estimateTreatment(
      t,
      {
        treatmentId: t.id,
        includedTests: t.tests.map((_, i) => i),
        stayDays: t.roomPerDay ? Math.max(1, t.typicalStayDays[0]) : 0,
        roomType: 'general',
      },
      lang,
    );
    return {
      treatmentId: t.id,
      treatmentName: lang === 'hi' && t.hindiName ? t.hindiName : t.name,
      govtRange: formatRange(est.govtTotal[0], est.govtTotal[1]),
      privateRange: formatRange(est.privateTotal[0], est.privateTotal[1]),
      sourceNote: t.sourceNote,
      note: t.note ?? null,
    };
  });

  return { ok: true, data: results, error: null };
}

/**
 * calculateDrivingRoute — THE tool for "how far is X from me".
 * Requires a real origin; without one it reports `needsOrigin` instead of
 * guessing a city.
 */
export async function calculateDrivingRoute(
  hospitalId: string,
  origin: OriginInput | null,
): Promise<ToolResult<{ hospital: AssistantHospital; alternatives: number; geometryPoints: number; navigateUrl: string | null }>> {
  if (!origin) {
    return { ok: false, data: null, error: 'No starting location has been shared yet.', needsOrigin: true };
  }
  const h = getHospitalById(hospitalId);
  if (!h) return { ok: false, data: null, error: 'Hospital not found.' };

  const detail = await getRouteDetail({ origin: { lat: origin.lat, lng: origin.lng }, hospital: h });
  if (detail.distanceKm === null) {
    return { ok: false, data: null, error: detail.error ?? 'Google returned no driving route.' };
  }

  const leg: TravelLeg = {
    hospitalId: h.id,
    distanceKm: detail.distanceKm,
    distanceMeters: detail.distanceMeters,
    etaMinutes: detail.etaMinutes,
    staticMinutes: detail.staticMinutes,
    trafficImpactMinutes: detail.trafficImpactMinutes,
    straightKm: detail.straightKm,
    source: detail.source,
    computedAt: detail.computedAt,
    error: null,
    disclosure: detail.disclosure,
  };

  const hospital = toAssistantHospital(h.id, leg);
  if (!hospital) return { ok: false, data: null, error: 'Hospital lookup failed.' };

  return {
    ok: true,
    data: {
      hospital,
      alternatives: detail.alternatives.length,
      geometryPoints: detail.geometry.length,
      navigateUrl: detail.navigateUrl,
    },
    error: null,
  };
}

/** Tool catalogue surfaced to the UI / logs so behaviour stays auditable. */
export const TOOL_CATALOGUE = [
  'searchHospitals',
  'getHospitalDetails',
  'getCurrentLocation',
  'calculateDrivingRoute',
  'compareHospitals',
  'getHospitalRatings',
  'getEstimatedCosts',
  'getEmergencyHospitals',
] as const;

export type ToolName = (typeof TOOL_CATALOGUE)[number];
