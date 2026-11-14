'use client';
/**
 * Browser speech helpers for JeevanSetu AI Assistant.
 *
 * Two directions:
 *   • Listening  — Web Speech Recognition (on-device, low latency). Languages we
 *     have verified are listed in `VOICE_VERIFIED_LANGS`; anything else gets the
 *     text fallback instead of a broken microphone.
 *   • Speaking   — SpeechSynthesis with an Indian-locale voice when available,
 *     stoppable mid-sentence so the user can interrupt (requirement: "Interrupt
 *     assistant speech where supported").
 *
 * These are only used when the Gemini Live audio session is unavailable; the
 * Live session (when a token can be minted) gives full duplex audio instead.
 */

export interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

interface SpeechResultEvent {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: { isFinal: boolean; 0: { transcript: string } };
  };
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

export function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognition() !== null;
}

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/** Picks the best available voice for the locale, preferring local voices. */
export function pickVoice(locale: string, preferredName?: string): SpeechSynthesisVoice | null {
  if (!isSpeechSynthesisSupported()) return null;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;
  if (preferredName) {
    const named = voices.find((v) => v.name.toLowerCase().includes(preferredName.toLowerCase()));
    if (named) return named;
  }
  const exact = voices.find((v) => v.lang.replace('_', '-').toLowerCase() === locale.toLowerCase());
  if (exact) return exact;
  const language = locale.split('-')[0];
  const sameLanguage = voices.filter((v) => v.lang.toLowerCase().startsWith(language));
  const local = sameLanguage.find((v) => v.localService);
  return local ?? sameLanguage[0] ?? null;
}

export interface SpeakOptions {
  text: string;
  locale: string;
  onEnd?: () => void;
  onStart?: () => void;
  onError?: () => void;
}

/** Speaks `text`; returns a stop function so the caller can interrupt. */
export function speak({ text, locale, onEnd, onStart, onError }: SpeakOptions): () => void {
  if (!isSpeechSynthesisSupported() || !text.trim()) {
    onEnd?.();
    return () => {};
  }
  const synth = window.speechSynthesis;
  synth.cancel();

  const utterance = new SpeechSynthesisUtterance(stripForSpeech(text));
  utterance.lang = locale;
  const voice = pickVoice(locale);
  if (voice) utterance.voice = voice;
  utterance.rate = 0.98;
  utterance.pitch = 1;
  utterance.onstart = () => onStart?.();
  utterance.onend = () => onEnd?.();
  utterance.onerror = () => onError?.();

  synth.speak(utterance);
  return () => {
    try {
      synth.cancel();
    } catch {
      /* ignore */
    }
  };
}

export function stopSpeaking(): void {
  if (!isSpeechSynthesisSupported()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    /* ignore */
  }
}

/**
 * Cleans assistant text for speech: drops list bullets/markdown, expands a few
 * abbreviations that synthesisers mispronounce, and keeps sentences short.
 */
export function stripForSpeech(text: string): string {
  return text
    .replace(/^[•\-*]\s*/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\bkm\b/gi, 'kilometres')
    .replace(/\bmin\b/gi, 'minutes')
    .replace(/\b24×7\b/g, 'twenty four by seven')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Maps our language codes to the browser's BCP-47 speech locales. */
export const SPEECH_LOCALES: Record<string, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  bn: 'bn-IN',
  te: 'te-IN',
  mr: 'mr-IN',
  ta: 'ta-IN',
  gu: 'gu-IN',
  ur: 'ur-IN',
  kn: 'kn-IN',
  or: 'or-IN',
  ml: 'ml-IN',
};
