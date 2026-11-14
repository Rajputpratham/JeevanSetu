'use client';
import { FormEvent, useRef, useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  MessageSquareHeart, X, Send, Loader2, PhoneCall, MapPin, Clock, Star, ShieldAlert,
} from 'lucide-react';
import { useLang } from '@/lib/i18n';
import { useUserLocation } from '@/lib/useLocation';
import { formatDistance, formatDuration } from '@/lib/geo';
import VoiceSearchButton from './VoiceSearchButton';
import type { ChatHospitalCard } from '@/lib/chatbot';

interface ChatTurn {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  hospitals?: ChatHospitalCard[];
  costEstimate?: {
    treatmentName: string;
    govtRange: string;
    privateRange: string;
  };
  disclaimer?: string;
}

const QUICK_PROMPTS: Record<string, string[]> = {
  en: [
    'Show nearby government hospitals',
    'Nearest 24x7 emergency hospital & travel time',
    'Estimated cost of normal delivery',
  ],
  hi: [
    'पास के सरकारी अस्पताल दिखाएं',
    'नज़दीकी 24×7 आपातकालीन अस्पताल और समय',
    'सामान्य प्रसव का अनुमानित खर्च कितना है?',
  ],
  bn: [
    'কাছাকাছি সরকারি হাসপাতাল দেখান',
    'নিকটবর্তী জরুরি হাসপাতাল ও যাতায়াতের সময়',
    'স্বাভাবিক প্রসবের আনুমানিক খরচ কত?',
  ],
  ta: [
    'அருகிலுள்ள அரசு மருத்துவமனைகளைக் காட்டு',
    'அருகிலுள்ள அவசர மருத்துவமனை மற்றும் பயண நேரம்',
    'சிகிச்சை செலவு மதிப்பீடு என்ன?',
  ],
  ur: [
    'قریبی سرکاری اسپتال دکھائیں',
    'قریبی ایمرجنسی اسپتال اور سفر کا وقت',
    'نارمل ڈلیوری کا متوقع خرچ کیا ہے؟',
  ],
};

