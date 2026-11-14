import { Hospital } from '@/data/types';
import { estimateTravelMetrics } from './geo';
import { tFacility, tSpeciality } from './i18n-data';
import type { Lang } from './lang-meta';

export interface RecommendInput {
  speciality: string;
  /** 'any' | 'government' | 'private' */
  typePreference: 'any' | 'government' | 'private';
  /** 'any' | 'low' | 'medium' | 'high' — rough budget band for the episode of care */
  budget: 'any' | 'low' | 'medium' | 'high';
  facilitiesWanted: string[];
  lat: number;
  lng: number;
  lang?: Lang;
}

export interface RecommendationResult {
  hospital: Hospital;
  distanceKm: number;
  roadKm: number;
  etaMinutes: number;
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
  const lang = input.lang ?? 'en';
  const hi = lang === 'hi';
  const specLabel = tSpeciality(input.speciality, lang);

  for (const h of all) {
    const reasons: string[] = [];
    const cautions: string[] = [];
    let score = 0;

    // 1. Speciality match — required.
    const exact = h.specialities.includes(input.speciality);
    if (exact) {
      score += 45;
      reasons.push(hi ? `यहां ${specLabel} विभाग उपलब्ध है` : `Has a ${input.speciality} department`);
    } else {
      // Never recommend a hospital that lacks the speciality as a "match".
      continue;
    }

    const travel = estimateTravelMetrics(input.lat, input.lng, h.lat, h.lng);
    const distanceKm = travel.roadKm;
    const roadKm = travel.roadKm;
    const etaMinutes = travel.trafficMinutes;

    // 2. Distance (graduated, not dominant).
    if (distanceKm <= 5) {
      score += 25;
      reasons.push(hi ? `केवल ${distanceKm.toFixed(1)} किमी दूर — पहुंचना बहुत आसान` : `Only ${distanceKm.toFixed(1)} km away — very accessible`);
    } else if (distanceKm <= 15) {
      score += 20;
      reasons.push(hi ? `${distanceKm.toFixed(1)} किमी दूर — अपेक्षाकृत नज़दीक` : `${distanceKm.toFixed(1)} km away — reasonably close`);
    } else if (distanceKm <= 30) {
      score += 12;
      reasons.push(hi ? `${distanceKm.toFixed(1)} किमी दूर` : `${distanceKm.toFixed(1)} km away`);
    } else if (distanceKm <= 75) {
      score += 5;
    } else {
      cautions.push(
        hi
          ? `आपसे काफ़ी दूर (${Math.round(distanceKm)} किमी) — जब तक यह विशेषता पास में न मिले, नज़दीकी विकल्प भी देखें`
          : `Far from you (${Math.round(distanceKm)} km) — consider nearer options unless the speciality is unavailable locally`,
      );
    }

    // 3. Type preference.
    if (input.typePreference !== 'any') {
      if (h.type === input.typePreference) {
        score += 12;
        reasons.push(
          h.type === 'government'
            ? hi ? 'सरकारी अस्पताल — बहुत कम शुल्क' : 'Government hospital — much lower charges'
            : hi ? 'निजी अस्पताल — कम प्रतीक्षा समय, अधिक सुविधाएं' : 'Private hospital — shorter waits, more amenities',
        );
      } else {
        score -= 8;
        cautions.push(
          h.type === 'government'
            ? hi ? 'सरकारी अस्पताल — OPD की कतार लंबी हो सकती है' : 'Government hospital — OPD queues can be long'
            : hi ? 'निजी अस्पताल — शुल्क अधिक हो सकते हैं' : 'Private hospital — higher charges',
        );
      }
    } else {
      score += 4; // neutral preference
    }

    // 4. Affordability vs budget.
    const rank = COST_RANK[h.costProfile];
    if (input.budget === 'low') {
      if (rank <= 1) {
        score += 15;
        reasons.push(hi ? 'बहुत किफ़ायती — सरकारी/सब्सिडी वाली दरें' : 'Very affordable — government/subsidised rates');
      } else if (rank === 2) {
        score += 4;
        cautions.push(hi ? 'सीमित बजट पर खर्च भारी पड़ सकता है — लिखित अनुमान ज़रूर मांगें' : 'Costs may stretch a tight budget — ask for an estimate in writing');
      } else {
        score -= 12;
        cautions.push(hi ? 'सीमित बजट के लिए संभवतः महंगा' : 'Likely expensive for a tight budget');
      }
    } else if (input.budget === 'medium') {
      if (rank <= 2) {
        score += 10;
        reasons.push(hi ? 'मध्यम और अनुमानित खर्च' : 'Moderate, predictable costs');
      } else {
        score += 2;
        cautions.push(hi ? 'उच्च श्रेणी निजी दरें — भर्ती से पहले खर्च अनुमान की पुष्टि करें' : 'High-end private pricing — confirm estimate before admission');
      }
    } else if (input.budget === 'high' || input.budget === 'any') {
      score += 6;
    }

    // 5. Wanted facilities.
    for (const want of input.facilitiesWanted) {
      if (h.facilities.includes(want)) {
        score += 6;
        reasons.push(hi ? `सूचीबद्ध सुविधा: ${tFacility(want, lang)}` : `Listed facility: ${want}`);
      }
    }

    // 6. Emergency-capable bonus (helps families planning for complications).
    if (h.emergency === 'verified') {
      score += 5;
      reasons.push(hi ? 'परिसर में सत्यापित 24×7 आपातकालीन देखभाल' : 'Verified 24×7 emergency care on site');
    } else if (h.emergency === 'unverified') {
      cautions.push(
        hi
          ? 'आपातकालीन सेवा सूचीबद्ध है पर सत्यापित नहीं — भरोसे से पहले फ़ोन करें'
          : 'Emergency services listed but not verified — call before relying on them',
      );
    }

    // 7. Government availability is a genuine affordability signal.
    if (h.type === 'government' && input.budget !== 'high') {
      score += 3;
    }

    results.push({ hospital: h, distanceKm, roadKm, etaMinutes, score, reasons, cautions });
  }

