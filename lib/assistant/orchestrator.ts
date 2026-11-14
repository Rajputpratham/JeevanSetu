/**
 * JeevanSetu AI Assistant — conversation orchestrator.
 *
 * Flow for every turn:
 *   1. classify intent (deterministic, gated)
 *   2. run only the tools that intent allows
 *   3. build grounding payload
 *   4. ask Gemini to phrase the answer
 *   5. if Gemini is unavailable/blocked → a complete deterministic answer that
 *      still uses the real tool data (never a fabricated one)
 *
 * This ordering is what makes requirement 10.10 and 7 ("do not call
 * hospital-search tools for a simple greeting") structural rather than
 * prompt-dependent: the model is never even shown hospital data for a greeting.
 */

import type { Lang } from '@/lib/lang-meta';
import { formatDrivingKm, formatDuration } from '@/lib/geo';
import { classifyIntent, cityFromMessage, type IntentResult } from './intent';
import { assistantCopy, timeOfDayGreeting, type AssistantCopy } from './strings';
import { buildSystemInstruction, type GroundingPayload } from './prompt';
import { geminiApiKey, geminiGenerate } from './gemini';
import {
  calculateDrivingRoute,
  compareHospitals,
  getEmergencyHospitals,
  getEstimatedCosts,
  getHospitalDetails,
  getHospitalRatings,
  resolveHospitalReference,
  searchHospitals,
  type AssistantHospital,
  type OriginInput,
} from './tools';

export interface AssistantRequest {
  message: string;
  lang: Lang;
  origin: OriginInput | null;
  history: { role: 'user' | 'assistant'; text: string }[];
  focusedHospitalId?: string | null;
  /** Local IST hour, used for time-of-day greetings. */
  istHour?: number;
  /** Injected for deterministic tests. */
  now?: Date;
}

export interface AssistantResponse {
  reply: string;
  intent: string;
  intentConfidence: number;
  hospitals: AssistantHospital[];
  comparison: { label: string; aValue: string; bValue: string; comparable: boolean }[] | null;
  costs: { treatmentName: string; govtRange: string; privateRange: string }[] | null;
  /** What the assistant wants the UI to do next (all opt-in, never automatic). */
  actions: AssistantAction[];
  groundingMode: 'gemini-grounded' | 'deterministic-grounded';
  model: string | null;
  toolsRun: string[];
  blockers: string[];
  routeSource: string | null;
  emergency: boolean;
  disclaimer: string;
  originUsed: string | null;
  diagnostics: { signals: string[]; geminiStatus: string | null; latencyMs: number };
}

export type AssistantAction =
  | { type: 'request-location'; reason: string }
  | { type: 'open-hospitals'; ids: string[] }
  | { type: 'open-compare'; ids: string[] }
  | { type: 'open-emergency' }
  | { type: 'open-hospital'; id: string }
  | { type: 'navigate'; id: string };

const MAX_HOSPITAL_CARDS = 4;

function istHourFrom(date: Date): number {
  return Number(
    new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Asia/Kolkata' }).format(date),
  );
}

export function classifyTurn(message: string, history: AssistantRequest['history'], istHour: number): IntentResult {
  const result = classifyIntent(message, { history, istHour });
  // A language-switch request alone is casual conversation.
  if (result.requestedLanguage && result.intent === 'unknown') {
    return { ...result, intent: 'casual', confidence: 0.8, allowHospitalTools: false, allowLocationPrompt: false };
  }
  return result;
}

