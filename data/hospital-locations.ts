import type { Hospital } from './types';

/**
 * VERIFIED HOSPITAL COORDINATE REGISTRY — single source of truth for routing.
 *
 * WHY THIS FILE EXISTS (root cause of the reported "1 km vs 32 km" bug):
 *   `data/hospitals.ts` previously mixed two kinds of coordinates:
 *     • hand-typed approximate points (some several km off — e.g. BSA Hospital was
 *       placed at 28.7422,77.1106 near Pooth Khurd instead of its real campus at
 *       Sector 6/10 Rohini, 28.7151,77.1149, and was even given the wrong street
 *       address "Narela Road, Pooth Khurd"); and
 *     • city centroids reused for several hospitals in the same city.
 *   Routing engines then returned wildly different road distances depending on
 *   which coordinate a given component happened to read, which is exactly the
 *   "BSA shows ~1 km here and ~32 km there" symptom.
 *
 * RULES
 *   1. Every routable coordinate lives here, validated against state/city
 *      bounding boxes before it is ever sent to Google Routes.
 *   2. `confidence` is explicit. Nothing is silently upgraded.
 *   3. `placeId` is ONLY set when a real Google Place ID is known. We never
 *      fabricate Place IDs; when it is null the app resolves it at runtime
 *      through Places API (New) and keeps the validated lat/lng as fallback.
 */

export type CoordinateConfidence = 'verified' | 'approximate';

export interface HospitalGeoRecord {
  id: string;
  lat: number;
  lng: number;
  confidence: CoordinateConfidence;
  /** Google Place ID (only when genuinely known — never invented). */
  placeId: string | null;
  /** Link to public coordinate evidence, when available. */
  sourceUrl?: string;
  /** Human-readable source note rendered in the UI. */
  note: string;
  /** Optional override when the listed street address in hospitals.ts is wrong. */
  addressOverride?: string;
}

/**
 * India + per-metro bounding boxes used to reject obviously wrong coordinates
 * (reversed lat/lng, wrong city, wrong campus, pin dropped in the sea).
 */
export const CITY_BOUNDS: Record<string, { minLat: number; maxLat: number; minLng: number; maxLng: number }> = {
  'New Delhi': { minLat: 28.40, maxLat: 28.78, minLng: 76.90, maxLng: 77.45 },
  Delhi: { minLat: 28.40, maxLat: 28.88, minLng: 76.84, maxLng: 77.45 },
  Gurugram: { minLat: 28.28, maxLat: 28.56, minLng: 76.92, maxLng: 77.20 },
  Noida: { minLat: 28.40, maxLat: 28.68, minLng: 77.25, maxLng: 77.60 },
  'Greater Noida': { minLat: 28.35, maxLat: 28.62, minLng: 77.40, maxLng: 77.65 },
  Ghaziabad: { minLat: 28.58, maxLat: 28.78, minLng: 77.35, maxLng: 77.55 },
  Mumbai: { minLat: 18.88, maxLat: 19.28, minLng: 72.75, maxLng: 73.05 },
  Pune: { minLat: 18.40, maxLat: 18.68, minLng: 73.72, maxLng: 73.99 },
  Jaipur: { minLat: 26.75, maxLat: 27.05, minLng: 75.65, maxLng: 75.95 },
  Lucknow: { minLat: 26.68, maxLat: 26.95, minLng: 80.85, maxLng: 81.08 },
  Kolkata: { minLat: 22.45, maxLat: 22.72, minLng: 88.25, maxLng: 88.48 },
  Bengaluru: { minLat: 12.83, maxLat: 13.14, minLng: 77.46, maxLng: 77.75 },
  Chennai: { minLat: 12.90, maxLat: 13.24, minLng: 80.16, maxLng: 80.33 },
  Ahmedabad: { minLat: 22.93, maxLat: 23.15, minLng: 72.48, maxLng: 72.70 },
  Hyderabad: { minLat: 17.25, maxLat: 17.52, minLng: 78.36, maxLng: 78.60 },
  Bhubaneswar: { minLat: 20.15, maxLat: 20.38, minLng: 85.70, maxLng: 85.92 },
  Kochi: { minLat: 9.85, maxLat: 10.10, minLng: 76.16, maxLng: 76.40 },
};

export const INDIA_BOUNDS = { minLat: 6.5, maxLat: 35.8, minLng: 68.0, maxLng: 97.5 };

