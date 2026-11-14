'use client';
import Image from 'next/image';
import Link from 'next/link';
import {
  MapPin, Sparkles, Calculator, GitCompareArrows, FileText, Siren,
  ChevronRight, ShieldCheck, Languages, Wifi, HeartPulse,
} from 'lucide-react';
import QuickSearch from '@/components/home/QuickSearch';
import NearbySection from '@/components/home/NearbySection';
import { useLang, DictKey } from '@/lib/i18n';

const FEATURES: {
  icon: typeof MapPin;
  titleKey: DictKey;
  descKey: DictKey;
  ctaKey: DictKey;
  href: string;
  tint: string;
}[] = [
  {
    icon: MapPin, titleKey: 'feat1Title', descKey: 'feat1Desc', ctaKey: 'feat1Cta',
    href: '/hospitals', tint: 'bg-green-100 text-green-800',
  },
  {
    icon: Sparkles, titleKey: 'feat2Title', descKey: 'feat2Desc', ctaKey: 'feat2Cta',
    href: '/recommendations', tint: 'bg-teal-100 text-teal-800',
  },
  {
    icon: Calculator, titleKey: 'feat3Title', descKey: 'feat3Desc', ctaKey: 'feat3Cta',
    href: '/cost-estimator', tint: 'bg-amber-100 text-amber-800',
  },
  {
    icon: GitCompareArrows, titleKey: 'feat4Title', descKey: 'feat4Desc', ctaKey: 'feat4Cta',
    href: '/compare', tint: 'bg-sky-100 text-sky-800',
  },
  {
    icon: FileText, titleKey: 'rankingsTitle', descKey: 'rankingsSub', ctaKey: 'navRankings',
    href: '/rankings', tint: 'bg-emerald-100 text-emerald-800',
  },
  {
    icon: Siren, titleKey: 'feat6Title', descKey: 'feat6Desc', ctaKey: 'feat6Cta',
    href: '/emergency', tint: 'bg-red-100 text-red-800',
  },
];

const FAQ_KEYS: { q: DictKey; a: DictKey }[] = [
  { q: 'faq1Q', a: 'faq1A' },
  { q: 'faq2Q', a: 'faq2A' },
  { q: 'faq3Q', a: 'faq3A' },
  { q: 'faq4Q', a: 'faq4A' },
  { q: 'faq5Q', a: 'faq5A' },
];

export default function HomeClient() {
  const { t } = useLang();

  return (
    <>
      {/* ─── HERO ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-50 via-cream to-cream" aria-hidden="true" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-8 pb-12 lg:pt-14 lg:pb-16 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white border border-brand-200 text-brand-800 text-[11px] sm:text-xs font-bold px-4 py-2 shadow-sm">
              <HeartPulse size={14} className="text-brand-600" /> {t('heroBadge')}
            </span>
            <h1 className="mt-4 text-4xl sm:text-5xl xl:text-6xl font-black tracking-tight text-brand-950 leading-[1.08]">
              {t('heroTitleLine1')}<br />
              <span className="text-brand-700">{t('heroTitleLine2')}</span>
            </h1>
            <p className="mt-4 text-lg text-slate-700 max-w-lg leading-snug">
              {t('heroSub')}
            </p>
            <div className="mt-6 flex flex-col sm:flex-row flex-wrap gap-3">
              <Link href="/hospitals" className="btn-primary text-base !px-6 !py-4 !min-h-[56px]">
                <MapPin size={21} strokeWidth={2.5} /> {t('heroBtnFind')}
              </Link>
              <Link href="/emergency" className="btn-danger text-base !px-6 !py-4 !min-h-[56px]">
                <Siren size={21} strokeWidth={2.5} /> {t('heroBtnEmergency')}
              </Link>
            </div>
            <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1.5"><ShieldCheck size={14} className="text-brand-700" /> {t('heroTrustNoSignup')}</span>
              <span className="inline-flex items-center gap-1.5"><Wifi size={14} className="text-brand-700" /> {t('heroTrust3G')}</span>
              <span className="inline-flex items-center gap-1.5"><Languages size={14} className="text-brand-700" /> {t('heroTrustLang')}</span>
            </p>
          </div>
          <div className="relative">
            <div className="rounded-3xl overflow-hidden border-4 border-white shadow-2xl">
              <Image
                src="/images/hero-doctor-family.jpg"
                alt={t('heroImageAlt')}
                width={880}
                height={640}
                priority
                className="object-cover w-full h-[340px] sm:h-[420px] lg:h-[480px]"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ─── QUICK SEARCH ─────────────────────────────────────── */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 -mt-2 lg:-mt-6 relative z-10">
        <QuickSearch />
      </div>

      {/* ─── LIVE NEARBY HOSPITALS ────────────────────────────── */}
      <NearbySection />

      {/* ─── SIX FEATURE CARDS ────────────────────────────────── */}
      <section aria-labelledby="features-heading" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-14 pb-8">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-700">{t('featuresEyebrow')}</p>
        <h2 id="features-heading" className="section-title mt-1">{t('sectionFeatures')}</h2>
        <p className="section-sub">{t('featuresSub')}</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, titleKey, descKey, ctaKey, href, tint }) => (
            <Link key={titleKey} href={href}
              className="card p-5 sm:p-6 flex flex-col group hover:shadow-lg hover:-translate-y-0.5 transition-all focus-visible:outline-none">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${tint}`}><Icon size={24} strokeWidth={2} /></div>
              <h3 className="mt-4 font-extrabold text-lg text-slate-900 leading-snug">{t(titleKey)}</h3>
              <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">{t(descKey)}</p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-extrabold text-brand-800 group-hover:gap-2.5 transition-all">
                {t(ctaKey)} <ChevronRight size={17} strokeWidth={2.5} />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ─── COMMON QUESTIONS (FAQ) ───────────────────────────── */}
      <section aria-labelledby="faq-heading" className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12">
        <h2 id="faq-heading" className="section-title">{t('faqHeading')}</h2>
        <div className="mt-5 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
          {FAQ_KEYS.map(({ q, a }) => (
            <details key={q} className="group px-5 py-4">
              <summary className="cursor-pointer list-none flex items-center justify-between gap-4 font-bold text-slate-900 min-h-[44px]">
                {t(q)}
                <ChevronRight size={18} className="shrink-0 transition-transform group-open:rotate-90" aria-hidden="true" />
              </summary>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">{t(a)}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
