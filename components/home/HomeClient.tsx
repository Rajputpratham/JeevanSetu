'use client';
import Image from 'next/image';
import Link from 'next/link';
import {
  MapPin, Sparkles, Calculator, GitCompareArrows, FileText, Siren,
  ChevronRight, HeartPulse,
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
  const { t, lang } = useLang();

  return (
    <>
      {/* ─── HERO ─────────────────────────────────────────────── */}
      <section className="care-hero">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-7 lg:pt-12 pb-7">
          <div className="grid items-center gap-7 lg:grid-cols-[1.05fr_1fr] lg:gap-12">
            <div>
              <p className="care-kicker"><span aria-hidden="true" />{t('heroBadge')}</p>
              <h1 className="care-headline mt-5">{t('heroTitleLine1')}<br/><em>{t('heroTitleLine2')}</em></h1>
              <p className="mt-5 max-w-lg text-base sm:text-lg leading-relaxed text-brand-900">{t('heroSub')}</p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link href="/hospitals" className="btn-primary"><MapPin size={18}/>{t('heroBtnFind')}</Link>
                <Link href="/emergency" className="btn bg-white border border-red-200 px-4 py-3 text-red-800 hover:bg-red-50"><Siren size={18}/> {t('heroBtnEmergency')}</Link>
              </div>
            </div>
            <figure className="care-portrait relative overflow-hidden">
              <Image src="/images/hero-doctor-family.jpg" alt={t('heroImageAlt')} width={880} height={640} sizes="(min-width:1024px) 48vw, 100vw" priority className="w-full object-cover aspect-[1.68]" />
              <figcaption className="absolute bottom-4 left-4 inline-flex items-center gap-2 rounded-full bg-white/95 px-3 py-2 text-xs font-semibold text-brand-900"><HeartPulse size={15}/>{lang === 'hi' ? 'परिवार स्वास्थ्य मार्गदर्शिका' : 'Family care guide'}</figcaption>
            </figure>
          </div>
          <div className="mt-7 lg:mt-9"><QuickSearch /></div>
        </div>
      </section>

      {/* ─── LIVE NEARBY HOSPITALS ────────────────────────────── */}
      <NearbySection />

      {/* ─── SIX FEATURE CARDS ────────────────────────────────── */}
      <section aria-labelledby="features-heading" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-8 pb-8">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-700">{t('featuresEyebrow')}</p>
        <h2 id="features-heading" className="section-title mt-1">{t('sectionFeatures')}</h2>
        <p className="section-sub">{t('featuresSub')}</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, titleKey, descKey, ctaKey, href, tint }) => (
            <Link key={titleKey} href={href}
              className="card p-4 flex items-center gap-4 group hover:border-brand-300 hover:bg-brand-50 transition-colors" title={t(descKey)}>
              <span className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center ${tint}`}><Icon size={21}/></span>
              <h3 className="font-bold text-base text-brand-900">{t(titleKey)}</h3><ChevronRight className="ms-auto shrink-0 text-brand-700" size={18} aria-label={t(ctaKey)}/>
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