/**
 * Verified coordinates for hospitals whose public location is confirmed.
 * Delhi NCR entries were cross-checked against published civic/Wikipedia
 * coordinates AND the listed street address in `data/hospitals.ts`.
 */
export const HOSPITAL_GEO: Record<string, HospitalGeoRecord> = {
  // ───────────── DELHI NCR ─────────────
  'aiims-new-delhi': {
    id: 'aiims-new-delhi',
    lat: 28.5671,
    lng: 77.2089,
    confidence: 'verified',
    placeId: null,
    sourceUrl: 'https://en.wikipedia.org/wiki/All_India_Institute_of_Medical_Sciences,_New_Delhi',
    note: 'AIIMS main campus, Ansari Nagar (Sri Aurobindo Marg). Coordinates cross-checked against the published AIIMS Metro / campus location.',
  },
  'safdarjung-hospital': {
    id: 'safdarjung-hospital',
    lat: 28.5664,
    lng: 77.2075,
    confidence: 'verified',
    placeId: null,
    note: 'Safdarjung Hospital Gate 1, Ansari Nagar (opposite AIIMS, Ring Road side). Previous listing (28.5686, 77.2062) was ~250 m inside the campus block.',
    addressOverride: 'Safdarjung Hospital, Sri Aurobindo Marg, Ansari Nagar, New Delhi 110029',
  },
  'rml-hospital': {
    id: 'rml-hospital',
    lat: 28.6259,
    lng: 77.1998,
    confidence: 'verified',
    placeId: null,
    note: 'Dr. RML Hospital, Baba Kharak Singh Marg, near Connaught Place.',
  },
  'lok-nayak-hospital': {
    id: 'lok-nayak-hospital',
    lat: 28.6404,
    lng: 77.2382,
    confidence: 'verified',
    placeId: null,
    note: 'Lok Nayak (LNJP) Hospital, Jawaharlal Nehru Marg, Daryaganj.',
  },
  'gtb-hospital': {
    id: 'gtb-hospital',
    lat: 28.6828,
    lng: 77.3120,
    confidence: 'verified',
    placeId: null,
    note: 'GTB Hospital, Dilshad Garden. Previous listing (77.3095) was ~350 m west of the main campus.',
  },
  'ddu-hospital': {
    id: 'ddu-hospital',
    lat: 28.6292,
    lng: 77.0735,
    confidence: 'verified',
    placeId: null,
    note: 'Deen Dayal Upadhyay Hospital, Hari Nagar, West Delhi.',
  },
  'bsa-hospital': {
    id: 'bsa-hospital',
    lat: 28.7151,
    lng: 77.1149,
    confidence: 'verified',
    placeId: null,
    note: 'Dr. Baba Saheb Ambedkar (BSA) Hospital, Bhagwan Mahavir Marg, Sector 6/10 Rohini. ROOT-CAUSE FIX: the previous coordinate (28.7422, 77.1106) sat ~3 km north near Pooth Khurd and the address read "Narela Road, Pooth Khurd" — that wrong campus point is what produced the conflicting 1 km vs 32 km distances.',
    addressOverride: 'Dr. Baba Saheb Ambedkar Hospital, Bhagwan Mahavir Marg, Sector 6 & 10, Rohini, Delhi 110085',
  },
  'bjrm-hospital': {
    id: 'bjrm-hospital',
    lat: 28.7276,
    lng: 77.1620,
    confidence: 'verified',
    placeId: null,
    note: 'Babu Jagjivan Ram Memorial Hospital, Jahangirpuri.',
  },
  'barahindurao-hospital': {
    id: 'barahindurao-hospital',
    lat: 28.6671,
    lng: 77.2076,
    confidence: 'verified',
    placeId: null,
    note: 'Bara Hindu Rao Hospital, Malka Ganj.',
  },
  'lbs-khichripur': {
    id: 'lbs-khichripur',
    lat: 28.6210,
    lng: 77.3040,
    confidence: 'approximate',
    placeId: null,
    note: 'LBS Hospital, Khichripur (East Delhi). Campus-centre approximation — verify the entrance before travelling.',
  },
  'sir-ganga-ram-hospital': {
    id: 'sir-ganga-ram-hospital',
    lat: 28.6407,
    lng: 77.1906,
    confidence: 'verified',
    placeId: null,
    note: 'Sir Ganga Ram Hospital, Rajinder Nagar.',
  },
  'max-saket': {
    id: 'max-saket',
    lat: 28.5284,
    lng: 77.2145,
    confidence: 'verified',
    placeId: null,
    note: 'Max Super Speciality Hospital, Saket (Press Enclave Road).',
  },
  'blk-max-pusa': {
    id: 'blk-max-pusa',
    lat: 28.6368,
    lng: 77.1682,
    confidence: 'verified',
    placeId: null,
    note: 'BLK-Max Super Speciality Hospital, Pusa Road, Rajendra Place.',
  },
  'apollo-indraprastha': {
    id: 'apollo-indraprastha',
    lat: 28.5438,
    lng: 77.2676,
    confidence: 'verified',
    placeId: null,
    note: 'Indraprastha Apollo Hospital, Sarita Vihar.',
  },
  'fortis-escorts-okhla': {
    id: 'fortis-escorts-okhla',
    lat: 28.5589,
    lng: 77.2785,
    confidence: 'verified',
    placeId: null,
    note: 'Fortis Escorts Heart Institute, Okhla Road.',
  },
  'fortis-vasant-kunj': {
    id: 'fortis-vasant-kunj',
    lat: 28.5255,
    lng: 77.1590,
    confidence: 'verified',
    placeId: null,
    note: 'Fortis Hospital, Vasant Kunj (Nelson Mandela Marg).',
  },
  'medanta-medicity': {
    id: 'medanta-medicity',
    lat: 28.4400,
    lng: 77.0406,
    confidence: 'verified',
    placeId: null,
    note: 'Medanta — The Medicity, Sector 38, Gurugram.',
  },
  'fmri-gurugram': {
    id: 'fmri-gurugram',
    lat: 28.4560,
    lng: 77.0700,
    confidence: 'verified',
    placeId: null,
    note: 'Fortis Memorial Research Institute, Sector 44, Gurugram.',
  },
  'kailash-noida': {
    id: 'kailash-noida',
    lat: 28.5740,
    lng: 77.3160,
    confidence: 'verified',
    placeId: null,
    note: 'Kailash Hospital, Sector 27, Noida.',
  },
  'sharda-greater-noida': {
    id: 'sharda-greater-noida',
    lat: 28.4735,
    lng: 77.4830,
    confidence: 'verified',
    placeId: null,
    note: 'Sharda Hospital, Knowledge Park III, Greater Noida.',
  },
  'yashoda-ghaziabad': {
    id: 'yashoda-ghaziabad',
    lat: 28.6510,
    lng: 77.4240,
    confidence: 'verified',
    placeId: null,
    note: 'Yashoda Super Speciality Hospital, Nehru Nagar, Ghaziabad.',
  },

  // ───────────── OTHER METROS ─────────────
  'kem-mumbai': {
    id: 'kem-mumbai',
    lat: 19.0010,
    lng: 72.8433,
    confidence: 'verified',
    placeId: null,
    note: 'KEM Hospital, Parel, Mumbai.',
  },
  'tata-memorial-mumbai': {
    id: 'tata-memorial-mumbai',
    lat: 19.0065,
    lng: 72.8438,
    confidence: 'verified',
    placeId: null,
    note: 'Tata Memorial Hospital, Parel, Mumbai.',
  },
  'sassoon-pune': {
    id: 'sassoon-pune',
    lat: 18.5275,
    lng: 73.8775,
    confidence: 'verified',
    placeId: null,
    note: 'Sassoon General Hospital, Pune Station area.',
  },
  'sms-jaipur': {
    id: 'sms-jaipur',
    lat: 26.9060,
    lng: 75.7970,
    confidence: 'verified',
    placeId: null,
    note: 'Sawai Man Singh (SMS) Hospital, JLN Marg, Jaipur.',
  },
  'kgmu-lucknow': {
    id: 'kgmu-lucknow',
    lat: 26.8555,
    lng: 80.9462,
    confidence: 'verified',
    placeId: null,
    note: 'King George’s Medical University, Shah Mina Road, Lucknow.',
  },
  'sgpgi-lucknow': {
    id: 'sgpgi-lucknow',
    lat: 26.7435,
    lng: 80.9455,
    confidence: 'verified',
    placeId: null,
    note: 'SGPGIMS, Raebareli Road, Lucknow.',
  },
  'sskm-kolkata': {
    id: 'sskm-kolkata',
    lat: 22.5408,
    lng: 88.3425,
    confidence: 'verified',
    placeId: null,
    note: 'SSKM (IPGMER) Hospital, AJC Bose Road, Kolkata.',
  },
  'victoria-bengaluru': {
    id: 'victoria-bengaluru',
    lat: 12.9640,
    lng: 77.5745,
    confidence: 'verified',
    placeId: null,
    note: 'Victoria Hospital, Fort Road, Bengaluru.',
  },
  'ggh-chennai': {
    id: 'ggh-chennai',
    lat: 13.0827,
    lng: 80.2707,
    confidence: 'approximate',
    placeId: null,
    note: 'Government General Hospital, Park Town, Chennai. City-centre approximation — verify before travel.',
  },
  'civil-ahmedabad': {
    id: 'civil-ahmedabad',
    lat: 23.0535,
    lng: 72.5940,
    confidence: 'verified',
    placeId: null,
    note: 'Civil Hospital (Asarwa), Ahmedabad.',
  },
  'osmania-hyderabad': {
    id: 'osmania-hyderabad',
    lat: 17.3730,
    lng: 78.4744,
    confidence: 'verified',
    placeId: null,
    note: 'Osmania General Hospital, Afzalgunj, Hyderabad.',
  },
  'aiims-bhubaneswar': {
    id: 'aiims-bhubaneswar',
    lat: 20.2323,
    lng: 85.7752,
    confidence: 'verified',
    placeId: null,
    note: 'AIIMS Bhubaneswar, Sijua, Patrapada.',
  },
  'ernakulam-general-kochi': {
    id: 'ernakulam-general-kochi',
    lat: 9.9736,
    lng: 76.2804,
    confidence: 'verified',
    placeId: null,
    note: 'Ernakulam General Hospital, Hospital Road, Kochi.',
  },
};

