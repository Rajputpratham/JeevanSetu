'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, PhoneCall, Languages, GitCompareArrows } from 'lucide-react';
import Logo from './Logo';
import { useLang } from '@/lib/i18n';
import { useCompare } from '@/lib/compare';

export default function Header() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { t, lang, setLang } = useLang();
  const { ids } = useCompare();

  const nav = [
    { href: '/', label: t('navHome') },
    { href: '/hospitals', label: t('navFind') },
    { href: '/recommendations', label: t('navRecommend') },
    { href: '/cost-estimator', label: t('navCost') },
    { href: '/compare', label: t('navCompare') },
    { href: '/emergency', label: t('navEmergency') },
  ];
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  return (
    <header className="sticky top-0 z-50">
      {/* Emergency strip */}
      <div className="bg-red-800 text-white text-center text-xs sm:text-[13px] font-semibold px-3 py-1.5 leading-snug print-hidden">
        <span className="sr-only">{t('emergencyStripPrefix')}</span>
        {t('emergencyStrip')}{' '}
        <a href="tel:112" className="underline underline-offset-2 font-bold whitespace-nowrap hover:text-amber-200">
          {t('emergencyStripCall')}
        </a>
      </div>

      <div className="bg-white/95 backdrop-blur border-b border-brand-100">
        <div className="mx-auto max-w-7xl px-3 sm:px-4 lg:px-6">
          <div className="flex h-16 items-center justify-between gap-2">
            <Logo />

            {/* Desktop nav */}
            <nav className="hidden lg:flex items-center gap-1 text-[15px] font-semibold text-slate-700" aria-label={t('navMainAria')}>
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive(item.href) ? 'page' : undefined}
                  className={`px-3 py-2 rounded-lg transition-colors ${
                    isActive(item.href) ? 'text-brand-800 bg-brand-50' : 'hover:text-brand-800 hover:bg-brand-50'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Compare shortcut with badge */}
              <Link href="/compare" aria-label={t('compareShortcutAria', { count: ids.length })}
                className="relative p-2.5 rounded-xl text-brand-800 hover:bg-brand-50 min-h-[44px] min-w-[44px] flex items-center justify-center">
                <GitCompareArrows size={22} strokeWidth={2} />
                {ids.length > 0 && (
                  <span className="absolute top-1 right-1 bg-brand-700 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {ids.length}
                  </span>
                )}
              </Link>

              {/* Language toggle */}
              <button
                type="button"
                onClick={() => setLang(lang === 'en' ? 'hi' : 'en')}
                aria-label={lang === 'en' ? t('switchToHindiAria') : t('switchToEnglishAria')}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl border border-brand-200 text-brand-800 font-bold text-sm hover:bg-brand-50 min-h-[44px]"
              >
                <Languages size={18} strokeWidth={2} />
                <span>{lang === 'en' ? 'हिं' : 'EN'}</span>
              </button>

              {/* 112 button */}
              <a href="tel:112" aria-label={t('call112Now')} className="hidden sm:inline-flex items-center gap-2 bg-red-700 hover:bg-red-800 text-white font-extrabold rounded-xl px-4 py-2.5 min-h-[44px] text-sm tracking-wide">
                <PhoneCall size={18} strokeWidth={2.5} /> {t('navEmergency112')}
              </a>

              {/* Hamburger */}
              <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="mobile-nav" aria-label={open ? t('closeMenuAria') : t('openMenuAria')}
                className="lg:hidden p-2.5 rounded-xl text-slate-700 hover:bg-slate-100 min-h-[44px] min-w-[44px]">
                {open ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile nav panel */}
        {open && (
          <div id="mobile-nav" className="lg:hidden border-t border-brand-100 bg-white px-4 pb-5 pt-2">
            <nav className="grid gap-1.5" aria-label={t('navMobileAria')}>
              {nav.map((item) => (
                <Link key={item.href} href={item.href} onClick={() => setOpen(false)}
                  className={`px-4 py-3.5 rounded-xl font-semibold text-base ${
                    isActive(item.href) ? 'text-brand-800 bg-brand-50' : 'text-slate-700 hover:bg-slate-50'
                  }`}>
                  {item.label}
                </Link>
              ))}
              <a href="tel:112" className="mt-1 flex items-center justify-center gap-2 bg-red-700 text-white font-extrabold rounded-xl px-4 py-4 text-lg">
                <PhoneCall size={22} strokeWidth={2.5} /> {t('call112Now')}
              </a>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
