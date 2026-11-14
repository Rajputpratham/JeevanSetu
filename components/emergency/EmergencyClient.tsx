'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  PhoneCall, Navigation, Siren, CheckCircle2, AlertOctagon,
  HeartPulse, Flame, Baby, ListChecks, Loader2, Info,
} from 'lucide-react';
import { useUserLocation } from '@/lib/useLocation';
import { directionsUrl } from '@/lib/geo';
import { HELPLINES } from '@/data/helplines';
import { Hospital } from '@/data/types';
import { useLang, DictKey } from '@/lib/i18n';
import { HELPLINE_HI, tHospitalMeta, tPresetLabel } from '@/lib/i18n-data';

type EmergencyHospital = Hospital & { distanceKm: number };

const STEP_KEYS: DictKey[] = ['emStep1', 'emStep2', 'emStep3', 'emStep4', 'emStep5', 'emStep6'];

export default function EmergencyClient() {
  const { t, lang } = useLang();
  const { location, requestGeolocation, status: geoStatus } = useUserLocation();
  const [hospitals, setHospitals] = useState<EmergencyHospital[] | null>(null);
  const [verifiedOnly, setVerifiedOnly] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setHospitals(null); setError(false);
    fetch(`/api/emergency?lat=${location.lat}&lng=${location.lng}&lang=${lang}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((d) => { if (!cancelled) setHospitals(d.hospitals ?? []); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [location.lat, location.lng, lang]);

  const shown = useMemo(
    () => (hospitals ?? []).filter((h) => (verifiedOnly ? h.emergency === 'verified' : true)),
    [hospitals, verifiedOnly],
  );

  const locationDisplay =
    location.source === 'geolocation'
      ? t('emYourCurrentLoc')
      : location.source === 'default'
        ? t('defaultLocationLabel')
        : tPresetLabel(location.label, lang);

  return (
    <div>
      {/* ─── Emergency hero ─── */}
      <section className="bg-red-800 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 lg:py-14 grid gap-8 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-red-200 flex items-center gap-2"><Siren size={16} />{t('emEyebrow')}</p>
            <h1 className="mt-2 text-4xl sm:text-5xl font-black tracking-tight leading-[1.05]">{t('emHeroTitle1')}<br />{t('emHeroTitle2')}</h1>
            <p className="mt-3 text-red-100 text-lg leading-snug">{t('emHeroSubPre')}<strong className="text-white">{t('emHeroSubStrong')}</strong></p>
            <a href="tel:112" className="mt-6 inline-flex w-full sm:w-auto items-center justify-center gap-4 bg-white text-red-800 rounded-2xl px-8 py-6 shadow-2xl hover:bg-red-50 transition-colors">
              <PhoneCall size={40} strokeWidth={2.5} />
              <span className="text-left"><span className="block text-5xl font-black leading-none">112</span>
                <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider">{t('emTapToCall')}</span></span>
            </a>
            <button type="button" onClick={requestGeolocation} disabled={geoStatus === 'locating'} className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-red-100 underline underline-offset-4 hover:text-white">
              {geoStatus === 'locating' ? <Loader2 size={15} className="animate-spin" /> : null}
              {t('emDistancesFromPre')}{locationDisplay}{t('emDistancesTapUpdate')}
            </button>
          </div>
          <div className="bg-red-900/60 border border-red-700 rounded-3xl p-6">
            <h2 className="font-extrabold text-xl flex items-center gap-2"><ListChecks size={22} />{t('emWhileWaitingTitle')}</h2>
            <ol className="mt-3 space-y-2.5 text-sm text-red-50 list-none">
              {STEP_KEYS.map((key, i) => (
                <li key={key} className="flex items-start gap-2.5"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-red-800 text-xs font-black">{i + 1}</span>{t(key)}</li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* ─── Helplines grid ─── */}
      <section aria-labelledby="helplines" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        <h2 id="helplines" className="section-title !text-2xl">{t('emHelplinesTitle')}</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {HELPLINES.map((h) => {
            const label = lang === 'hi' ? (HELPLINE_HI[h.number]?.label ?? h.label) : h.label;
            const detail = lang === 'hi' ? (HELPLINE_HI[h.number]?.detail ?? h.detail) : h.detail;
            return (
              <a key={h.number} href={`tel:${h.number}`} className="card p-4 hover:shadow-lg hover:-translate-y-0.5 transition-all text-center group">
                <span className="block text-2xl font-black text-brand-800 group-hover:text-brand-600">{h.number}</span>
                <span className="mt-1 block text-xs font-bold text-slate-800 leading-snug">{label}</span>
                <span className="mt-1 block text-[10px] text-slate-500 leading-snug">{detail}</span>
              </a>
            );
          })}
        </div>
      </section>

      {/* ─── Common emergency cards ─── */}
      <section aria-labelledby="situations" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-10 grid gap-4 sm:grid-cols-3">
        {[
          { icon: HeartPulse, titleKey: 'emCard1Title' as DictKey, bodyKey: 'emCard1Body' as DictKey },
          { icon: Flame, titleKey: 'emCard2Title' as DictKey, bodyKey: 'emCard2Body' as DictKey },
          { icon: Baby, titleKey: 'emCard3Title' as DictKey, bodyKey: 'emCard3Body' as DictKey },
        ].map(({ icon: Icon, titleKey, bodyKey }) => (
          <div key={titleKey} className="card p-5 border-l-4 !border-l-red-600">
            <Icon className="text-red-700" size={26} aria-hidden="true" />
            <h3 className="mt-2 font-extrabold text-slate-900">{t(titleKey)}</h3>
            <p className="mt-1 text-sm text-slate-600 leading-relaxed">{t(bodyKey)}</p>
          </div>
        ))}
      </section>

      {/* ─── Nearby emergency hospitals ─── */}
      <section aria-labelledby="nearby-emergency" className="bg-slate-50 border-t border-slate-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="nearby-emergency" className="section-title !text-2xl">{t('nearbyEmergency')}</h2>
              <p className="section-sub text-sm">{t('emNearbySub')}</p>
            </div>
            <div className="flex rounded-xl border border-slate-200 overflow-hidden text-sm font-bold" role="group" aria-label={t('emFilterAria')}>
              <button type="button" onClick={() => setVerifiedOnly(true)} aria-pressed={verifiedOnly} className={`px-4 py-2.5 ${verifiedOnly ? 'bg-red-700 text-white' : 'bg-white text-slate-600'}`}>{t('emVerifiedOnly')}</button>
              <button type="button" onClick={() => setVerifiedOnly(false)} aria-pressed={!verifiedOnly} className={`px-4 py-2.5 ${!verifiedOnly ? 'bg-red-700 text-white' : 'bg-white text-slate-600'}`}>{t('emIncludeUnverified')}</button>
            </div>
          </div>

          {error && <div role="alert" className="mt-5 card border-red-300 bg-red-50 p-5 flex items-start gap-3"><AlertOctagon className="text-red-700 shrink-0 mt-0.5" size={22} /><p className="font-semibold text-red-900">{t('emLoadError')}</p></div>}

          <ul className="mt-5 grid gap-3 md:grid-cols-2">
            {hospitals === null
              ? [0, 1, 2, 3].map((i) => <li key={i} className="card p-5 h-36 animate-pulse" aria-hidden="true" />)
              : shown.length === 0
                ? <li className="card p-6 text-center text-slate-500 md:col-span-2">{t('emEmptyFilter')} <button type="button" onClick={() => setVerifiedOnly(false)} className="font-bold text-brand-800 underline">{t('emShowUnverifiedBtn')}</button></li>
                : shown.map((h) => {
                    const emNote = tHospitalMeta(h.id, 'emergencyNote', h.emergencyNote, lang);
                    return (
                      <li key={h.id} className="card p-4 sm:p-5 flex flex-col">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <Link href={`/hospitals/${h.id}`} className="font-extrabold text-slate-900 leading-snug hover:text-brand-800 hover:underline">{h.name}</Link>
                            <p className="mt-1 text-xs text-slate-500">{h.address}</p>
                          </div>
                          <div className="text-right shrink-0"><p className="text-lg font-extrabold text-brand-800 leading-none">{h.distanceKm.toFixed(1)}</p><p className="text-[10px] uppercase text-slate-500">{t('kmUnit')}</p></div>
                        </div>
                        <p className="mt-2 text-[11px]">
                          {h.emergency === 'verified'
                            ? <span className="inline-flex items-center gap-1.5 font-bold text-red-800"><CheckCircle2 size={13} />{t('emVerifiedBadge')}</span>
                            : <span className="font-semibold text-amber-800">{t('emUnverifiedBadge')}</span>}
                          {emNote && <span className="block text-slate-500 mt-0.5">{emNote}</span>}
                        </p>
                        <div className="mt-auto pt-3 flex flex-wrap gap-2">
                          {h.phone
                            ? <a href={`tel:${h.phone}`} className="inline-flex items-center gap-2 bg-red-700 text-white font-extrabold rounded-xl px-4 py-2.5 text-sm min-h-[44px] hover:bg-red-800"><PhoneCall size={16} />{h.phone}</a>
                            : <span className="inline-flex items-center text-xs text-slate-500 px-2 py-2.5">{t('notListedCall104')}</span>}
                          <a href={directionsUrl(h.lat, h.lng, h.shortName)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 border-2 border-brand-700 text-brand-800 font-bold rounded-xl px-4 py-2.5 text-sm min-h-[44px] hover:bg-brand-50"><Navigation size={16} />{t('directionsShort')}</a>
                        </div>
                      </li>
                    );
                  })}
          </ul>
          <p className="mt-5 flex items-start gap-1.5 text-[11px] text-slate-500 max-w-3xl"><Info size={13} className="mt-0.5 shrink-0" />{t('emBottomNotice')}</p>
        </div>
      </section>
    </div>
  );
}