export async function runAssistantTurn(req: AssistantRequest): Promise<AssistantResponse> {
  const started = Date.now();
  const copy = assistantCopy(req.lang);
  const istHour = req.istHour ?? istHourFrom(req.now ?? new Date());
  const intent = classifyTurn(req.message, req.history, istHour);

  const hospitals: AssistantHospital[] = [];
  let comparison: AssistantResponse['comparison'] = null;
  let costs: AssistantResponse['costs'] = null;
  const actions: AssistantAction[] = [];
  const toolsRun: string[] = [];
  const blockers: string[] = [];
  let routeSource: string | null = null;

  // ── Tool execution, strictly gated by intent ───────────────────────────────
  if (intent.intent === 'emergency') {
    toolsRun.push('getEmergencyHospitals');
    const res = await getEmergencyHospitals(req.origin, 3);
    if (res.data) hospitals.push(...res.data);
    if (res.needsOrigin) {
      actions.push({ type: 'request-location', reason: 'Nearest emergency hospitals need a starting point.' });
    }
    if (res.error) blockers.push(res.error);
    actions.push({ type: 'open-emergency' });
  } else if (intent.intent === 'hospital_search') {
    toolsRun.push('searchHospitals');
    const typeHint = /government|govt|sarkari|सरकारी|free/i.test(req.message)
      ? 'government'
      : /private|निजी/i.test(req.message)
        ? 'private'
        : 'any';
    const res = await searchHospitals({
      speciality: intent.suggestedSpeciality ?? null,
      type: typeHint,
      limit: MAX_HOSPITAL_CARDS,
      origin: req.origin,
      city: cityFromMessage(req.message),
    });
    if (res.data) hospitals.push(...res.data);
    if (res.needsOrigin) {
      actions.push({ type: 'request-location', reason: 'Hospital distances need your starting point.' });
    }
    if (res.error) blockers.push(res.error);
    if (hospitals.length > 0) actions.push({ type: 'open-hospitals', ids: hospitals.map((h) => h.id) });
    routeSource = hospitals.find((h) => h.travelSource !== 'unavailable')?.travelSource ?? null;
  } else if (intent.intent === 'location_travel') {
    const ids =
      intent.mentionedHospitalTerms.length > 0
        ? intent.mentionedHospitalTerms
        : resolveHospitalReference(req.message);
    const targetId = ids[0] ?? req.focusedHospitalId ?? null;

    if (targetId) {
      toolsRun.push('calculateDrivingRoute');
      const res = await calculateDrivingRoute(targetId, req.origin);
      if (res.data) {
        hospitals.push(res.data.hospital);
        routeSource = res.data.hospital.travelSource;
        actions.push({ type: 'navigate', id: res.data.hospital.id });
      } else if (res.needsOrigin) {
        actions.push({ type: 'request-location', reason: 'A driving distance needs your starting point.' });
      } else if (res.error) {
        blockers.push(res.error);
      }
      if (!res.data) {
        // Distances unknown (no key / no route / no origin), but we can still show
        // the hospital itself with its phone number and address.
        toolsRun.push('getHospitalDetails');
        const details = await getHospitalDetails(targetId, req.origin);
        if (details.data) {
          hospitals.push(details.data.hospital);
          actions.push({ type: 'open-hospital', id: details.data.hospital.id });
        }
      }
    } else {
      toolsRun.push('searchHospitals');
      const res = await searchHospitals({ limit: MAX_HOSPITAL_CARDS, origin: req.origin });
      if (res.data) hospitals.push(...res.data);
      if (res.needsOrigin) actions.push({ type: 'request-location', reason: 'Distances need your starting point.' });
      if (hospitals.length > 0) actions.push({ type: 'open-hospitals', ids: hospitals.map((h) => h.id) });
    }
  } else if (intent.intent === 'hospital_compare') {
    const ids = intent.mentionedHospitalTerms.length >= 2
      ? intent.mentionedHospitalTerms.slice(0, 2)
      : resolveHospitalReference(req.message).slice(0, 2);
    if (ids.length >= 2) {
      toolsRun.push('compareHospitals');
      const res = await compareHospitals([ids[0], ids[1]], req.origin);
      if (res.data) {
        comparison = res.data.rows;
        if (res.data.a) hospitals.push(res.data.a);
        if (res.data.b) hospitals.push(res.data.b);
        actions.push({ type: 'open-compare', ids });
      } else if (res.error) {
        blockers.push(res.error);
      }
    } else if (ids.length === 1) {
      toolsRun.push('getHospitalDetails');
      const res = await getHospitalDetails(ids[0], req.origin);
      if (res.data) hospitals.push(res.data.hospital);
    }
  } else if (intent.intent === 'followup') {
    // Continue the previous topic using the previous user message as context.
    const previousUser = [...req.history].reverse().find((h) => h.role === 'user');
    if (previousUser) {
      const previousIntent = classifyTurn(previousUser.text, [], istHour);
      if (previousIntent.intent === 'location_travel' || previousIntent.intent === 'hospital_search') {
        toolsRun.push('searchHospitals');
        const res = await searchHospitals({ limit: MAX_HOSPITAL_CARDS, origin: req.origin });
        if (res.data) hospitals.push(...res.data);
        if (res.needsOrigin) actions.push({ type: 'request-location', reason: 'Distances need your starting point.' });
      } else if (previousIntent.intent === 'hospital_compare') {
        const ids = resolveHospitalReference(previousUser.text).slice(0, 2);
        if (ids.length === 2) {
          toolsRun.push('compareHospitals');
          const res = await compareHospitals([ids[0], ids[1]], req.origin);
          if (res.data) {
            comparison = res.data.rows;
            if (res.data.a) hospitals.push(res.data.a);
            if (res.data.b) hospitals.push(res.data.b);
          }
        }
      }
    }
  } else if (intent.intent === 'website_help' && /\b(rating|review|score)\b|रेटिंग/i.test(req.message)) {
    const ids = resolveHospitalReference(req.message);
    if (ids[0]) {
      toolsRun.push('getHospitalRatings');
      await getHospitalRatings(ids[0]);
    }
  }

  /**
   * Requirement 7: a refusal must still leave the user somewhere to go. When we
   * refuse to prescribe (or to invent ICU availability) but a starting point is
   * known, offer the nearest hospitals as an alternative — never as an answer to
   * the medical question itself.
   */
  if (intent.intent === 'unsupported' || intent.intent === 'health_info') {
    if (refusalFor(req.message, copy)) {
      toolsRun.push('searchHospitals');
      const res = await searchHospitals({ limit: 3, origin: req.origin });
      if (res.data) {
        hospitals.length = 0;
        hospitals.push(...res.data);
        actions.push({ type: 'open-hospitals', ids: res.data.map((h) => h.id) });
      }
      if (res.needsOrigin) {
        actions.push({ type: 'request-location', reason: 'The nearest hospital needs your starting point.' });
      }
      actions.push({ type: 'open-emergency' });
    }
  }

  // Costs are contextual data, not a hospital recommendation — safe to attach
  // for explicit price questions only.
  if (/\b(cost|price|charge|fee|kharch|खर्च|कितना लगेगा)\b/i.test(req.message) && intent.intent !== 'greeting') {
    toolsRun.push('getEstimatedCosts');
    const res = await getEstimatedCosts(req.message, req.lang);
    if (res.data) {
      costs = res.data.map((c) => ({
        treatmentName: c.treatmentName,
        govtRange: c.govtRange,
        privateRange: c.privateRange,
      }));
    }
  }

  const grounding: GroundingPayload = {
    intent: intent.intent,
    intentConfidence: Number(intent.confidence.toFixed(2)),
    origin: req.origin
      ? { label: req.origin.label, accuracyM: req.origin.accuracyM ?? null, source: req.origin.source }
      : null,
    hospitals: hospitals.map((h) => ({
      ...h,
      specialities: h.specialities.slice(0, 8),
      facilities: h.facilities.slice(0, 10),
    })),
    comparison: comparison?.map((r) => ({ label: r.label, aValue: r.aValue, bValue: r.bValue })) ?? null,
    costs,
    emergency: intent.emergency,
    toolsRun,
    blockers,
    routeSource,
  };

  // ── Conversational replies that need no tools ──────────────────────────────
  const deterministic = buildDeterministicReply({
    intent,
    copy,
    hospitals,
    comparison,
    costs,
    origin: req.origin,
    istHour,
    isReturning: req.history.length > 0,
    message: req.message,
    lang: req.lang,
  });

  const apiKey = geminiApiKey();
  if (!apiKey) {
    return {
      reply: deterministic,
      intent: intent.intent,
      intentConfidence: intent.confidence,
      hospitals: hospitals.slice(0, MAX_HOSPITAL_CARDS),
      comparison,
      costs,
      actions,
      groundingMode: 'deterministic-grounded',
      model: null,
      toolsRun,
      blockers: [...blockers, 'GEMINI_API_KEY is not configured — replies use JeevanSetu’s grounded rule engine.'],
      routeSource,
      emergency: intent.emergency,
      disclaimer: copy.disclaimer,
      originUsed: req.origin?.label ?? null,
      diagnostics: { signals: intent.signals, geminiStatus: 'NO_API_KEY', latencyMs: Date.now() - started },
    };
  }

  // ── Gemini phrasing pass ───────────────────────────────────────────────────
  const history = req.history.slice(-8).map((t) => ({
    role: t.role === 'assistant' ? ('model' as const) : ('user' as const),
    text: t.text.slice(0, 1200),
  }));

  const gemini = await geminiGenerate({
    systemInstruction: buildSystemInstruction({ lang: req.lang, grounding }),
    history,
    userText: req.message,
    temperature: intent.intent === 'health_info' || intent.intent === 'unknown' ? 0.6 : 0.5,
    maxOutputTokens: 700,
  });

  if (!gemini.ok || !gemini.text) {
    return {
      reply: deterministic,
      intent: intent.intent,
      intentConfidence: intent.confidence,
      hospitals: hospitals.slice(0, MAX_HOSPITAL_CARDS),
      comparison,
      costs,
      actions,
      groundingMode: 'deterministic-grounded',
      model: gemini.model,
      toolsRun,
      blockers: [
        ...blockers,
        `Gemini is unavailable (${gemini.errorStatus ?? 'unknown error'}), so this answer comes from JeevanSetu’s grounded rule engine instead of a language model.`,
      ],
      routeSource,
      emergency: intent.emergency,
      disclaimer: copy.disclaimer,
      originUsed: req.origin?.label ?? null,
      diagnostics: {
        signals: intent.signals,
        geminiStatus: gemini.errorStatus ?? 'UNKNOWN',
        latencyMs: Date.now() - started,
      },
    };
  }

  return {
    reply: gemini.text,
    intent: intent.intent,
    intentConfidence: intent.confidence,
    hospitals: hospitals.slice(0, MAX_HOSPITAL_CARDS),
    comparison,
    costs,
    actions,
    groundingMode: 'gemini-grounded',
    model: gemini.model,
    toolsRun,
    blockers,
    routeSource,
    emergency: intent.emergency,
    disclaimer: copy.disclaimer,
    originUsed: req.origin?.label ?? null,
    diagnostics: { signals: intent.signals, geminiStatus: 'OK', latencyMs: Date.now() - started },
  };
}

