/**
 * Google Gemini integration (server-side only).
 *
 * Security (requirement 6 & 15):
 *  • The permanent API key never leaves the server. The browser only ever sees a
 *    short-lived ephemeral token minted by /api/assistant/voice-token, or nothing.
 *  • Every failure is typed so the assistant can degrade gracefully instead of
 *    showing a fabricated answer.
 *
 * Models are configurable via env because Google rotates preview model names:
 *   GEMINI_TEXT_MODEL  (default: gemini-2.5-flash)
 *   GEMINI_LIVE_MODEL  (default: gemini-2.5-flash-native-audio-preview-09-2025)
 */

export interface GeminiTextResult {
  ok: boolean;
  text: string | null;
  model: string;
  errorStatus: string | null;
  errorMessage: string | null;
  latencyMs: number;
}

export function geminiApiKey(): string | null {
  const raw = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GEMINI_API_KEY ?? process.env.GOOGLE_AI_API_KEY;
  return raw && raw.trim().length > 0 ? raw.trim() : null;
}

export function geminiTextModel(): string {
  return process.env.GEMINI_TEXT_MODEL?.trim() || 'gemini-2.5-flash';
}

export function geminiLiveModel(): string {
  return process.env.GEMINI_LIVE_MODEL?.trim() || 'gemini-2.5-flash-native-audio-preview-09-2025';
}

export interface GeminiTurn {
  role: 'user' | 'model';
  text: string;
}

/**
 * Calls Gemini generateContent with a hard timeout.
 * Temperature is deliberately low: this assistant answers healthcare questions
 * and must stay close to the supplied grounding data.
 */
export async function geminiGenerate(params: {
  systemInstruction: string;
  history: GeminiTurn[];
  userText: string;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
}): Promise<GeminiTextResult> {
  const started = Date.now();
  const key = geminiApiKey();
  const model = geminiTextModel();

  if (!key) {
    return {
      ok: false,
      text: null,
      model,
      errorStatus: 'NO_API_KEY',
      errorMessage: 'GEMINI_API_KEY is not configured on the server.',
      latencyMs: 0,
    };
  }

  const body = {
    systemInstruction: { parts: [{ text: params.systemInstruction }] },
    contents: [
      ...params.history.map((t) => ({ role: t.role, parts: [{ text: t.text }] })),
      { role: 'user', parts: [{ text: params.userText }] },
    ],
    generationConfig: {
      temperature: params.temperature ?? 0.55,
      maxOutputTokens: params.maxOutputTokens ?? 700,
      topP: 0.9,
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
    ],
  };

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': key,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(params.timeoutMs ?? 12000),
        cache: 'no-store',
      },
    );

    const json = (await res.json().catch(() => ({}))) as {
      candidates?: {
        content?: { parts?: { text?: string }[] };
        finishReason?: string;
      }[];
      promptFeedback?: { blockReason?: string };
      error?: { status?: string; message?: string; code?: number };
    };

    if (!res.ok || json.error) {
      return {
        ok: false,
        text: null,
        model,
        errorStatus: json.error?.status ?? `HTTP_${res.status}`,
        errorMessage: json.error?.message ?? 'Gemini request failed.',
        latencyMs: Date.now() - started,
      };
    }

    if (json.promptFeedback?.blockReason) {
      return {
        ok: false,
        text: null,
        model,
        errorStatus: 'BLOCKED',
        errorMessage: `Prompt blocked: ${json.promptFeedback.blockReason}`,
        latencyMs: Date.now() - started,
      };
    }

    const text =
      json.candidates?.[0]?.content?.parts
        ?.map((p) => p.text ?? '')
        .join('')
        .trim() ?? '';

    if (!text) {
      return {
        ok: false,
        text: null,
        model,
        errorStatus: 'EMPTY_RESPONSE',
        errorMessage: 'Gemini returned an empty response.',
        latencyMs: Date.now() - started,
      };
    }

    return { ok: true, text, model, errorStatus: null, errorMessage: null, latencyMs: Date.now() - started };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network error';
    return {
      ok: false,
      text: null,
      model,
      errorStatus: /timeout|abort/i.test(message) ? 'TIMEOUT' : 'NETWORK_ERROR',
      errorMessage: message,
      latencyMs: Date.now() - started,
    };
  }
}

/**
 * Mints a short-lived ephemeral token for the Gemini Live API in the browser.
 *
 * Docs: ai.google.dev/gemini-api/docs/ephemeral-tokens
 * The browser then connects to
 *   wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained?access_token=<token>
 * which keeps the permanent key server-side (requirement 6).
 */
export async function createLiveEphemeralToken(params: {
  systemInstruction: string;
  voiceName?: string;
  expireMinutes?: number;
  newSessionExpireMinutes?: number;
}): Promise<{
  ok: boolean;
  token: string | null;
  expiresAt: string | null;
  model: string;
  wsUrl: string | null;
  errorStatus: string | null;
  errorMessage: string | null;
}> {
  const key = geminiApiKey();
  const model = geminiLiveModel();

  if (!key) {
    return {
      ok: false,
      token: null,
      expiresAt: null,
      model,
      wsUrl: null,
      errorStatus: 'NO_API_KEY',
      errorMessage: 'GEMINI_API_KEY is not configured on the server, so voice sessions are disabled.',
    };
  }

  const now = Date.now();
  const expireMinutes = params.expireMinutes ?? 30;
  const newSessionExpireMinutes = params.newSessionExpireMinutes ?? 1;

  const body = {
    uses: 1,
    expireTime: new Date(now + expireMinutes * 60_000).toISOString(),
    newSessionExpireTime: new Date(now + newSessionExpireMinutes * 60_000).toISOString(),
    liveConnectConstraints: {
      model,
      config: {
        responseModalities: ['AUDIO'],
        systemInstruction: { parts: [{ text: params.systemInstruction }] },
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: params.voiceName ?? 'Kore' } },
        },
        outputAudioTranscription: {},
        inputAudioTranscription: {},
      },
    },
  };

  try {
    const res = await fetch('https://generativelanguage.googleapis.com/v1alpha/auth_tokens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': key,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
      cache: 'no-store',
    });

    const json = (await res.json().catch(() => ({}))) as {
      name?: string;
      expireTime?: string;
      error?: { status?: string; message?: string };
    };

    if (!res.ok || json.error || !json.name) {
      return {
        ok: false,
        token: null,
        expiresAt: null,
        model,
        wsUrl: null,
        errorStatus: json.error?.status ?? `HTTP_${res.status}`,
        errorMessage: json.error?.message ?? 'Could not create an ephemeral Gemini token.',
      };
    }

    return {
      ok: true,
      token: json.name,
      expiresAt: json.expireTime ?? null,
      model,
      wsUrl: `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained?access_token=${encodeURIComponent(json.name)}`,
      errorStatus: null,
      errorMessage: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network error';
    return {
      ok: false,
      token: null,
      expiresAt: null,
      model,
      wsUrl: null,
      errorStatus: /timeout|abort/i.test(message) ? 'TIMEOUT' : 'NETWORK_ERROR',
      errorMessage: message,
    };
  }
}
