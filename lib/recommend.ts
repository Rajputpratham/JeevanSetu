import { Hospital } from '@/data/types';
import { haversineKm } from './geo';

export interface RecommendInput {
  speciality: string;
  /** 'any' | 'government' | 'private' */
  typePreference: 'any' | 'government' | 'private';
  /** 'any' | 'low' | 'medium' | 'high' — rough budget band for the episode of care */
  budget: 'any' | 'low' | 'medium' | 'high';
  facilitiesWanted: string[];
  lat: number;
  lng: number;
}

export interface RecommendationResult {
  hospital: Hospital;
  distanceKm: number;
  score: number;
  reasons: string[];
  cautions: string[];
}

const COST_RANK: Record<Hospital['costProfile'], number> = {
  'very-low': 0,
  low: 1,
  moderate: 2,
  high: 3,
};

/**
 * Deterministic, explainable scoring — no black-box model, no fabricated
 * "accuracy" claims. Weights favour (1) having the needed speciality,
 * (2) affordability, (3) accessibility and (4) supporting facilities.
 */
export function recommendHospitals(all: Hospital[], input: RecommendInput): RecommendationResult[] {
  const results: RecommendationResult[] = [];

  for (const h of all) {
    const reasons: string[] = [];
    const cautions: string[] = [];
    let score = 0;

    // 1. Speciality match — required.
    const exact = h.specialities.includes(input.speciality);
    if (exact) {
      score += 45;
      reasons.push(`Has a ${input.speciality} department`);
    } else {
      // Never recommend a hospital that lacks the speciality as a "match".
      continue;
    }

    const distanceKm = haversineKm(input.lat, input.lng, h.lat, h.lng);

    // 2. Distance (graduated, not dominant).
    if (distanceKm <= 5) { score += 25; reasons.push(`Only ${distanceKm.toFixed(1)} km away — very accessible`); }
    else if (distanceKm <= 15) { score += 20; reasons.push(`${distanceKm.toFixed(1)} km away — reasonably close`); }
    else if (distanceKm <= 30) { score += 12; reasons.push(`${distanceKm.toFixed(1)} km away`); }
    else if (distanceKm <= 75) { score += 5; }
    else { cautions.push(`Far from you (${Math.round(distanceKm)} km) — consider nearer options unless the speciality is unavailable locally`); }

    // 3. Type preference.
    if (input.typePreference !== 'any') {
      if (h.type === input.typePreference) {
        score += 12;
        reasons.push(h.type === 'government' ? 'Government hospital — much lower charges' : 'Private hospital — shorter waits, more amenities');
      } else {
        score -= 8;
        cautions.push(h.type === 'government' ? 'Government hospital — OPD queues can be long' : 'Private hospital — higher charges');
      }
    } else {
      score += 4; // neutral preference
    }

    // 4. Affordability vs budget.
    const rank = COST_RANK[h.costProfile];
    if (input.budget === 'low') {
      if (rank <= 1) { score += 15; reasons.push('Very affordable — government/subsidised rates'); }
      else if (rank === 2) { score += 4; cautions.push('Costs may stretch a tight budget — ask for an estimate in writing'); }
      else { score -= 12; cautions.push('Likely expensive for a tight budget'); }
    } else if (input.budget === 'medium') {
      if (rank <= 2) { score += 10; reasons.push('Moderate, predictable costs'); }
      else { score += 2; cautions.push('High-end private pricing — confirm estimate before admission'); }
    } else if (input.budget === 'high' || input.budget === 'any') {
      score += 6;
    }

    // 5. Wanted facilities.
    for (const want of input.facilitiesWanted) {
      if (h.facilities.includes(want)) {
        score += 6;
        reasons.push(`Listed facility: ${want}`);
      }
    }

    // 6. Emergency-capable bonus (helps families planning for complications).
    if (h.emergency === 'verified') {
      score += 5;
      reasons.push('Verified 24×7 emergency care on site');
    } else if (h.emergency === 'unverified') {
      cautions.push('Emergency services listed but not verified — call before relying on them');
    }

    // 7. Government availability is a genuine affordability signal.
    if (h.type === 'government' && input.budget !== 'high') {
      score += 3;
    }

    results.push({ hospital: h, distanceKm, score, reasons, cautions });
  }

  return results.sort((a, b) => b.score - a.score).slice(0, 6);
}

/** Map a free-text health problem to a speciality (keyword based, transparent). */
const PROBLEM_KEYWORDS: { pattern: RegExp; speciality: string }[] = [
  { pattern: /heart|chest pain|bp|blood pressure|cardiac|angina/i, speciality: 'Cardiology' },
  { pattern: /pregnan|delivery|maternity|gynaec|period|gyn/i, speciality: 'Gynaecology & Obstetrics' },
  { pattern: /child|kid|baby|paediatric|pediatric|infant/i, speciality: 'Paediatrics' },
  { pattern: /eye|vision|cataract|spectacles|retina/i, speciality: 'Ophthalmology' },
  { pattern: /bone|fracture|joint|knee|hip|ortho|sprain|back pain/i, speciality: 'Orthopaedics' },
  { pattern: /cancer|tumour|tumor|oncolog|chemo/i, speciality: 'Oncology' },
  { pattern: /kidney|dialysis|renal|urine/i, speciality: 'Nephrology' },
  { pattern: /stomach|digestion|acidity|liver|gastro|appendix/i, speciality: 'Gastroenterology' },
  { pattern: /skin|rash|acne|allergy|dermat/i, speciality: 'Dermatology' },
  { pattern: /mind|depression|anxiety|mental|sleep|stress/i, speciality: 'Psychiatry' },
  { pattern: /sugar|diabetes|thyroid|hormone/i, speciality: 'Endocrinology' },
  { pattern: /ear|nose|throat|sinus|tonsil|ent/i, speciality: 'ENT' },
  { pattern: /breath|asthma|lung|cough|pneumonia|tb/i, speciality: 'Pulmonology' },
  { pattern: /brain|stroke|seizure|paralysis|neuro/i, speciality: 'Neurology' },
  { pattern: /tooth|teeth|dental|dentist/i, speciality: 'Dental' },
  { pattern: /burn|scald/i, speciality: 'Burn & Plastic Surgery' },
  { pattern: /urine|prostate|stone.*urine|urolog/i, speciality: 'Urology' },
  { pattern: /fever|infection|weakness|general|checkup|check-up/i, speciality: 'General Medicine' },
  { pattern: /surgery|operation|hernia|append/i, speciality: 'General Surgery' },
];

export function specialityForProblem(text: string): string | null {
  const t = text.trim();
  if (!t) return null;
  for (const { pattern, speciality } of PROBLEM_KEYWORDS) {
    if (pattern.test(t)) return speciality;
  }
  return null;
}
