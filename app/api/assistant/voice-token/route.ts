import { NextRequest, NextResponse } from 'next/server';
import { isValidLang } from '@/lib/lang-meta';
import { assistantStrings } from '@/lib/ui-strings';
import { buildSystemInstruction, LANGUAGE_NAMES, type GroundingPayload } from '@/lib/assistant/prompt';
import { createLiveEphemeralToken, geminiApiKey, geminiLiveModel } from '@/lib/assistant/gemini';
import { TOOL_CATALOGUE } from '@/lib/assistant/tools';

export const dynamic = 'force-dynamic';
export const maxDuration = 20;

/**
 * POST /api/assistant/voice-token
 *
 * Mints a SHORT-LIVED Gemini Live API token for the browser. The permanent
 * GEMINI_API_KEY never leaves the server (requirement 6).
 *
 * The response is honest when it cannot help:
 *   • no key            → { available: false, reason: 'GEMINI_API_KEY_MISSING' }
 *   • Live API refused  → { available: false, reason: 'LIVE_API_ERROR', detail }
 * The client then offers the verified browser speech + Gemini-text path.
 */
export async function POST(request: NextRequest) {
  let lang: string | undefined;
  let voice: string | undefined;

  try {
    const body = await request.json().catch(() => ({}));
    lang = (body as { lang?: string }).lang;
    voice = (body as { voice?: string }).voice;
  } catch {
    /* empty body is fine */
  }

  const safeLang = isValidLang(lang) ? lang : 'en';
  const strings = assistantStrings(safeLang);

  if (!geminiApiKey()) {
    return NextResponse.json({
      available: false,
      reason: 'GEMINI_API_KEY_MISSING',
      message:
        'Voice conversations need GEMINI_API_KEY on the server. The assistant works in text mode, and browser speech input is still available where the device supports it.',
      fallback: 'browser-speech-plus-gemini-text',
      tools: TOOL_CATALOGUE,
    });
  }

  const grounding: GroundingPayload = {
    intent: 'voice-session',
    intentConfidence: 1,
    origin: null,
    hospitals: [],
    comparison: null,
    costs: null,
    emergency: false,
    toolsRun: [],
    blockers: [],
    routeSource: null,
  };

  const systemInstruction = [
    buildSystemInstruction({ lang: safeLang, grounding }),
    '',
    'VOICE MODE',
    `- The caller is speaking ${LANGUAGE_NAMES[safeLang] ?? 'English'}. Reply in that language only.`,
    '- Keep spoken answers under four sentences; this is a live conversation, not a lecture.',
    '- If the user asks for a distance, say you need their location or area first; never guess a number.',
    '- If the user describes an emergency, tell them to call 112 immediately and say nothing else first.',
    `- You are ${strings.title}.`,
  ].join('\n');

  const token = await createLiveEphemeralToken({ systemInstruction, voiceName: voice });

  if (!token.ok) {
    return NextResponse.json({
      available: false,
      reason: 'LIVE_API_ERROR',
      detail: { status: token.errorStatus, message: token.errorMessage },
      message:
        token.errorStatus === 'PERMISSION_DENIED' || token.errorStatus === 'NOT_FOUND'
          ? 'The configured Gemini model does not support the Live API for this key. Set GEMINI_LIVE_MODEL to a Live-capable model (for example gemini-2.5-flash-native-audio-preview-09-2025).'
          : 'The Gemini Live API is not reachable right now. Falling back to speech-to-text + Gemini text replies.',
      fallback: 'browser-speech-plus-gemini-text',
      tools: TOOL_CATALOGUE,
    });
  }

  return NextResponse.json({
    available: true,
    token: token.token,
    wsUrl: token.wsUrl,
    model: geminiLiveModel(),
    expiresAt: token.expiresAt,
    /** Not secret: the browser needs to know the conversation language. */
    lang: safeLang,
    voice: voice ?? 'Kore',
    fallback: 'browser-speech-plus-gemini-text',
    tools: TOOL_CATALOGUE,
  });
}
