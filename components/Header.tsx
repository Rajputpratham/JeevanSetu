'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Menu, X, PhoneCall, Languages, GitCompareArrows, Bookmark, Trophy, Check, ChevronDown,
} from 'lucide-react';
import Logo from './Logo';
import { useLang, SUPPORTED_LANGUAGES, getLangMeta } from '@/lib/i18n';
import { useCompare } from '@/lib/compare';
import { useSavedHospitals } from '@/lib/saved';

export default function Header() {
  const [open, setOpen] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const langDropdownRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const { t, lang, setLang } = useLang();
  const { ids } = useCompare();
  const { savedIds } = useSavedHospitals();
  const currentMeta = getLangMeta(lang);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (langDropdownRef.current && !langDropdownRef.current.contains(e.target as Node)) {
        setLangMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const nav = [
    { href: '/', label: t('navHome') },
    { href: '/hospitals', label: t('navFind') },
    { href: '/rankings', label: t('navRankings'), icon: Trophy },
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

      <div className="bg-white/95 backdrop-blur border-b border-brand-100 shadow-sm">
        <div className="mx-auto max-w-7xl px-3 sm:px-4 lg:px-6">
          <div className="flex h-16 items-center justify-between gap-2">
            <Logo />

            {/* Desktop nav */}
            <nav className="hidden xl:flex items-center gap-0.5 text-[14px] font-semibold text-slate-700" aria-label={t('navMainAria')}>
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive(item.href) ? 'page' : undefined}
                  className={`px-2.5 py-2 rounded-lg transition-colors whitespace-nowrap ${
                    isActive(item.href) ? 'text-brand-800 bg-brand-50 font-bold' : 'hover:text-brand-800 hover:bg-brand-50'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-1 sm:gap-1.5">
              {/* Saved hospitals shortcut */}
              <Link
                href="/hospitals?saved=1"
                aria-label={`${t('savedLabel')} (${savedIds.length})`}
                title={`${t('savedLabel')} (${savedIds.length})`}
                className="relative p-2.5 rounded-xl text-brand-800 hover:bg-brand-50 min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <Bookmark size={20} strokeWidth={2} className={savedIds.length > 0 ? 'fill-brand-700 text-brand-700' : ''} />
                {savedIds.length > 0 && (
                  <span className="absolute top-1 right-1 bg-amber-600 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {savedIds.length}
                  </span>
                )}
              </Link>

              {/* Compare shortcut with badge */}
              <Link
                href="/compare"
                aria-label={t('compareShortcutAria', { count: ids.length })}
                className="relative p-2.5 rounded-xl text-brand-800 hover:bg-brand-50 min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <GitCompareArrows size={21} strokeWidth={2} />
                {ids.length > 0 && (
                  <span className="absolute top-1 right-1 bg-brand-700 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {ids.length}
                  </span>
                )}
              </Link>

              {/* 11-Language selector dropdown */}
              <div className="relative" ref={langDropdownRef}>
                <button
                  type="button"
                  onClick={() => setLangMenuOpen((v) => !v)}
                  aria-expanded={langMenuOpen}
                  aria-haspopup="listbox"
                  aria-label={`Language: ${currentMeta.nativeName}`}
                  data-testid="language-selector-btn"
                  className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl border border-brand-200 text-brand-800 font-bold text-xs sm:text-sm hover:bg-brand-50 min-h-[44px]"
                >
                  <Languages size={17} strokeWidth={2} />
                  <span>{currentMeta.nativeName}</span>
                  <ChevronDown size={14} className={`transition-transform ${langMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {langMenuOpen && (
                  <div
                    role="listbox"
                    aria-label="Select language"
                    className="absolute right-0 mt-1.5 w-56 rounded-2xl border border-brand-100 bg-white shadow-xl py-1.5 z-50 max-h-[75vh] overflow-y-auto"
                  >
                    {SUPPORTED_LANGUAGES.map((l) => {
                      const selected = l.code === lang;
                      return (
                        <button
                          key={l.code}
                          type="button"
                          role="option"
                          aria-selected={selected}
                          data-testid={`lang-option-${l.code}`}
                          onClick={() => {
                            setLang(l.code);
                            setLangMenuOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3.5 py-2.5 text-sm text-left transition-colors ${
                            selected ? 'bg-brand-50 text-brand-900 font-bold' : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <span>
                            <span className="font-semibold">{l.nativeName}</span>{' '}
                            <span className="text-xs text-slate-500">({l.name}{l.dir === 'rtl' ? ' · RTL' : ''})</span>
                          </span>
                          {selected && <Check size={16} className="text-brand-700 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 112 button */}
              <a
                href="tel:112"
                aria-label={t('call112Now')}
                className="hidden sm:inline-flex items-center gap-1.5 bg-red-700 hover:bg-red-800 text-white font-extrabold rounded-xl px-3.5 py-2.5 min-h-[44px] text-sm tracking-wide shadow-sm"
              >
                <PhoneCall size={17} strokeWidth={2.5} /> {t('navEmergency112')}
              </a>

              {/* Hamburger */}
              <button
                type="button"
                onClick={() => setOpen(!open)}
                aria-expanded={open}
                aria-controls="mobile-nav"
                aria-label={open ? t('closeMenuAria') : t('openMenuAria')}
                className="xl:hidden p-2.5 rounded-xl text-slate-700 hover:bg-slate-100 min-h-[44px] min-w-[44px]"
              >
                {open ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile nav panel */}
        {open && (
          <div id="mobile-nav" className="xl:hidden border-t border-brand-100 bg-white px-4 pb-5 pt-2 shadow-lg">
            <nav className="grid gap-1" aria-label={t('navMobileAria')}>
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`px-4 py-3 rounded-xl font-semibold text-base ${
                    isActive(item.href) ? 'text-brand-800 bg-brand-50 font-bold' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
              <a
                href="tel:112"
                className="mt-2 flex items-center justify-center gap-2 bg-red-700 text-white font-extrabold rounded-xl px-4 py-3.5 text-lg"
              >
                <PhoneCall size={22} strokeWidth={2.5} /> {t('call112Now')}
              </a>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
