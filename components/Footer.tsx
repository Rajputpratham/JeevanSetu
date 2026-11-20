'use client';
import Link from 'next/link';
import Logo from './Logo';
import { PhoneCall, Mail, MapPin, ShieldAlert } from 'lucide-react';
import { useLang } from '@/lib/i18n';

export default function Footer() {
  const { t } = useLang();
  return (
    <footer className="bg-brand-950 text-brand-100 print-hidden">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
        <div className="grid gap-10 md:grid-cols-4">
          <div>
            <div className="bg-white rounded-2xl inline-block p-2"><Logo size={40} /></div>
            <p className="mt-4 text-sm text-brand-100/85 leading-relaxed">
              {t('footerDesc')}
            </p>
          </div>
          <nav aria-label={t('footerPlatformNavAria')}>
            <h2 className="text-white font-bold text-sm uppercase tracking-wider">{t('footerColPlatform')}</h2>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link href="/hospitals" className="hover:text-white hover:underline">{t('footerLinkFind')}</Link></li>
              <li><Link href="/rankings" className="hover:text-white hover:underline">{t('navRankings')}</Link></li>
              <li><Link href="/recommendations" className="hover:text-white hover:underline">{t('footerLinkRecommend')}</Link></li>
              <li><Link href="/cost-estimator" className="hover:text-white hover:underline">{t('footerLinkCost')}</Link></li>
              <li><Link href="/compare" className="hover:text-white hover:underline">{t('footerLinkCompare')}</Link></li>
              <li><Link href="/emergency" className="hover:text-white hover:underline">{t('footerLinkEmergency')}</Link></li>
            </ul>
          </nav>
          <nav aria-label={t('footerOrgNavAria')}>
            <h2 className="text-white font-bold text-sm uppercase tracking-wider">{t('footerColAbout')}</h2>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link href="/about" className="hover:text-white hover:underline">{t('footerAbout')}</Link></li>
              <li><Link href="/contact" className="hover:text-white hover:underline">{t('footerContact')}</Link></li>
              <li><Link href="/privacy" className="hover:text-white hover:underline">{t('footerPrivacy')}</Link></li>
              <li><Link href="/disclaimer" className="hover:text-white hover:underline">{t('footerDisclaimerLink')}</Link></li>
            </ul>
          </nav>
          <div>
            <h2 className="text-white font-bold text-sm uppercase tracking-wider">{t('footerEmergency')}</h2>
            <a href="tel:112" className="mt-3 flex items-center gap-3 bg-red-700 hover:bg-red-600 rounded-2xl px-4 py-3">
              <PhoneCall size={26} strokeWidth={2.5} />
              <span><span className="block text-2xl font-extrabold leading-none">112</span>
              <span className="text-xs font-semibold">{t('footer112Title')}</span></span>
            </a>
            <p className="mt-3 text-xs text-brand-100/80 leading-relaxed">
              {t('footerHelplineNote')}{' '}
              <Link href="/emergency" className="underline hover:text-white">{t('footerEmergencyGuide')}</Link>
            </p>
            <p className="mt-3 flex items-start gap-2 text-xs text-brand-100/70"><Mail size={14} className="mt-0.5 shrink-0" /> hello@jeevansetu.in</p>
            <p className="mt-1 flex items-start gap-2 text-xs text-brand-100/70"><MapPin size={14} className="mt-0.5 shrink-0" /> {t('footerServing')}</p>
          </div>
        </div>
        <div className="mt-10 border-t border-white/10 pt-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-brand-100/70">
          <p className="flex items-start gap-2 max-w-2xl"><ShieldAlert size={15} className="mt-0.5 shrink-0 text-amber-300" />
            {t('disclaimerShort')}
          </p>
          <p className="whitespace-nowrap">© {new Date().getFullYear()} JeevanSetu</p>
        </div>
      </div>
    </footer>
  );
}
