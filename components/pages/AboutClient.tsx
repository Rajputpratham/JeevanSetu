'use client';
import Link from 'next/link';
import Image from 'next/image';
import { HeartPulse, MapPin, Calculator, Siren, ShieldCheck } from 'lucide-react';
import { useLang, DictKey } from '@/lib/i18n';

const PROMISE_KEYS: DictKey[] = [
  'aboutPromise1',
  'aboutPromise2',
  'aboutPromise3',
  'aboutPromise4',
  'aboutPromise5',
];

export default function AboutClient() {
  const { t } = useLang();
  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
      <p className="text-xs font-bold uppercase tracking-widest text-brand-700">{t('aboutEyebrow')}</p>
      <h1 className="mt-2 text-3xl sm:text-5xl font-black tracking-tight text-brand-950 leading-[1.1]">{t('aboutTitle')}</h1>
      <p className="mt-4 text-lg text-slate-700 max-w-3xl">{t('aboutSub')}</p>

      <Image src="/images/health-camp.jpg" alt={t('aboutImgAlt')} width={1200} height={560} className="mt-8 w-full h-52 sm:h-72 object-cover rounded-3xl border border-brand-100" />

      <div className="mt-10 grid sm:grid-cols-2 gap-4">
        {[
          { icon: MapPin, titleKey: 'aboutCard1Title' as DictKey, bodyKey: 'aboutCard1Body' as DictKey },
          { icon: HeartPulse, titleKey: 'aboutCard2Title' as DictKey, bodyKey: 'aboutCard2Body' as DictKey },
          { icon: Calculator, titleKey: 'aboutCard3Title' as DictKey, bodyKey: 'aboutCard3Body' as DictKey },
          { icon: Siren, titleKey: 'aboutCard4Title' as DictKey, bodyKey: 'aboutCard4Body' as DictKey },
        ].map(({ icon: Icon, titleKey, bodyKey }) => (
          <div key={titleKey} className="card p-5">
            <Icon className="text-brand-700" size={26} aria-hidden="true" />
            <h2 className="mt-2 font-extrabold text-lg text-slate-900">{t(titleKey)}</h2>
            <p className="mt-1 text-sm text-slate-600 leading-relaxed">{t(bodyKey)}</p>
          </div>
        ))}
      </div>

      <section className="mt-10" aria-labelledby="how">
        <h2 id="how" className="section-title !text-2xl">{t('aboutDataHeading')}</h2>
        <ul className="mt-4 space-y-3 text-slate-700">
          {PROMISE_KEYS.map((key) => (
            <li key={key} className="flex items-start gap-2.5"><ShieldCheck size={18} className="mt-0.5 shrink-0 text-brand-700" />{t(key)}</li>
          ))}
        </ul>
      </section>

      <div className="mt-10 card p-6 text-center bg-brand-50">
        <h2 className="font-extrabold text-xl text-brand-950">{t('aboutCtaHeading')}</h2>
        <p className="mt-1 text-sm text-slate-600 max-w-xl mx-auto">{t('aboutCtaBody')}</p>
        <Link href="/contact" className="btn-primary mt-4">{t('aboutCtaBtn')}</Link>
      </div>
    </div>
  );
}
