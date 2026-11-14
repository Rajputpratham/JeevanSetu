import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { classifyIntent } from '@/lib/assistant/intent';
import { runAssistantTurn, type AssistantResponse } from '@/lib/assistant/orchestrator';
import { assistantCopy } from '@/lib/assistant/strings';
import { buildSystemInstruction } from '@/lib/assistant/prompt';
import { SUPPORTED_LANGUAGES, type Lang } from '@/lib/lang-meta';
import { HOSPITALS } from '@/data/hospitals';

/**
 * LOOP C — Assistant behaviour (requirements 5, 6, 7, 10).
 *
 * Test B (requirement 10.10) is the important one: a plain "Hi" must never
 * produce hospital cards. That is enforced by the deterministic intent gate,
 * not by the model's goodwill — so it holds even with Gemini unavailable.
 */

beforeAll(() => {
  vi.stubEnv('GEMINI_API_KEY', '');
  vi.stubEnv('GOOGLE_MAPS_API_KEY', '');
});
afterAll(() => {
  vi.unstubAllEnvs();
});

const PUSA = { lat: 28.6426, lng: 77.1842, label: 'Pusa Road, New Delhi', source: 'manual' as const };

const ask = (message: string, origin: typeof PUSA | null = null, lang: Lang = 'en') =>
  runAssistantTurn({
    message,
    lang,
    origin,
    history: [],
    istHour: 10,
    now: new Date('2026-01-01T04:30:00Z'),
  });

describe('Test B — a greeting must never dump hospital recommendations (10.10)', () => {
  const greetings = ['hi', 'Hello!', 'hey there', 'Good morning', 'namaste', 'नमस्ते', 'নমস্কার', 'Hi, how are you?'];

  it.each(greetings)('"%s" is a conversational turn with zero tool calls', async (message) => {
    const intent = classifyIntent(message, { istHour: 10 });
    expect(intent.intent).toBe('greeting');
    expect(intent.allowHospitalTools).toBe(false);
    expect(intent.allowLocationPrompt).toBe(false);
  });

  it.each(greetings)('"%s" returns a greeting with no hospital cards and no location prompt', async (message) => {
    const res = await ask(message);
    expect(res.hospitals).toHaveLength(0);
    expect(res.toolsRun).toHaveLength(0);
    expect(res.comparison).toBeNull();
    expect(res.costs).toBeNull();
    expect(res.actions.filter((a) => a.type === 'request-location')).toHaveLength(0);
    // It should invite the user in, not ignore them.
    expect(res.reply.length).toBeGreaterThan(10);
  });

  it('a greeting + small talk never escalates into a search either', async () => {
    const res = await ask('hey, what can you do?');
    expect(res.hospitals).toHaveLength(0);
    expect(res.toolsRun).toHaveLength(0);
  });
});

describe('Intent gate — casual / identity / thanks / closing are all tool-free', () => {
  const cases: [string, string][] = [
    ['how are you doing today?', 'casual'],
    ['who are you?', 'identity'],
    ['thanks a lot!', 'thanks'],
    ['bye', 'closing'],
  ];

  it.each(cases)('"%s" → %s, no tools', async (message, expected) => {
    const intent = classifyIntent(message, { istHour: 10 });
    expect(intent.intent).toBe(expected);
    expect(intent.allowHospitalTools).toBe(false);

    const res = await ask(message);
    expect(res.hospitals).toHaveLength(0);
    expect(res.toolsRun).toHaveLength(0);
  });
});

describe('Test A — hospital search works even with Gemini unavailable', () => {
  it('returns grounded hospitals for a government-hospital request', async () => {
    const res = await ask('show me government hospitals near me', PUSA);
    expect(res.toolsRun).toContain('searchHospitals');
    expect(res.hospitals.length).toBeGreaterThan(0);
    expect(res.hospitals.every((h) => HOSPITALS.some((real) => real.id === h.id))).toBe(true);
    expect(res.hospitals.every((h) => h.type === 'government')).toBe(true);
    // Gemini is not configured in this environment → must degrade honestly.
    expect(res.groundingMode).toBe('deterministic-grounded');
    expect(res.blockers.join(' ')).toMatch(/NO_API_KEY|GEMINI/i);
    expect(res.reply.length).toBeGreaterThan(20);
  });

  it('never invents a hospital, distance or ETA', async () => {
    const res = await ask('private hospitals in Delhi', PUSA);
    for (const h of res.hospitals) {
      const real = HOSPITALS.find((r) => r.id === h.id)!;
      expect(h.name).toBe(real.name);
      // With no Maps key a distance must be absent, never estimated.
      if (h.distanceKm !== null && h.distanceKm !== undefined) {
        expect(typeof h.distanceKm).toBe('number');
        // A distance may only ever come from Google, never from the model.
        expect(['google-routes-api', 'google-route-matrix', 'unavailable']).toContain(h.travelSource);
      }
    }
  });

  it('asks for a location instead of guessing Delhi when none is known', async () => {
    const res = await ask('nearest emergency hospital', null);
    expect(res.actions.some((a) => a.type === 'request-location' || a.type === 'open-emergency')).toBe(true);
    for (const h of res.hospitals) {
      expect(h.distanceKm ?? null).toBeNull();
    }
  });

  it('emergency intent short-circuits to emergency help with a call action', async () => {
    const res = await ask('someone is having severe chest pain right now', PUSA);
    expect(res.emergency).toBe(true);
    expect(res.intent).toBe('emergency');
    expect(res.toolsRun).toContain('getEmergencyHospitals');
    expect(res.actions.some((a) => a.type === 'open-emergency')).toBe(true);
    expect(res.reply).toMatch(/112|call/i);
  });
});

