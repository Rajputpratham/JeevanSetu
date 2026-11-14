'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { useLang, getLangMeta } from '@/lib/i18n';

interface Props {
  onTranscript: (text: string) => void;
  className?: string;
}

interface SpeechRecognitionInstance {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: { 0: { transcript: string } }[] }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

export default function VoiceSearchButton({ onTranscript, className = '' }: Props) {
  const { t, lang } = useLang();
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRecognitionInstance | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionInstance;
      webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
    };
    setSupported(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);

  const toggleVoice = useCallback(() => {
    if (typeof window === 'undefined') return;
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionInstance;
      webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
    };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) return;

    if (listening && recRef.current) {
      recRef.current.stop();
      setListening(false);
      return;
    }

    try {
      const rec = new Ctor();
      rec.lang = getLangMeta(lang).speechLocale;
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.onresult = (event) => {
        const transcript = event?.results?.[0]?.[0]?.transcript?.trim();
        if (transcript) {
          onTranscript(transcript);
        }
        setListening(false);
      };
      rec.onerror = () => setListening(false);
      rec.onend = () => setListening(false);
      recRef.current = rec;
      setListening(true);
      rec.start();
    } catch {
      setListening(false);
    }
  }, [lang, listening, onTranscript]);

  if (!supported) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={toggleVoice}
      aria-label={t('voiceSearchAria')}
      aria-pressed={listening}
      title={`${t('voiceSearchAria')} (${getLangMeta(lang).nativeName})`}
      className={`inline-flex items-center justify-center rounded-xl p-2.5 min-h-[40px] min-w-[40px] transition-colors ${
        listening
          ? 'bg-red-600 text-white animate-pulse'
          : 'text-slate-500 hover:text-brand-800 hover:bg-brand-50'
      } ${className}`}
    >
      {listening ? <MicOff size={18} /> : <Mic size={18} />}
    </button>
  );
}
