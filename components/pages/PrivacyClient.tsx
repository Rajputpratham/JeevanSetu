'use client';
import { useLang, DictKey } from '@/lib/i18n';

const SECTIONS: { titleKey: DictKey; bodyKeys: DictKey[] }[] = [
  { titleKey: 'privSec1Title', bodyKeys: ['privSec1B1', 'privSec1B2', 'privSec1B3'] },
  { titleKey: 'privSec2Title', bodyKeys: ['privSec2B1', 'privSec2B2', 'privSec2B3'] },
  { titleKey: 'privSec3Title', bodyKeys: ['privSec3B1', 'privSec3B2', 'privSec3B3'] },
  { titleKey: 'privSec4Title', bodyKeys: ['privSec4B1', 'privSec4B2', 'privSec4B3'] },
];

export default function PrivacyClient() {
  const { t } = useLang();
  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
      <p className="text-xs font-bold uppercase tracking-widest text-brand-700">{t('privEyebrow')}</p>
      <h1 className="mt-2 text-3xl sm:text-4xl font-extrabold tracking-tight text-brand-950">{t('privTitle')}</h1>
      <p className="mt-2 text-sm text-slate-500">{t('privUpdated')}</p>
      {SECTIONS.map(({ titleKey, bodyKeys }) => (
        <section key={titleKey} className="mt-7">
          <h2 className="font-extrabold text-xl text-slate-900">{t(titleKey)}</h2>
          <ul className="mt-2 list-disc list-inside space-y-1.5 text-[15px] text-slate-700 leading-relaxed">
            {bodyKeys.map((k) => <li key={k}>{t(k)}</li>)}
          </ul>
        </section>
      ))}
    </div>
  );
}
