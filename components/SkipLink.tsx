'use client';
import { useLang } from '@/lib/i18n';

export default function SkipLink() {
  const { t } = useLang();
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:bg-brand-800 focus:text-white focus:px-4 focus:py-3 focus:rounded-xl focus:font-bold"
    >
      {t('skipToContent')}
    </a>
  );
}
