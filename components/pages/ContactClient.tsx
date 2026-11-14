'use client';
import { PhoneCall, Mail, MapPin, Siren } from 'lucide-react';
import ContactForm from '@/components/contact/ContactForm';
import { useLang } from '@/lib/i18n';

export default function ContactClient() {
  const { t } = useLang();
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
      <p className="text-xs font-bold uppercase tracking-widest text-brand-700">{t('contactEyebrow')}</p>
      <h1 className="mt-2 text-3xl sm:text-4xl font-extrabold tracking-tight text-brand-950">{t('contactTitle')}</h1>
      <p className="mt-2 text-slate-600 max-w-2xl">{t('contactSub')}</p>

      <div className="mt-8 grid gap-6 lg:grid-cols-5 items-start">
        <div className="lg:col-span-3"><ContactForm /></div>
        <aside className="lg:col-span-2 flex flex-col gap-4">
          <div className="card p-5">
            <h2 className="font-extrabold text-lg text-slate-900">{t('contactReachHeading')}</h2>
            <ul className="mt-3 space-y-3 text-sm text-slate-700">
              <li className="flex items-start gap-2.5"><Mail size={17} className="mt-0.5 text-brand-700 shrink-0" /><a className="font-semibold text-brand-800 hover:underline" href="mailto:hello@jeevansetu.in">hello@jeevansetu.in</a></li>
              <li className="flex items-start gap-2.5"><MapPin size={17} className="mt-0.5 text-brand-700 shrink-0" />{t('contactTeam')}<br />{t('footerServing')}</li>
            </ul>
            <p className="mt-3 text-[11px] text-slate-500">{t('contactReplyNote')}</p>
          </div>
          <div className="rounded-2xl border-2 border-red-300 bg-red-50 p-5">
            <h2 className="font-extrabold text-red-900 flex items-center gap-2"><Siren size={19} />{t('contactEmergencyHeading')}</h2>
            <p className="mt-1 text-sm text-red-900">{t('contactEmergencySub')}</p>
            <a href="tel:112" className="mt-3 inline-flex items-center gap-2 bg-red-700 text-white font-extrabold rounded-xl px-5 py-3.5 hover:bg-red-800"><PhoneCall size={20} />{t('contactCall112Btn')}</a>
          </div>
        </aside>
      </div>
    </div>
  );
}