  return results.sort((a, b) => b.score - a.score).slice(0, 6);
}

/** Map a free-text health problem to a speciality (keyword based, transparent). */
const PROBLEM_KEYWORDS: { pattern: RegExp; speciality: string }[] = [
  { pattern: /heart|chest pain|bp|blood pressure|cardiac|angina|दिल|हृदय|सीने|बीपी|ब्लड प्रेशर/i, speciality: 'Cardiology' },
  { pattern: /pregnan|delivery|maternity|gynaec|period|gyn|गर्भ|प्रसव|डिलीवरी|मासिक|स्त्री/i, speciality: 'Gynaecology & Obstetrics' },
  { pattern: /child|kid|baby|paediatric|pediatric|infant|बच्च|शिशु|बाल/i, speciality: 'Paediatrics' },
  { pattern: /eye|vision|cataract|spectacles|retina|आंख|नेत्र|मोतियाबिंद|दृष्टि/i, speciality: 'Ophthalmology' },
  { pattern: /bone|fracture|joint|knee|hip|ortho|sprain|back pain|हड्डी|फ्रैक्चर|जोड़|घुटने|कमर/i, speciality: 'Orthopaedics' },
  { pattern: /cancer|tumour|tumor|oncolog|chemo|कैंसर|ट्यूमर|कीमो/i, speciality: 'Oncology' },
  { pattern: /kidney|dialysis|renal|किडनी|गुर्दा|डायलिसिस/i, speciality: 'Nephrology' },
  { pattern: /stomach|digestion|acidity|liver|gastro|appendix|पेट|पाचन|लिवर|एसिडिटी|अपेंडिक्स/i, speciality: 'Gastroenterology' },
  { pattern: /skin|rash|acne|allergy|dermat|त्वचा|चर्म|खुजली|एलर्जी/i, speciality: 'Dermatology' },
  { pattern: /mind|depression|anxiety|mental|sleep|stress|मन|मानसिक|तनाव|अवसाद|नींद/i, speciality: 'Psychiatry' },
  { pattern: /sugar|diabetes|thyroid|hormone|शुगर|मधुमेह|डायबिटीज|थायरॉइड/i, speciality: 'Endocrinology' },
  { pattern: /ear|nose|throat|sinus|tonsil|ent|कान|नाक|गला|टॉन्सिल/i, speciality: 'ENT' },
  { pattern: /breath|asthma|lung|cough|pneumonia|tb|सांस|दमा|फेफड़े|खांसी|निमोनिया/i, speciality: 'Pulmonology' },
  { pattern: /brain|stroke|seizure|paralysis|neuro|दिमाग|मस्तिष्क|स्ट्रोक|दौरा|लकवा/i, speciality: 'Neurology' },
  { pattern: /tooth|teeth|dental|dentist|दांत|दंत/i, speciality: 'Dental' },
  { pattern: /burn|scald|जलन|आग|झुलस/i, speciality: 'Burn & Plastic Surgery' },
  { pattern: /urine|prostate|stone.*urine|urolog|पेशाब|मूत्र|प्रोस्टेट|पथरी/i, speciality: 'Urology' },
  { pattern: /fever|infection|weakness|general|checkup|check-up|बुखार|संक्रमण|कमजोरी|जांच/i, speciality: 'General Medicine' },
  { pattern: /surgery|operation|hernia|append|सर्जरी|ऑपरेशन|हर्निया/i, speciality: 'General Surgery' },
];

export function specialityForProblem(text: string): string | null {
  const t = text.trim();
  if (!t) return null;
  for (const { pattern, speciality } of PROBLEM_KEYWORDS) {
    if (pattern.test(t)) return speciality;
  }
  return null;
}