interface DeterministicInput {
  intent: IntentResult;
  copy: ReturnType<typeof assistantCopy>;
  hospitals: AssistantHospital[];
  comparison: AssistantResponse['comparison'];
  costs: AssistantResponse['costs'];
  origin: OriginInput | null;
  istHour: number;
  isReturning: boolean;
  message: string;
  lang: Lang;
}

/**
 * The rule engine must not answer a Bengali question in English. With Gemini
 * unavailable these intros/labels are the whole reply, so they are localised
 * here rather than left to the model.
 */
const LOCALISED_SEARCH_INTRO: Record<string, string> = {
  en: 'Here are the matching options from JeevanSetu’s dataset, nearest first:',
  hi: 'JeevanSetu के डेटा से मेल खाते विकल्प, सबसे नज़दीकी पहले:',
  bn: 'JeevanSetu-এর ডেটা থেকে মিলে যাওয়া বিকল্পগুলি, নিকটতম আগে:',
  ta: 'Google ஓட்டுநர் தூரத்தின்படி வரிசைப்படுத்தப்பட்ட, JeevanSetu தரவிலிருந்து அருகிலுள்ள விருப்பங்கள்:',
  te: 'Google డ్రైవింగ్ దూరం ప్రకారం క్రమబద్ధీకరించిన, JeevanSetu డేటా నుండి దగ్గరి ఎంపికలు:',
  mr: 'Google वाहन अंतरानुसार क्रमवार, JeevanSetu डेटामधील सर्वात जवळचे पर्याय:',
  gu: 'Google ડ્રાઇવિંગ અંતર પ્રમાણે ગોઠવેલા, JeevanSetu ડેટામાંથી નજીકના વિકલ્પો:',
  kn: 'Google ಚಾಲನಾ ದೂರದ ಪ್ರಕಾರ ಜೋಡಿಸಲಾದ, JeevanSetu ಡೇಟಾದ ಹತ್ತಿರದ ಆಯ್ಕೆಗಳು:',
  ml: 'Google ഡ്രൈവിംഗ് ദൂരം അനുസരിച്ച് ക്രമീകരിച്ച, JeevanSetu ഡാറ്റയിലെ അടുത്തുള്ള ഓപ്ഷനുകൾ:',
  pa: 'Google ਡ੍ਰਾਈਵਿੰਗ ਦੂਰੀ ਅਨੁਸਾਰ, JeevanSetu ਡੇਟਾ ਤੋਂ ਸਭ ਤੋਂ ਨੇੜਲੇ ਵਿਕਲਪ:',
  or: 'Google ଡ୍ରାଇଭିଂ ଦୂରତା ଅନୁସାରେ, JeevanSetu ଡାଟା ରୁ ନିକଟତମ ବିକଳ୍ପ:',
  ur: 'Google ڈرائیونگ فاصلے کے مطابق، JeevanSetu ڈیٹا سے قریب ترین اختیارات:',
};

