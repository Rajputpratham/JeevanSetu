'use client';
import Link from 'next/link';
import { Home, Siren } from 'lucide-react';
import { useLang } from '@/lib/i18n';

export default function NotFound() {
  const { t } = useLang();
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <p className="text-7xl font-black text-brand-200">404</p>
      <h1 className="mt-2 text-2xl font-extrabold text-slate-900">{t('notFoundTitle')}</h1>
      <p className="mt-1 text-slate-600">{t('notFoundDesc')}</p>
      <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
        <Link href="/" className="btn-primary"><Home size={18} />{t('backToHome')}</Link>
        <Link href="/hospitals" className="btn-secondary">{t('findHospitalsShort')}</Link>
        <a href="tel:112" className="btn-danger"><Siren size={18} />{t('emergency112Short')}</a>
      </div>
    </div>
  );
}
