'use client';
import { ShieldAlert } from 'lucide-react';
import { useLang } from '@/lib/i18n';

export default function DisclaimerClient() {
  const { t } = useLang();
  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
      <p className="text-xs font-bold uppercase tracking-widest text-brand-700">{t('discEyebrow')}</p>
      <h1 className="mt-2 text-3xl sm:text-4xl font-extrabold tracking-tight text-brand-950 flex items-center gap-3"><ShieldAlert size={34} className="text-amber-600" />{t('discTitle')}</h1>
      <p className="mt-2 text-sm text-slate-500">{t('discSub')}</p>

      <section className="mt-7">
        <h2 className="font-extrabold text-xl text-slate-900">{t('discSec1Title')}</h2>
        <p className="mt-1.5 text-slate-700 leading-relaxed">
          {t('discSec1Body1')}
          <a href="tel:112" className="font-bold text-red-700">{t('discSec1Link')}</a>
          {t('discSec1Body2')}
        </p>
      </section>

      <section className="mt-7">
        <h2 className="font-extrabold text-xl text-slate-900">{t('discSec2Title')}</h2>
        <ul className="mt-2 list-disc list-inside space-y-1.5 text-slate-700">
          <li>{t('discSec2Item1')}</li>
          <li>{t('discSec2Item2')}</li>
          <li>{t('discSec2Item3')}</li>
        </ul>
        <p className="mt-2 text-sm text-slate-600">{t('discSec2Note')}</p>
      </section>

      <section className="mt-7">
        <h2 className="font-extrabold text-xl text-slate-900">{t('discSec3Title')}</h2>
        <p className="mt-1.5 text-slate-700">{t('discSec3P1')}</p>
        <p className="mt-2 text-slate-700">{t('discSec3P2')}</p>
      </section>

      <section className="mt-7">
        <h2 className="font-extrabold text-xl text-slate-900">{t('discSec4Title')}</h2>
        <ul className="mt-2 list-disc list-inside space-y-1.5 text-slate-700">
          <li>{t('discSec4Item1')}</li>
          <li>{t('discSec4Item2')}</li>
          <li>{t('discSec4Item3')}</li>
          <li>{t('discSec4Item4')}</li>
          <li>{t('discSec4Item5')}</li>
        </ul>
        <p className="mt-2 text-sm text-slate-600">{t('discSec4Note')}</p>
      </section>

      <section className="mt-7">
        <h2 className="font-extrabold text-xl text-slate-900">{t('discSec5Title')}</h2>
        <p className="mt-1.5 text-slate-700">
          {t('discSec5Body1')}
          <a href="mailto:hello@jeevansetu.in" className="text-brand-800 font-semibold underline">hello@jeevansetu.in</a>
          {t('discSec5Body2')}
        </p>
      </section>

      <p className="mt-8 text-xs text-slate-400">{t('discFooterNote')}</p>
    </div>
  );
}