const LOCALISED_SOURCE_NOTE: Record<string, string> = {
  en: 'Distance from your starting point is shown only when the Google Routes API answers — nothing is estimated.',
  hi: 'आपके शुरुआती बिंदु से दूरी केवल तब दिखाई जाती है जब Google Routes API जवाब दे — कोई अनुमान नहीं लगाया जाता।',
  bn: 'Google Routes API উত্তর দিলে তবেই আপনার শুরুর স্থান থেকে দূরত্ব দেখানো হয় — কোনো অনুমান করা হয় না।',
};

const LOCALISED_DISTANCE_UNAVAILABLE: Record<string, string> = {
  en: 'driving distance unavailable',
  hi: 'सड़क दूरी उपलब्ध नहीं',
  bn: 'সড়ক দূরত্ব পাওয়া যায়নি',
};

/**
 * Rule-engine reply. This is a first-class answer path (not a stub): it is what
 * users get when Gemini is down, and it is what the automated Loop D/E tests
 * assert against.
 */
/**
 * Requirement 7 refusal gate — deterministic, so it cannot be talked around by
 * the model. These are checked BEFORE any hospital tool output is turned into a
 * sentence, because "here are the nearest hospitals" is not an answer to
 * "which medicine should I take?".
 */
const PRESCRIPTION_PATTERNS = [
  /\b(which|what)\s+(medicine|medicines|tablet|tablets|drug|drugs|antibiotic|antibiotics|painkiller|dose|dosage|syrup)\b/i,
  /\b(should|can)\s+i\s+(take|drink|use)\b.*\b(medicine|tablet|paracetamol|dolo|antibiotic|painkiller|dose)\b/i,
  /\b(dosage|dose|mg)\b.*\b(safe|take|give|recommend)\b/i,
  /\b(prescribe|prescription)\b/i,
  /\b(diagnose|what do i have|do i have (cancer|diabetes|tb|typhoid))\b/i,
  /\b(medicine|दवा|दवाई)\b.*\b(ले|लेनी|कौन सी)\b/i,
];

