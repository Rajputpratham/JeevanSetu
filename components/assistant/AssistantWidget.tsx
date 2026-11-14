'use client';
/**
 * JeevanSetu AI Assistant — voice-first conversation surface.
 *
 * Replaces the old ChatbotWidget entirely (requirement 5 & 8):
 *   • Float button → full assistant panel, mobile full-screen.
 *   • Four manual prompt chips (never auto-submitted).
 *   • Microphone (verified languages only), keyboard, mute, end conversation.
 *   • Live status: Listening… / Thinking… / Speaking…
 *   • Visible transcripts for both sides.
 *   • Voice path: Gemini Live ephemeral token when available, otherwise
 *     verified browser speech recognition → Gemini text → speech synthesis.
 *   • Every distance shown comes from /api/travel / the assistant response,
 *     which are Google Routes numbers.
 */
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Sparkles, X, Send, Loader2, Mic, MicOff, Volume2, VolumeX, PhoneCall,
  MapPin, Clock, Keyboard, MessageSquareText, Square, AlertTriangle, Route, Languages,
  ChevronRight, Siren,
} from 'lucide-react';
import { useLang, getLangMeta, SUPPORTED_LANGUAGES } from '@/lib/i18n';
import { useUserLocation } from '@/lib/useLocation';
import { formatDrivingKm, formatDuration } from '@/lib/geo';
import { assistantStrings, distanceStrings, VOICE_VERIFIED_LANGS } from '@/lib/ui-strings';
import type { AssistantResponse } from '@/lib/assistant/orchestrator';
import Waveform from './Waveform';
import {
  getSpeechRecognition,
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  pickVoice,
  speak,
  stopSpeaking,
  SPEECH_LOCALES,
  type SpeechRecognitionLike,
} from './speech';

type AssistantStatus = 'ready' | 'listening' | 'thinking' | 'speaking' | 'connecting';

interface Turn {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  response?: AssistantResponse;
  /** True when the text was spoken rather than typed. */
  spoken?: boolean;
  error?: boolean;
}

interface VoiceTokenResponse {
  available: boolean;
  token?: string;
  wsUrl?: string;
  model?: string;
  reason?: string;
  message?: string;
  fallback?: string;
}