export default function ChatbotWidget() {
  const { t, lang } = useLang();
  const { location } = useUserLocation();
  const pathname = usePathname();

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Detect if user is currently viewing a hospital profile page (/hospitals/[id])
  const focusedHospitalId = pathname?.startsWith('/hospitals/')
    ? pathname.replace('/hospitals/', '').split('/')[0]
    : undefined;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [turns, open]);

  const sendMessage = async (rawText: string) => {
    const trimmed = rawText.trim();
    if (!trimmed || busy) return;
    const userTurn: ChatTurn = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: trimmed,
    };
    setTurns((prev) => [...prev, userTurn]);
    setInput('');
    setBusy(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          lang,
          lat: location.lat,
          lng: location.lng,
          focusedHospitalId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Chat failed');
      }
      const botTurn: ChatTurn = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        text: data.reply,
        hospitals: data.recommendedHospitals,
        costEstimate: data.costEstimate,
        disclaimer: data.disclaimer,
      };
      setTurns((prev) => [...prev, botTurn]);
    } catch {
      setTurns((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          text: 'Could not reach assistant right now. For emergencies call 112 immediately, or use Find Hospitals.',
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const suggestions = QUICK_PROMPTS[lang] ?? QUICK_PROMPTS.en;

  return (
    <div className="fixed bottom-4 right-4 z-50 print-hidden">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          data-testid="chatbot-open-btn"
          aria-label={t('chatTitle')}
          className="flex items-center gap-2.5 rounded-full bg-brand-800 hover:bg-brand-900 text-white font-extrabold px-5 py-3.5 shadow-2xl border-2 border-white transition-transform hover:scale-[1.02] min-h-[52px]"
        >
          <MessageSquareHeart size={22} />
          <span className="text-sm">{t('chatTitle')}</span>
        </button>
      ) : (
        <section
          aria-label={t('chatTitle')}
          data-testid="chatbot-panel"
          className="w-[calc(100vw-2rem)] sm:w-[400px] max-h-[80vh] flex flex-col rounded-3xl border-2 border-brand-200 bg-white shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="bg-brand-900 text-white px-4 py-3.5 flex items-center justify-between gap-2">
            <div>
              <h2 className="font-extrabold text-sm leading-tight flex items-center gap-2">
                <MessageSquareHeart size={18} /> {t('chatTitle')}
              </h2>
              <p className="text-[11px] text-brand-100 mt-0.5">{t('chatSubtitle')}</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close assistant"
              className="rounded-lg p-1.5 text-brand-100 hover:text-white hover:bg-white/10"
            >
              <X size={20} />
            </button>
          </div>

          {/* Emergency reminder banner */}
          <div className="bg-red-50 border-b border-red-100 px-3.5 py-1.5 text-[11px] text-red-900 flex items-center justify-between gap-2">
            <span className="flex items-center gap-1 font-semibold">
              <ShieldAlert size={13} className="text-red-700 shrink-0" /> Not medical advice
            </span>
            <a href="tel:112" className="font-extrabold text-red-700 underline inline-flex items-center gap-1">
              <PhoneCall size={11} /> 112
            </a>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3.5 space-y-3 bg-cream/60 min-h-[260px] max-h-[420px]">
            {turns.length === 0 && (
              <div className="space-y-2.5">
                <p className="text-xs text-slate-600 bg-white border border-brand-100 rounded-2xl p-3 leading-relaxed">
                  Ask in your chosen language about nearby government/private hospitals, road travel time, or indicative treatment costs. Responses strictly use verified JeevanSetu data.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {suggestions.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => sendMessage(prompt)}
                      className="text-left text-xs font-semibold rounded-xl bg-brand-50 hover:bg-brand-100 text-brand-900 border border-brand-200 px-3 py-2 transition-colors"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {turns.map((turn) => (
              <div
                key={turn.id}
                className={`flex flex-col ${turn.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`rounded-2xl px-3.5 py-2.5 text-xs sm:text-[13px] leading-relaxed whitespace-pre-line max-w-[92%] ${
                    turn.role === 'user'
                      ? 'bg-brand-700 text-white font-medium'
                      : 'bg-white border border-slate-200 text-slate-800 shadow-sm'
                  }`}
                >
                  {turn.text}
                </div>

                {/* Grounded Hospital Cards */}
                {turn.hospitals && turn.hospitals.length > 0 && (
                  <div className="mt-2 w-full space-y-1.5">
                    {turn.hospitals.map((h) => (
                      <div
                        key={h.id}
                        className="rounded-xl border border-brand-100 bg-white p-2.5 text-xs shadow-sm flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <Link
                            href={`/hospitals/${h.id}`}
                            onClick={() => setOpen(false)}
                            className="font-extrabold text-brand-900 hover:underline block truncate"
                          >
                            {h.shortName}
                          </Link>
                          <p className="text-[11px] text-slate-500 flex flex-wrap items-center gap-1.5 mt-0.5">
                            <span className="inline-flex items-center gap-0.5">
                              <MapPin size={11} /> {formatDistance(h.roadKm, lang)}
                            </span>
                            ·
                            <span className="inline-flex items-center gap-0.5">
                              <Clock size={11} /> ~{formatDuration(h.etaMinutes, lang)}
                            </span>
                            {h.imdbScore && (
                              <span className="inline-flex items-center gap-0.5 text-amber-800 font-bold">
                                · <Star size={10} className="fill-amber-500 text-amber-500" /> {h.imdbScore}/10
                              </span>
                            )}
                          </p>
                        </div>
                        <Link
                          href={`/hospitals/${h.id}`}
                          onClick={() => setOpen(false)}
                          className="shrink-0 rounded-lg bg-brand-50 text-brand-800 font-bold px-2.5 py-1.5 hover:bg-brand-100"
                        >
                          {t('viewDetails')}
                        </Link>
                      </div>
                    ))}
                  </div>
                )}

                {turn.disclaimer && (
                  <p className="mt-1 text-[10px] text-slate-400 px-1">{turn.disclaimer}</p>
                )}
              </div>
            ))}

            {busy && (
              <div className="inline-flex items-center gap-2 rounded-2xl bg-white border border-slate-200 px-3.5 py-2 text-xs text-slate-500">
                <Loader2 size={14} className="animate-spin text-brand-700" /> Checking JeevanSetu dataset…
              </div>
            )}
          </div>

          {/* Input */}
          <form onSubmit={onSubmit} className="border-t border-slate-200 bg-white p-2.5 flex items-center gap-1.5">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t('chatPlaceholder')}
              maxLength={400}
              className="flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-xs sm:text-sm focus:border-brand-600 focus:outline-none min-h-[42px]"
            />
            <VoiceSearchButton onTranscript={(txt) => setInput(txt)} />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              aria-label={t('chatSend')}
              className="rounded-xl bg-brand-700 hover:bg-brand-800 disabled:opacity-50 text-white p-2.5 min-h-[42px] min-w-[42px] flex items-center justify-center"
            >
              <Send size={17} />
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
