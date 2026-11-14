'use client';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, MapPin } from 'lucide-react';
import { ALL_SPECIALITIES } from '@/data/hospitals';
import { useLang } from '@/lib/i18n';
import { tSpeciality } from '@/lib/i18n-data';

export default function QuickSearch() {
  const router = useRouter();
  const { t, lang } = useLang();
  const [q, setQ] = useState('');
  const [speciality, setSpeciality] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = q.trim();
    const params = new URLSearchParams();
    if (trimmed) params.set('q', trimmed);
    if (speciality) params.set('speciality', speciality);
    if (!trimmed && !speciality) {
      params.set('empty', '1');
    }
    router.push(`/hospitals?${params.toString()}`);
  };

  return (
    <form onSubmit={submit} className="card p-3 sm:p-4 flex flex-col md:flex-row gap-2 md:items-center" role="search" aria-label={t('searchFormAria')}>
      <div className="relative flex-1">
        <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <label htmlFor="qs-q" className="sr-only">{t('searchPlaceholder')}</label>
        <input id="qs-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('searchPlaceholder')} className="input !pl-12" autoComplete="off" />
      </div>
      <div className="relative md:w-64">
        <MapPin size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" aria-hidden="true" />
        <label htmlFor="qs-spec" className="sr-only">{t('searchSpecialityAria')}</label>
        <select id="qs-spec" value={speciality} onChange={(e) => setSpeciality(e.target.value)} className="input !pl-12 appearance-none">
          <option value="">{t('allSpecialities')}</option>
          {ALL_SPECIALITIES.map((s) => <option key={s} value={s}>{tSpeciality(s, lang)}</option>)}
        </select>
      </div>
      <button type="submit" className="btn-primary md:w-auto w-full"><Search size={20} strokeWidth={2.5} />{t('searchBtn')}</button>
    </form>
  );
}
