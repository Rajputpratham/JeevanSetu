import Image from 'next/image';
import Link from 'next/link';
import {
  MapPin, Sparkles, Calculator, GitCompareArrows, FileText, Siren,
  PhoneCall, ChevronRight, ShieldCheck, IndianRupee, Languages, Wifi, HeartPulse,
} from 'lucide-react';
import QuickSearch from '@/components/home/QuickSearch';
import NearbySection from '@/components/home/NearbySection';
import RecommendedSection from '@/components/home/RecommendedSection';
import CompareTeaser from '@/components/home/CompareTeaser';
import CostTeaser from '@/components/home/CostTeaser';
import EmergencyAssistance from '@/components/home/EmergencyAssistance';
import { HOSPITAL_COUNT, EMERGENCY_VERIFIED_COUNT } from '@/data/hospitals';
import { TREATMENT_COUNT } from '@/data/treatments';

const FEATURES = [
  {
    icon: MapPin, title: 'Nearby Hospital Discovery',
    desc: 'Detect your location or type your city — see government and private hospitals with distance, contact, map and one-tap directions.',
    cta: 'Find hospitals', href: '/hospitals', tint: 'bg-green-100 text-green-800',
  },
  {
    icon: Sparkles, title: 'Smart Recommendations',
    desc: 'Hospitals matched to your medical need, budget and facility requirements — every suggestion explained in plain words.',
    cta: 'Get recommendations', href: '/recommendations', tint: 'bg-teal-100 text-teal-800',
  },
  {
    icon: Calculator, title: 'Treatment Cost Estimator',
    desc: 'Itemised ₹ estimates — consultation, tests, procedure, room, medicines — government vs private. Indicative, honest, clearly labelled.',
    cta: 'Estimate cost', href: '/cost-estimator', tint: 'bg-amber-100 text-amber-800',
  },
  {
    icon: GitCompareArrows, title: 'Hospital Comparison',
    desc: 'Compare up to 3 hospitals side by side: distance, specialities, facilities, emergency care and approximate costs.',
    cta: 'Compare now', href: '/compare', tint: 'bg-sky-100 text-sky-800',
  },
  {
    icon: FileText, title: 'Detailed Hospital Information',
    desc: 'Full address, verified/unverified OPD timings, departments, facilities and costs — with honest “not listed” labels, never invented.',
    cta: 'Browse hospitals', href: '/hospitals', tint: 'bg-emerald-100 text-emerald-800',
  },
  {
    icon: Siren, title: 'Emergency Assistance',
    desc: 'Verified 24×7 emergency hospitals near you, direct call buttons, directions, and the national 112 helpline — always one tap away.',
    cta: 'Emergency help', href: '/emergency', tint: 'bg-red-100 text-red-800',
  },
];

const FAQ = [
  {
    q: 'Does JeevanSetu charge any fee?',
    a: 'No. JeevanSetu is free for patients and families. There is no sign-up, no premium plan and no booking fee. We may earn nothing from this platform — our only goal is that your family can make better healthcare decisions.',
  },
  {
    q: 'Are the hospitals listed really verified?',
    a: 'Hospital names, addresses and phone numbers come from public listings (hospital websites, government directories). Where we could not double-check a detail, we label it “Unverified” or “Not listed” — you will never see an invented phone number or a fake rating. Bed counts are approximate.',
  },
  {
    q: 'How accurate are the cost estimates?',
    a: 'Costs are indicative ranges compiled from public CGHS rate lists, PM-JAY package ceilings and published private tariffs. Real bills vary by city, hospital, room type and complications. Always ask the hospital for a written cost estimate before admission.',
  },
  {
    q: 'What should I do in a real emergency right now?',
    a: 'Call 112 (or 108/102 ambulance in most states) immediately — do not wait to browse this site. Then head to the nearest hospital with verified 24×7 emergency services. Our emergency page lists them near you.',
  },
  {
    q: 'Which languages does JeevanSetu support?',
    a: 'Key actions and menus are available in Hindi and English — use the हिं / EN toggle in the header. Detailed page content is currently in English. We are working towards full Hindi coverage.',
  },
];