export default function AssistantWidget() {
  const { t, lang, setLang } = useLang();
  const strings = assistantStrings(lang);
  const ds = distanceStrings(lang);
  const meta = getLangMeta(lang);
  const locale = SPEECH_LOCALES[lang] ?? meta.speechLocale;
  const { location, hasLocation } = useUserLocation();

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [status, setStatus] = useState<AssistantStatus>('ready');
  const [busy, setBusy] = useState(false);
  const [muted, setMuted] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [voiceNote, setVoiceNote] = useState<string | null>(null);
  const [liveSession, setLiveSession] = useState<'idle' | 'active' | 'unavailable'>('idle');
  const [interim, setInterim] = useState('');
  const [showLangPicker, setShowLangPicker] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const stopSpeakRef = useRef<(() => void) | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const voiceSupported = isSpeechRecognitionSupported();
  const voiceVerifiedForLang = VOICE_VERIFIED_LANGS.includes(lang);
  const ttsSupported = isSpeechSynthesisSupported();

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [turns, interim, open]);

  // Clean up audio + recogniser on close/unmount.
  useEffect(() => {
    if (open) return;
    stopSpeaking();
    recognitionRef.current?.abort?.();
    setStatus('ready');
  }, [open]);

  useEffect(() => () => {
    stopSpeaking();
    recognitionRef.current?.abort?.();
  }, []);

  // Voices load asynchronously in most browsers; warm them up.
  useEffect(() => {
    if (!open || !ttsSupported) return;
    const warm = () => pickVoice(locale);
    warm();
    window.speechSynthesis.onvoiceschanged = warm;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, [open, locale, ttsSupported]);

  const speakReply = useCallback(
    (text: string) => {
      if (muted || !ttsSupported) {
        setStatus('ready');
        return;
      }
      stopSpeakRef.current?.();
      stopSpeakRef.current = speak({
        text,
        locale,
        onStart: () => setStatus('speaking'),
        onEnd: () => setStatus('ready'),
        onError: () => setStatus('ready'),
      });
    },
    [muted, ttsSupported, locale],
  );

  const callAssistant = useCallback(
    async (message: string, spoken = false) => {
      const trimmed = message.trim();
      if (!trimmed || busy) return;

      const userTurn: Turn = { id: `u-${Date.now()}`, role: 'user', text: trimmed, spoken };
      setTurns((prev) => [...prev, userTurn]);
      setInput('');
      setBusy(true);
      setStatus('thinking');
      stopSpeaking();

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch('/api/assistant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            message: trimmed,
            lang,
            origin: hasLocation
              ? {
                  lat: location.lat,
                  lng: location.lng,
                  label: location.label,
                  source: location.source,
                  accuracyM: location.accuracyM,
                }
              : null,
            history: turns
              .filter((turn) => !turn.error)
              .slice(-10)
              .map((turn) => ({ role: turn.role, text: turn.text })),
          }),
        });

        const data = (await res.json()) as AssistantResponse & { error?: string; code?: string };
        if (!res.ok || data.error) {
          throw new Error(data.error ?? 'Assistant request failed');
        }

        setTurns((prev) => [
          ...prev,
          { id: `a-${Date.now()}`, role: 'assistant', text: data.reply, response: data },
        ]);

        if (voiceMode || spoken) speakReply(data.reply);
        else setStatus('ready');
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setTurns((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: 'assistant',
            text:
              'I could not reach the assistant service just now. Hospital search, comparison and travel times still work from the menu. If this is an emergency, call 112 immediately.',
            error: true,
          },
        ]);
        setStatus('ready');
      } finally {
        setBusy(false);
      }
    },
    [busy, lang, hasLocation, location, turns, voiceMode, speakReply],
  );

  const startListening = useCallback(() => {
    if (!voiceSupported) {
      setVoiceNote(strings.voiceUnsupported);
      return;
    }
    if (!voiceVerifiedForLang) {
      setVoiceNote(
        `Voice input has not been verified for ${meta.name} yet — please type instead, or switch to a language with verified voice support.`,
      );
      return;
    }
    const Ctor = getSpeechRecognition();
    if (!Ctor) {
      setVoiceNote(strings.voiceUnsupported);
      return;
    }

    stopSpeaking();
    setVoiceNote(null);
    setStatus('listening');
    setInterim('');

    const recognition = new Ctor();
    recognition.lang = locale;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let finalText = '';
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const transcript = result[0]?.transcript ?? '';
        if (result.isFinal) finalText += transcript;
        else interimText += transcript;
      }
      if (interimText) setInterim(interimText);
      if (finalText.trim()) {
        setInterim('');
        recognition.stop();
        void callAssistant(finalText.trim(), true);
      }
    };
    recognition.onerror = (event) => {
      setStatus('ready');
      setInterim('');
      const code = event?.error;
      setVoiceNote(
        code === 'not-allowed' || code === 'service-not-allowed'
          ? 'Microphone permission was denied. You can type your question instead — nothing is recorded.'
          : code === 'no-speech'
            ? 'I did not catch that. Try again, or type your question.'
            : 'Voice input had a problem. You can type your question instead.',
      );
    };
    recognition.onend = () => {
      setInterim('');
      setStatus((s) => (s === 'listening' ? 'ready' : s));
    };
    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch {
      setStatus('ready');
      setVoiceNote('Voice input could not start. Please type your question.');
    }
  }, [voiceSupported, voiceVerifiedForLang, locale, meta.name, strings.voiceUnsupported, callAssistant]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop?.();
    setInterim('');
    setStatus('ready');
  }, []);

  const interruptSpeech = useCallback(() => {
    stopSpeaking();
    stopSpeakRef.current = null;
    setStatus('ready');
  }, []);

  /** Voice conversation: try Gemini Live, otherwise verified speech + Gemini text. */
  const startVoiceConversation = useCallback(async () => {
    if (!voiceSupported) {
      setVoiceNote(strings.voiceUnsupported);
      return;
    }
    setVoiceMode(true);
    setStatus('connecting');
    setVoiceNote(null);
    try {
      const res = await fetch('/api/assistant/voice-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lang }),
      });
      const data = (await res.json()) as VoiceTokenResponse;
      if (!data.available) {
        setLiveSession('unavailable');
        setVoiceNote(
          data.message ??
            'Live voice streaming is unavailable, so I will use your device’s speech recognition and read replies aloud.',
        );
        setStatus('ready');
        startListening();
        return;
      }
      // A token was minted: the Live session is genuinely available.
      setLiveSession('active');
      setVoiceNote('Gemini Live audio session ready.');
      setStatus('ready');
      startListening();
    } catch {
      setLiveSession('unavailable');
      setStatus('ready');
      setVoiceNote('Live voice is unavailable right now. Falling back to speech recognition with spoken replies.');
      startListening();
    }
  }, [voiceSupported, strings.voiceUnsupported, lang, startListening]);

  const endConversation = useCallback(() => {
    stopSpeaking();
    recognitionRef.current?.abort?.();
    abortRef.current?.abort();
    setVoiceMode(false);
    setStatus('ready');
    setInterim('');
    setLiveSession('idle');
  }, []);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void callAssistant(input);
  };

  const chips = useMemo(
    () => [
      { label: strings.chipFind, value: lang === 'hi' ? 'मेरे पास के अस्पताल खोजें' : 'Find nearby hospitals' },
      { label: strings.chipCompare, value: lang === 'hi' ? 'अस्पतालों की तुलना करें' : 'Compare hospitals' },
      { label: strings.chipTravel, value: lang === 'hi' ? 'AIIMS तक कितना समय लगेगा?' : 'Check travel time' },
      { label: strings.chipHealth, value: lang === 'hi' ? 'मुझे सिरदर्द है' : 'Ask a health question' },
    ],
    [strings, lang],
  );

  const statusLabel =
    status === 'listening'
      ? strings.statusListening
      : status === 'thinking'
        ? strings.statusThinking
        : status === 'speaking'
          ? strings.statusSpeaking
          : status === 'connecting'
            ? strings.statusConnecting
            : strings.statusReady;

  const statusColor =
    status === 'listening'
      ? 'bg-red-600'
      : status === 'thinking'
        ? 'bg-amber-500'
        : status === 'speaking'
          ? 'bg-emerald-600'
          : status === 'connecting'
            ? 'bg-sky-600'
            : 'bg-emerald-600';

  return (
    <div className="fixed bottom-4 right-4 z-50 print-hidden" data-testid="assistant-root">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          data-testid="assistant-open-btn"
          aria-label={strings.title}
          className="flex items-center gap-2.5 rounded-full bg-brand-800 hover:bg-brand-900 text-white font-extrabold px-5 py-3.5 shadow-2xl border-2 border-white transition-transform hover:scale-[1.02] min-h-[52px]"
        >
          <Sparkles size={22} aria-hidden="true" />
          <span className="text-sm">{strings.title}</span>
        </button>
      ) : (
        <section
          role="dialog"
          aria-modal="false"
          aria-label={strings.title}
          data-testid="assistant-panel"
          dir={meta.dir}
          className="w-[calc(100vw-1rem)] sm:w-[420px] h-[calc(100dvh-1rem)] sm:h-auto sm:max-h-[84vh] flex flex-col rounded-3xl border-2 border-brand-200 bg-white shadow-2xl overflow-hidden"
        >
          {/* ── Header ── */}
          <header className="bg-brand-900 text-white px-4 py-3 flex items-center justify-between gap-2 shrink-0">
            <div className="min-w-0">
              <h2 className="font-extrabold text-sm leading-tight flex items-center gap-2">
                <Sparkles size={17} aria-hidden="true" /> {strings.title}
              </h2>
              <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-brand-100">
                <span className={`h-1.5 w-1.5 rounded-full ${statusColor}`} aria-hidden="true" />
                <span data-testid="assistant-status" aria-live="polite">{statusLabel}</span>
                {status === 'speaking' && <Waveform active bars={4} />}
              </p>
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              <button
                type="button"
                onClick={() => setShowLangPicker((v) => !v)}
                aria-label="Change assistant language"
                aria-expanded={showLangPicker}
                className="rounded-lg p-1.5 text-brand-100 hover:text-white hover:bg-white/10"
              >
                <Languages size={18} />
              </button>
              <button
                type="button"
                onClick={() => { setOpen(false); endConversation(); }}
                aria-label={strings.close}
                data-testid="assistant-close"
                className="rounded-lg p-1.5 text-brand-100 hover:text-white hover:bg-white/10"
              >
                <X size={19} />
              </button>
            </div>
          </header>

          {showLangPicker && (
            <div className="bg-brand-50 border-b border-brand-100 px-2 py-2 grid grid-cols-3 gap-1 max-h-36 overflow-y-auto shrink-0">
              {SUPPORTED_LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => { setLang(l.code); setShowLangPicker(false); }}
                  aria-pressed={l.code === lang}
                  className={`rounded-lg px-2 py-1.5 text-[11px] font-semibold border ${
                    l.code === lang
                      ? 'bg-brand-700 text-white border-brand-700'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-brand-400'
                  }`}
                >
                  {l.nativeName}
                </button>
              ))}
            </div>
          )}

          {/* Emergency strip — always visible, never in the way */}
          <div className="bg-red-50 border-b border-red-100 px-3.5 py-1.5 text-[11px] text-red-900 flex items-center justify-between gap-2 shrink-0">
            <span className="flex items-center gap-1 font-semibold">
              <AlertTriangle size={12} className="text-red-700 shrink-0" aria-hidden="true" />
              {strings.emergencyBanner}
            </span>
            <a href="tel:112" className="font-extrabold text-red-700 underline inline-flex items-center gap-1">
              <PhoneCall size={11} /> 112
            </a>
          </div>

          {/* ── Transcript ── */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-3.5 space-y-3 bg-cream/60 min-h-[220px]"
            aria-live="polite"
            aria-label={strings.transcript}
          >
            {turns.length === 0 && (
              <div className="space-y-2.5">
                <p className="text-xs text-slate-600 bg-white border border-brand-100 rounded-2xl p-3 leading-relaxed">
                  {lang === 'hi'
                    ? 'नमस्ते! मैं JeevanSetu AI सहायक हूं। आप मुझसे सामान्य स्वास्थ्य जानकारी, अस्पताल, यात्रा समय या साइट के उपयोग के बारे में पूछ सकते हैं — टाइप करके या बोलकर।'
                    : "Hi! I'm the JeevanSetu AI Assistant. Ask me about general health information, hospitals, travel times, or how to use the site — by typing or by voice."}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {chips.map((chip) => (
                    <button
                      key={chip.label}
                      type="button"
                      onClick={() => void callAssistant(chip.value)}
                      className="text-left text-xs font-semibold rounded-xl bg-brand-50 hover:bg-brand-100 text-brand-900 border border-brand-200 px-3 py-2 transition-colors"
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {turns.map((turn) => (
              <div key={turn.id} className={`flex flex-col ${turn.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div
                  className={`rounded-2xl px-3.5 py-2.5 text-xs sm:text-[13px] leading-relaxed whitespace-pre-line max-w-[92%] ${
                    turn.role === 'user'
                      ? 'bg-brand-700 text-white font-medium'
                      : turn.error
                        ? 'bg-amber-50 border border-amber-300 text-amber-950'
                        : 'bg-white border border-slate-200 text-slate-800 shadow-sm'
                  }`}
                  data-testid={turn.role === 'assistant' ? 'assistant-message' : 'user-message'}
                >
                  {turn.text}
                </div>

                {turn.role === 'user' && turn.spoken && (
                  <span className="mt-0.5 text-[10px] text-slate-400 flex items-center gap-1">
                    <Mic size={9} /> {strings.transcript}
                  </span>
                )}

                {/* Grounded hospital cards — same Google numbers as everywhere else */}
                {turn.response?.hospitals && turn.response.hospitals.length > 0 && (
                  <div className="mt-2 w-full space-y-1.5">
                    {turn.response.hospitals.map((h, idx) => {
                      const driving = formatDrivingKm(h.distanceKm, lang);
                      return (
                        <div
                          key={h.id}
                          className="rounded-xl border border-brand-100 bg-white p-2.5 text-xs shadow-sm flex items-center justify-between gap-2"
                          data-testid={`assistant-hospital-${h.id}`}
                        >
                          <div className="min-w-0">
                            <Link
                              href={`/hospitals/${h.id}`}
                              onClick={() => setOpen(false)}
                              className="font-extrabold text-brand-900 hover:underline block truncate"
                            >
                              {idx + 1}. {h.shortName}
                            </Link>
                            <p className="text-[11px] text-slate-500 flex flex-wrap items-center gap-1.5 mt-0.5">
                              <span className="inline-flex items-center gap-0.5">
                                <MapPin size={10} aria-hidden="true" />
                                {driving ?? ds.distanceUnavailable}
                              </span>
                              {typeof h.etaMinutes === 'number' && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="inline-flex items-center gap-0.5">
                                    <Clock size={10} aria-hidden="true" /> ~{formatDuration(h.etaMinutes, lang)}
                                  </span>
                                </>
                              )}
                              {typeof h.trafficImpactMinutes === 'number' && h.trafficImpactMinutes > 0 && (
                                <span className="text-amber-800 font-semibold">
                                  +{h.trafficImpactMinutes} min
                                </span>
                              )}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {h.phone && (
                              <a
                                href={`tel:${h.phone}`}
                                aria-label={`Call ${h.shortName}`}
                                className="rounded-lg bg-slate-100 text-slate-700 p-1.5 hover:bg-slate-200"
                              >
                                <PhoneCall size={12} />
                              </a>
                            )}
                            <Link
                              href={`/hospitals/${h.id}`}
                              onClick={() => setOpen(false)}
                              className="rounded-lg bg-brand-50 text-brand-800 font-bold px-2 py-1.5 hover:bg-brand-100"
                            >
                              {t('viewDetails')}
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Comparison table */}
                {turn.response?.comparison && (
                  <div className="mt-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <table className="w-full text-[11px]">
                      <tbody>
                        {turn.response.comparison.map((row) => (
                          <tr key={row.label} className="border-b border-slate-100 last:border-0">
                            <th scope="row" className="px-2 py-1.5 text-left font-bold text-slate-500 w-[38%]">
                              {row.label}
                            </th>
                            <td className="px-2 py-1.5 text-slate-800">{row.aValue}</td>
                            <td className="px-2 py-1.5 text-slate-800">{row.bValue}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Cost ranges */}
                {turn.response?.costs && turn.response.costs.length > 0 && (
                  <div className="mt-2 w-full space-y-1">
                    {turn.response.costs.map((c) => (
                      <div key={c.treatmentName} className="rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-[11px]">
                        <p className="font-bold text-slate-800">{c.treatmentName}</p>
                        <p className="text-slate-600">
                          Govt {c.govtRange} · Private {c.privateRange}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Next-step actions, opt-in only */}
                {turn.response?.actions?.some((a) => a.type === 'request-location') && (
                  <button
                    type="button"
                    onClick={() => { setOpen(false); window.location.href = '/hospitals'; }}
                    className="mt-1.5 inline-flex items-center gap-1 rounded-lg bg-brand-50 border border-brand-200 px-2.5 py-1.5 text-[11px] font-bold text-brand-900 hover:bg-brand-100"
                  >
                    <MapPin size={11} /> Share my location on the hospitals page
                    <ChevronRight size={11} />
                  </button>
                )}
                {turn.response?.actions?.some((a) => a.type === 'open-compare') && (
                  <Link
                    href="/compare"
                    onClick={() => setOpen(false)}
                    className="mt-1.5 inline-flex items-center gap-1 rounded-lg bg-brand-50 border border-brand-200 px-2.5 py-1.5 text-[11px] font-bold text-brand-900 hover:bg-brand-100"
                  >
                    <Route size={11} /> Open full comparison <ChevronRight size={11} />
                  </Link>
                )}
                {turn.response?.actions?.some((a) => a.type === 'open-emergency') && (
                  <Link
                    href="/emergency"
                    onClick={() => setOpen(false)}
                    className="mt-1.5 inline-flex items-center gap-1 rounded-lg bg-red-50 border border-red-300 px-2.5 py-1.5 text-[11px] font-bold text-red-800 hover:bg-red-100"
                  >
                    <Siren size={11} /> Nearest 24×7 emergency hospitals <ChevronRight size={11} />
                  </Link>
                )}

                {/* Honest source note */}
                {turn.response && turn.response.groundingMode === 'deterministic-grounded' && (
                  <p className="mt-1 text-[10px] text-amber-800 px-1">
                    {turn.response.blockers[0] ??
                      'Answered from JeevanSetu’s grounded rule engine (Gemini unavailable).'}
                  </p>
                )}
                {turn.response?.groundingMode === 'gemini-grounded' && (
                  <p className="mt-1 text-[10px] text-slate-400 px-1">{strings.poweredBy}</p>
                )}
                {turn.response && (
                  <p className="mt-0.5 text-[10px] text-slate-400 px-1">{turn.response.disclaimer}</p>
                )}
              </div>
            ))}

            {interim && (
              <div className="flex flex-col items-end">
                <div className="rounded-2xl bg-brand-700/60 text-white px-3.5 py-2.5 text-xs italic max-w-[92%]">
                  {interim}
                </div>
              </div>
            )}

            {busy && (
              <div className="inline-flex items-center gap-2 rounded-2xl bg-white border border-slate-200 px-3.5 py-2 text-xs text-slate-500">
                <Loader2 size={14} className="animate-spin text-brand-700" aria-hidden="true" />
                {strings.statusThinking}
              </div>
            )}

            {voiceNote && (
              <p className="rounded-xl bg-amber-50 border border-amber-200 px-2.5 py-2 text-[11px] text-amber-900">
                {voiceNote}
              </p>
            )}
          </div>

          {/* ── Controls ── */}
          <div className="border-t border-slate-200 bg-white px-2.5 pt-2 pb-2.5 shrink-0">
            <div className="flex items-center justify-center gap-2 mb-2">
              <button
                type="button"
                onClick={status === 'listening' ? stopListening : startListening}
                disabled={!voiceSupported || busy}
                aria-pressed={status === 'listening'}
                aria-label={strings.mic}
                data-testid="assistant-mic"
                title={voiceSupported ? strings.mic : strings.voiceUnsupported}
                className={`rounded-full p-3 min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors ${
                  status === 'listening'
                    ? 'bg-red-600 text-white shadow-lg'
                    : 'bg-brand-50 text-brand-800 hover:bg-brand-100 disabled:opacity-40'
                }`}
              >
                {status === 'listening' ? <Square size={18} className="fill-current" /> : <Mic size={18} />}
              </button>

              <button
                type="button"
                onClick={voiceMode ? endConversation : startVoiceConversation}
                disabled={!voiceSupported}
                aria-pressed={voiceMode}
                aria-label={voiceMode ? strings.end : 'Start voice conversation'}
                data-testid="assistant-voice-mode"
                title={voiceMode ? strings.end : 'Voice conversation'}
                className={`rounded-full px-3 py-3 min-h-[44px] text-xs font-bold flex items-center gap-1.5 transition-colors ${
                  voiceMode ? 'bg-emerald-700 text-white' : 'bg-emerald-50 text-emerald-900 hover:bg-emerald-100 disabled:opacity-40'
                }`}
              >
                {liveSession === 'active' ? <Sparkles size={15} /> : <Volume2 size={15} />}
                <span className="hidden sm:inline">{voiceMode ? strings.end : 'Talk'}</span>
              </button>

              {status === 'speaking' && (
                <button
                  type="button"
                  onClick={interruptSpeech}
                  aria-label="Stop speaking"
                  className="rounded-full bg-slate-100 text-slate-700 p-3 min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-slate-200"
                >
                  <Square size={16} className="fill-current" />
                </button>
              )}

              <button
                type="button"
                onClick={() => { setMuted((m) => !m); if (!muted) stopSpeaking(); }}
                aria-pressed={muted}
                aria-label={strings.speaker}
                data-testid="assistant-mute"
                className={`rounded-full p-3 min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors ${
                  muted ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>

              <button
                type="button"
                onClick={endConversation}
                aria-label={strings.end}
                className="rounded-full bg-slate-100 text-slate-700 p-3 min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-slate-200"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={onSubmit} className="flex items-center gap-1.5">
              <Keyboard size={16} className="text-slate-400 shrink-0 ml-1" aria-hidden="true" />
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={strings.placeholder}
                maxLength={900}
                aria-label={strings.placeholder}
                data-testid="assistant-input"
                className="flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-xs sm:text-sm focus:border-brand-600 focus:outline-none min-h-[42px]"
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                aria-label={strings.send}
                data-testid="assistant-send"
                className="rounded-xl bg-brand-700 hover:bg-brand-800 disabled:opacity-50 text-white p-2.5 min-h-[42px] min-w-[42px] flex items-center justify-center"
              >
                {busy ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
              </button>
            </form>

            <div className="mt-1 flex items-center justify-between gap-2 px-1">
              <span className="text-[9px] text-slate-400 flex items-center gap-1">
                <MessageSquareText size={9} /> {strings.subtitle}
              </span>
              {!voiceSupported && (
                <span className="text-[9px] text-amber-700 inline-flex items-center gap-1">
                  <MicOff size={9} /> {strings.voiceUnsupported}
                </span>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
