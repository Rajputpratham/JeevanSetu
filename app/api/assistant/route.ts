import { NextRequest, NextResponse } from 'next/server';
import { isValidLang } from '@/lib/lang-meta';
import { runAssistantTurn, type AssistantRequest } from '@/lib/assistant/orchestrator';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * POST /api/assistant — the JeevanSetu AI Assistant endpoint.
 *
 * Replaces the old /api/chat grounded-retrieval bot. Behaviour is governed by
 * `lib/assistant/*`: intent gating (greetings never trigger hospital tools),
 * Google-Routes-only distance figures, honest degradation when Gemini is down.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body.', code: 'BAD_BODY' }, { status: 400 });
    }

    const {
      message,
      lang,
      origin,
      history,
      focusedHospitalId,
      istHour,
    } = body as {
      message?: string;
      lang?: string;
      origin?: { lat?: number; lng?: number; label?: string; source?: string; accuracyM?: number | null } | null;
      history?: { role?: string; text?: string }[];
      focusedHospitalId?: string | null;
      istHour?: number;
    };

    const text = (message ?? '').trim();
    if (!text) {
      return NextResponse.json({ error: 'Please type a message.', code: 'EMPTY_MESSAGE' }, { status: 400 });
    }
    if (text.length > 1000) {
      return NextResponse.json(
        { error: 'That message is too long. Please keep it under 1000 characters.', code: 'MESSAGE_TOO_LONG' },
        { status: 400 },
      );
    }

    const safeLang = isValidLang(lang) ? lang : 'en';

    let safeOrigin: AssistantRequest['origin'] = null;
    if (
      origin &&
      typeof origin.lat === 'number' &&
      typeof origin.lng === 'number' &&
      Number.isFinite(origin.lat) &&
      Number.isFinite(origin.lng) &&
      Math.abs(origin.lat) <= 90 &&
      Math.abs(origin.lng) <= 180
    ) {
      safeOrigin = {
        lat: origin.lat,
        lng: origin.lng,
        label: (origin.label ?? 'Your location').slice(0, 160),
        source:
          origin.source === 'geolocation' ||
          origin.source === 'manual' ||
          origin.source === 'preset' ||
          origin.source === 'map'
            ? origin.source
            : 'unknown',
        accuracyM: typeof origin.accuracyM === 'number' ? origin.accuracyM : null,
      };
    }

    const safeHistory = Array.isArray(history)
      ? history
          .filter((h) => (h?.role === 'user' || h?.role === 'assistant') && typeof h?.text === 'string')
          .slice(-12)
          .map((h) => ({ role: h.role as 'user' | 'assistant', text: (h.text as string).slice(0, 1200) }))
      : [];

    const result = await runAssistantTurn({
      message: text,
      lang: safeLang,
      origin: safeOrigin,
      history: safeHistory,
      focusedHospitalId: typeof focusedHospitalId === 'string' ? focusedHospitalId : null,
      istHour: typeof istHour === 'number' && istHour >= 0 && istHour <= 23 ? istHour : undefined,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error('[api/assistant]', err);
    return NextResponse.json(
      {
        error:
          'The JeevanSetu AI Assistant is temporarily unavailable. You can still search hospitals, compare facilities and check travel times from the menu. If this is an emergency, call 112 now.',
        code: 'ASSISTANT_FAILED',
      },
      { status: 500 },
    );
  }
}