const LIVE_DATA_PATTERNS = [
  /\b(how many|kitne)\s+(icu\s+)?(beds?|beds available)\b/i,
  /\b(icu|ventilator|oxygen)\s+(bed|beds|available|free|vacant)\b/i,
  /\b(beds?)\s+(available|free|vacant|empty)\b/i,
  /\b(is|are)\s+(there\s+)?(a\s+)?(doctor|surgeon|specialist)\s+(available|on duty|present)\b/i,
  /\b(waiting time|queue|wait time|opd today|token)\b/i,
];

function refusalFor(message: string, copy: AssistantCopy): string | null {
  if (LIVE_DATA_PATTERNS.some((re) => re.test(message))) return copy.liveDataRefusal;
  if (PRESCRIPTION_PATTERNS.some((re) => re.test(message))) return copy.medicalRefusal;
  return null;
}

export function buildDeterministicReply(input: DeterministicInput): string {
  const refusal = refusalFor(input.message, input.copy);
  if (refusal) {
    // A refusal may still carry a safe next step (hospital cards / emergency link).
    const opener = input.intent.emergency ? `${input.copy.emergencyHeadline} ${input.copy.emergencyAction}` : '';
    const nearest = input.hospitals
      .slice(0, 3)
      .map((h) => {
        const distance = formatDrivingKm(h.distanceKm, 'en');
        return `• ${h.shortName} (${h.city})${distance ? ` — ${distance}` : ''}${h.phone ? ` · ${h.phone}` : ''}`;
      })
      .join('\n');
    const next = nearest ? `\n\n${input.copy.emergencyOfferNav}\n${nearest}` : '';
    return `${opener ? `${opener}\n\n` : ''}${refusal}${next}`;
  }

  const { intent, copy, hospitals, comparison, costs, origin, istHour, isReturning } = input;

  switch (intent.intent) {
    case 'greeting':
      return isReturning ? copy.greetingBack : timeOfDayGreeting(copy, istHour);

    case 'casual':
      if (/your name|who are you|कौन हो|आपका नाम|तुम्हारा नाम/i.test(input.message)) return copy.identity;
      if (/how are you|kaise ho|कैसे (हैं|हो)/i.test(input.message)) return copy.casualWell;
      return copy.casualAskHelp;

    case 'identity':
      return copy.identity;

    case 'thanks':
      return copy.thanks;

    case 'closing':
      return copy.closing;

    case 'unsupported':
      return copy.unsupported;

    case 'emergency': {
      const lines = [copy.emergencyHeadline, copy.emergencyAction];
      if (hospitals.length > 0) {
        lines.push(copy.emergencyOfferNav);
        for (const h of hospitals.slice(0, 3)) {
          const distance = formatDrivingKm(h.distanceKm, 'en');
          const eta = h.etaMinutes ? formatDuration(h.etaMinutes, 'en') : null;
          lines.push(
            `• ${h.shortName} (${h.city})${distance ? ` — ${distance}` : ' — driving distance unavailable'}${eta ? `, ~${eta}` : ''}`,
          );
        }
      }
      return lines.join('\n');
    }

    case 'health_info': {
      const opener = /headache|migraine|सिरदर्द|दर्द|pain/i.test(input.message)
        ? copy.healthAcknowledge
        : copy.healthAcknowledgeGeneric;
      return `${opener} ${copy.healthFollowUp}`;
    }

    case 'hospital_search': {
      // A city explicitly named by the user does not need a GPS origin.
      const namedCity = /(?:in|near|around|में|এর|য়)\s+([A-Z][a-zA-Z]+)/.exec(input.message)?.[1] ?? null;
      if (!origin && !namedCity && hospitals.length === 0) return `${copy.hospitalAskLocation}`;
      if (hospitals.length === 0) return copy.askCity;
      const lines = [LOCALISED_SEARCH_INTRO[input.lang] ?? LOCALISED_SEARCH_INTRO.en];
      const unavailable =
        LOCALISED_DISTANCE_UNAVAILABLE[input.lang] ?? LOCALISED_DISTANCE_UNAVAILABLE.en;
      for (const h of hospitals) {
        const distance = formatDrivingKm(h.distanceKm, 'en');
        const eta = h.etaMinutes ? formatDuration(h.etaMinutes, 'en') : null;
        lines.push(
          `• ${h.shortName} (${h.city}) — ${distance ?? unavailable}${eta ? `, ~${eta}` : ''}${
            h.emergency === 'verified' ? ' · 24×7 emergency' : ''
          }`,
        );
      }
      lines.push(
        namedCity
          ? `${LOCALISED_SOURCE_NOTE[input.lang] ?? LOCALISED_SOURCE_NOTE.en}`
          : 'Distances come from the Google Routes API for your selected starting point.',
      );
      return lines.join('\n');
    }

    case 'hospital_compare': {
      if (!comparison) return copy.compareAskWhich;
      const lines = [copy.compareIntro];
      for (const row of comparison) {
        lines.push(`• ${row.label}: ${row.aValue} vs ${row.bValue}`);
      }
      lines.push(
        'Speciality lists and review scores describe what each hospital publishes — they do not prove clinical quality.',
      );
      return lines.join('\n');
    }

    case 'location_travel': {
      const hospital = hospitals[0];
      if (!hospital) return copy.askCity;
      if (!origin) {
        return `${copy.travelNeedOrigin}\n• ${hospital.shortName} (${hospital.city})`;
      }
      const distance = formatDrivingKm(hospital.distanceKm, 'en');
      const eta = hospital.etaMinutes ? formatDuration(hospital.etaMinutes, 'en') : null;
      if (!distance) {
        return `I could not get a live Google driving route to ${hospital.shortName} right now, so I won't quote a distance. ${
          hospital.travelError ?? ''
        }`.trim();
      }
      const traffic =
        hospital.trafficImpactMinutes && hospital.trafficImpactMinutes > 0
          ? ` Google's traffic-aware ETA adds roughly ${hospital.trafficImpactMinutes} min over free-flow conditions.`
          : '';
      return `From ${origin.label}, ${hospital.shortName} is ${distance} by road${eta ? ` — about ${eta} in current traffic` : ''}.${traffic}`;
    }

    case 'website_help':
      return copy.websiteHelp;

    case 'followup':
      return hospitals.length > 0
        ? buildDeterministicReply({ ...input, intent: { ...intent, intent: 'hospital_search' } })
        : copy.unknown;

    default: {
      if (costs && costs.length > 0) {
        return [
          'These are JeevanSetu’s published indicative ranges (CGHS / PM-JAY / published tariffs — not a quote):',
          ...costs.map((c) => `• ${c.treatmentName}: Government ${c.govtRange}, Private ${c.privateRange}`),
        ].join('\n');
      }
      return copy.unknown;
    }
  }
}