describe('Requirement 7 — no medical advice, no invented live data', () => {
  const unsafe = [
    'which medicine should I take for fever?',
    'what dosage of paracetamol is safe?',
    'can you prescribe antibiotics?',
    'how many ICU beds are free right now?',
    'is there a doctor available at AIIMS today?',
  ];

  it.each(unsafe)('"%s" is answered with an explicit refusal + safe next step', async (message) => {
    const res = await ask(message, PUSA);
    expect(res.reply.toLowerCase()).toMatch(
      /cannot|can't|unable|not able|no access|don't have|do not have|not available|डॉक्टर|नहीं/,
    );
    // Refusals must still route the user somewhere useful.
    expect(res.actions.length + (res.hospitals.length > 0 ? 1 : 0)).toBeGreaterThan(0);
  });

  it('exposes the disclosure string with every reply', async () => {
    const res = await ask('hi');
    expect(res.disclaimer.length).toBeGreaterThan(10);
  });
});

describe('Intent routing for real phrasings (regression set)', () => {
  const expected: [string, string][] = [
    ['government hospitals in Kolkata', 'hospital_search'],
    ['hospitals in Kolkata', 'hospital_search'],
    ['private hospitals in Delhi', 'hospital_search'],
    ['show me government hospitals near me', 'hospital_search'],
    ['how far is BSA hospital', 'location_travel'],
    ['compare AIIMS and Safdarjung', 'hospital_compare'],
    ['nearest emergency hospital', 'emergency'],
    ['is there a doctor available at AIIMS today?', 'unsupported'],
    ['which medicine should I take for fever?', 'unsupported'],
    ['how do I use the cost estimator?', 'website_help'],
  ];

  it.each(expected)('"%s" → %s', (message, intentName) => {
    expect(classifyIntent(message, { istHour: 10 }).intent).toBe(intentName);
  });

  it('a named city wins over a distant GPS origin', async () => {
    const res = await ask('government hospitals in Kolkata', PUSA);
    expect(res.hospitals.map((h) => h.id)).toEqual(['sskm-kolkata']);
    expect(res.hospitals[0].city).toBe('Kolkata');
  });
});

describe('Language coverage (requirement 6)', () => {
  it('supports every configured language with real localized copy', async () => {
    for (const { code: lang } of SUPPORTED_LANGUAGES) {
      const res = await ask('hello', null, lang);
      expect(res.reply.length).toBeGreaterThan(5);
      const copy = assistantCopy(lang);
      expect(copy.greetingFirst.length).toBeGreaterThan(0);
    }
  });

  it('answers a Bengali government-hospital request in Bengali', async () => {
    const res = await runAssistantTurn({
      message: 'কাছাকাছি সরকারি হাসপাতাল দেখান',
      lang: 'bn',
      origin: { lat: 22.5726, lng: 88.3639, label: 'Kolkata', source: 'manual' },
      history: [],
      istHour: 10,
    });
    expect(res.hospitals.length).toBeGreaterThan(0);
    expect(res.hospitals.every((h) => h.type === 'government')).toBe(true);
    // Bengali script, not an English fallback.
    expect(res.reply).toMatch(/[\u0980-\u09FF]/);
  });
});

describe('Requirement 3 / 5 — the assistant speaks only grounded facts to the model', () => {
  it('system instruction forbids inventing data and forbids medical advice', () => {
    const instruction = buildSystemInstruction({
      lang: 'en',
      grounding: {
        intent: 'greeting',
        intentConfidence: 1,
        origin: null,
        hospitals: [],
        comparison: null,
        costs: null,
        emergency: false,
        toolsRun: [],
        blockers: [],
        routeSource: null,
      },
    });
    const lower = instruction.toLowerCase();
    expect(lower).toContain('never invent');
    expect(lower).toMatch(/prescrib|diagnos|medical advice|not a doctor/);
    expect(lower).toMatch(/only mention hospitals that appear in the grounding data|only these values/);
  });
});

describe('Response contract the UI depends on', () => {
  it('always returns the full response shape', async () => {
    const res: AssistantResponse = await ask('hospitals near me', PUSA);
    expect(Object.keys(res)).toEqual(
      expect.arrayContaining([
        'reply',
        'intent',
        'intentConfidence',
        'hospitals',
        'comparison',
        'costs',
        'actions',
        'groundingMode',
        'blockers',
        'toolsRun',
        'emergency',
        'disclaimer',
        'diagnostics',
      ]),
    );
    expect(['gemini-grounded', 'deterministic-grounded']).toContain(res.groundingMode);
    expect(res.diagnostics.latencyMs).toBeGreaterThanOrEqual(0);
  });
});