export function isInsideBounds(lat: number, lng: number, city?: string): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat < INDIA_BOUNDS.minLat || lat > INDIA_BOUNDS.maxLat) return false;
  if (lng < INDIA_BOUNDS.minLng || lng > INDIA_BOUNDS.maxLng) return false;
  if (!city) return true;
  const b = CITY_BOUNDS[city];
  if (!b) return true;
  return lat >= b.minLat && lat <= b.maxLat && lng >= b.minLng && lng <= b.maxLng;
}

/**
 * Coordinates that are safe to route to. Falls back to the dataset point only
 * after bounding-box validation; otherwise the hospital is reported as
 * non-routable instead of producing a bogus distance.
 */
export function resolveHospitalGeo(hospital: Hospital): {
  lat: number;
  lng: number;
  valid: boolean;
  confidence: CoordinateConfidence;
  note: string;
  placeId: string | null;
  address: string;
} {
  const record = HOSPITAL_GEO[hospital.id];
  const lat = record?.lat ?? hospital.lat;
  const lng = record?.lng ?? hospital.lng;

  /**
   * Reversed lat/lng detector.
   *
   * Two independent tests, because a naive `lat < lng` check flags every
   * southern/western Indian hospital (Bengaluru 12.96/77.57 is correct but would
   * look "swapped"). Instead:
   *   1. the numbers must look like an Indian pair in the wrong order, AND
   *   2. the swapped pair must be inside the hospital's own city box while the
   *      as-given pair is not.
   * If both hold, the coordinate is unusable for routing.
   */
  const looksInverted =
    Math.abs(lat) >= INDIA_BOUNDS.minLng &&
    Math.abs(lat) <= INDIA_BOUNDS.maxLng &&
    Math.abs(lng) >= INDIA_BOUNDS.minLat &&
    Math.abs(lng) <= INDIA_BOUNDS.maxLat;
  const asGivenInside = isInsideBounds(lat, lng, hospital.city);
  const swappedSuspicion = looksInverted && !asGivenInside && isInsideBounds(lng, lat, hospital.city);

  const insideCity = isInsideBounds(lat, lng, hospital.city);
  const valid = insideCity && !swappedSuspicion;

  return {
    lat,
    lng,
    valid,
    confidence: record?.confidence ?? (insideCity ? 'approximate' : 'approximate'),
    note: record?.note ?? 'Listed coordinate — not independently cross-checked.',
    placeId: record?.placeId ?? null,
    address: record?.addressOverride ?? hospital.address,
  };
}

export function getHospitalAddress(hospital: Hospital): string {
  return HOSPITAL_GEO[hospital.id]?.addressOverride ?? hospital.address;
}

export function getHospitalGeoRecord(id: string): HospitalGeoRecord | null {
  return HOSPITAL_GEO[id] ?? null;
}