export default function HomePage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'JeevanSetu',
    url: 'https://www.jeevansetu.in',
    description: 'Find nearby hospitals, compare facilities and estimate treatment costs across India.',
    potentialAction: {
      '@type': 'SearchAction',
      target: 'https://www.jeevansetu.in/hospitals?q={search_term_string}',
      'query-input': 'required name=search_term_string',
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* ─── HERO ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-50 via-cream to-cream" aria-hidden="true" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-8 pb-12 lg:pt-14 lg:pb-16 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white border border-brand-200 text-brand-800 text-[11px] sm:text-xs font-bold px-4 py-2 shadow-sm">
              <HeartPulse size={14} className="text-brand-600" /> Free · No account needed · Hindi &amp; English
            </span>
            <h1 className="mt-4 text-4xl sm:text-5xl xl:text-6xl font-black tracking-tight text-brand-950 leading-[1.08]">
              The Right Hospital,<br />
              <span className="text-brand-700">Closer to You.</span>
            </h1>
            <p className="mt-4 text-lg text-slate-700 max-w-lg leading-snug">
              Find nearby hospitals, understand treatment costs and make informed healthcare decisions for your family.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row flex-wrap gap-3">
              <Link href="/hospitals" className="btn-primary text-base !px-6 !py-4 !min-h-[56px]">
                <MapPin size={21} strokeWidth={2.5} /> Find Nearby Hospitals
              </Link>
              <Link href="/cost-estimator" className="btn-secondary text-base !px-6 !py-4 !min-h-[56px]">
                <Calculator size={21} strokeWidth={2.5} /> Estimate Treatment Cost
              </Link>
              <Link href="/emergency" className="btn-danger text-base !px-6 !py-4 !min-h-[56px]">
                <Siren size={21} strokeWidth={2.5} /> Emergency Assistance
              </Link>
            </div>
            <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1.5"><ShieldCheck size={14} className="text-brand-700" /> No sign-up</span>
              <span className="inline-flex items-center gap-1.5"><Wifi size={14} className="text-brand-700" /> Works on basic 3G phones</span>
              <span className="inline-flex items-center gap-1.5"><Languages size={14} className="text-brand-700" /> हिंदी + English</span>
            </p>
          </div>
          <div className="relative">
            <div className="rounded-3xl overflow-hidden border-4 border-white shadow-2xl">
              <Image
                src="/images/hero-doctor-family.jpg"
                alt="A doctor in a white coat consulting a rural Indian family inside a primary health centre"
                width={880}
                height={640}
                priority
                className="object-cover w-full h-[340px] sm:h-[420px] lg:h-[480px]"
              />
            </div>
            <div className="absolute -bottom-4 left-3 sm:left-6 bg-white rounded-2xl shadow-card border border-brand-100 px-4 py-3 flex items-center gap-3">
              <div className="rounded-xl bg-brand-50 p-2 text-brand-700"><MapPin size={22} /></div>
              <div>
                <p className="text-lg font-extrabold text-brand-900 leading-none">{HOSPITAL_COUNT} hospitals</p>
                <p className="text-[11px] text-slate-500 mt-1">listed across India · {EMERGENCY_VERIFIED_COUNT} with verified 24×7 emergency</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── QUICK SEARCH ─────────────────────────────────────── */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 -mt-2 lg:-mt-6 relative z-10">
        <QuickSearch />
      </div>

      {/* ─── SIX FEATURE CARDS ────────────────────────────────── */}
      <section aria-labelledby="features-heading" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-14 pb-4">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-700">What JeevanSetu does</p>
        <h2 id="features-heading" className="section-title mt-1">Everything a family needs, in one place</h2>
        <p className="section-sub">Six practical tools built for people who should never have to guess about healthcare.</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, desc, cta, href, tint }) => (
            <Link key={title} href={href}
              className="card p-5 sm:p-6 flex flex-col group hover:shadow-lg hover:-translate-y-0.5 transition-all focus-visible:outline-none">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${tint}`}><Icon size={24} strokeWidth={2} /></div>
              <h3 className="mt-4 font-extrabold text-lg text-slate-900 leading-snug">{title}</h3>
              <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">{desc}</p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-extrabold text-brand-800 group-hover:gap-2.5 transition-all">
                {cta} <ChevronRight size={17} strokeWidth={2.5} />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ─── STATS STRIP ──────────────────────────────────────── */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-center">
          {[
            { n: String(HOSPITAL_COUNT), l: 'Hospitals listed (govt & private)' },
            { n: String(TREATMENT_COUNT), l: 'Treatments with ₹ cost ranges' },
            { n: String(EMERGENCY_VERIFIED_COUNT), l: 'Verified 24×7 emergency facilities' },
            { n: '112', l: 'One emergency number, all India' },
          ].map(({ n, l }) => (
            <div key={l} className="rounded-2xl bg-brand-800 text-white px-3 py-4">
              <p className="text-2xl sm:text-3xl font-black">{n}</p>
              <p className="mt-1 text-[11px] sm:text-xs font-medium text-brand-100/90 leading-snug">{l}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ─── D · FEATURE 1: NEARBY ──────────────────────────── */}
      <NearbySection />

      {/* ─── E · FEATURE 2: RECOMMENDED ─────────────────────── */}
      <RecommendedSection />

      {/* ─── F · FEATURE 4: COMPARE ─────────────────────────── */}
      <CompareTeaser />

      {/* ─── G · FEATURE 3: COST ESTIMATOR ──────────────────── */}
      <CostTeaser />

      {/* ─── H · FEATURE 6: EMERGENCY ───────────────────────── */}
      <EmergencyAssistance />

      {/* ─── WHY TRUST + FAQ ────────────────────────────────── */}
      <section aria-labelledby="faq-heading" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14 grid gap-10 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <p className="text-xs font-bold uppercase tracking-widest text-brand-700">Honest by design</p>
          <h2 className="section-title mt-1">How JeevanSetu keeps your family safe</h2>
          <ul className="mt-5 space-y-4 text-sm text-slate-700">
            {[
              { t: 'No fake ratings or invented doctors', d: 'We show only what we can stand behind. Unknown details are marked “Not listed” — never made up.' },
              { t: 'Public data sources, labelled', d: 'Hospital details come from public directories and government publications; verification status is shown next to every claim.' },
              { t: 'Costs are ranges, not quotes', d: 'Compiled from CGHS / PM-JAY / published tariff references — see our Disclaimer page for sourcing.' },
              { t: 'Emergency first, always', d: 'Every page carries a direct 112 call button. This website never delays medical care.' },
            ].map(({ t: title, d }) => (
              <li key={title} className="flex items-start gap-3">
                <ShieldCheck size={19} className="mt-0.5 shrink-0 text-brand-700" />
                <span><strong className="text-slate-900">{title}.</strong> {d}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6 overflow-hidden rounded-2xl border border-brand-100">
            <Image src="/images/health-camp.jpg" alt="Community health check-up camp in a village courtyard" width={640} height={400} className="object-cover w-full h-44 sm:h-52" />
            <p className="bg-white px-4 py-2 text-[11px] text-slate-500">Community check-up camp — JeevanSetu exists so the next family in this courtyard knows exactly which hospital to trust.</p>
          </div>
        </div>
        <div className="lg:col-span-3">
          <h2 id="faq-heading" className="section-title">Common questions</h2>
          <div className="mt-5 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
            {FAQ.map(({ q, a }) => (
              <details key={q} className="group px-5 py-4">
                <summary className="cursor-pointer list-none flex items-center justify-between gap-4 font-bold text-slate-900 min-h-[44px]">
                  {q}
                  <ChevronRight size={18} className="shrink-0 transition-transform group-open:rotate-90" aria-hidden="true" />
                </summary>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
