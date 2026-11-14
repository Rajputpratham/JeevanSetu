'use client';
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Sparkles, Loader2, CheckCircle2, AlertTriangle, PhoneCall,
  Stethoscope, Info, AlertCircle, Landmark, Building2, ShieldCheck,
} from 'lucide-react';
import { useUserLocation } from '@/lib/useLocation';
import LocationControls from '@/components/LocationControls';
import { ALL_SPECIALITIES } from '@/data/hospitals';
import { specialityForProblem } from '@/lib/recommend';
import { formatDrivingKm } from '@/lib/geo';
import { distanceStrings } from '@/lib/ui-strings';
import { useLang } from '@/lib/i18n';
import { tFacility, tPresetLabel, tSpeciality } from '@/lib/i18n-data';

interface RecResult {
  hospital: { id: string; name: string; shortName: string; type: 'government' | 'private'; phone: string | null; emergency: string; facilities: string[]; costProfile: string };
  distanceKm: number | null;
  score: number;
  reasons: string[];
  cautions: string[];
}

const FACILITY_OPTIONS = ['Emergency 24×7', 'ICU', 'Dialysis', 'Maternity & Delivery', 'Blood Bank', 'CT Scan', 'MRI', 'Ambulance', 'Cashless / Insurance Desk'];

export default function RecommendationsClient({ initialSpeciality }: { initialSpeciality?: string }) {
  const { t, lang } = useLang();
  const { location, hasLocation } = useUserLocation();

  const [problem, setProblem] = useState('');
  const [speciality, setSpeciality] = useState(initialSpeciality ?? '');
  const [typePref, setTypePref] = useState<'any' | 'government' | 'private'>('any');
  const [budget, setBudget] = useState<'any' | 'low' | 'medium' | 'high'>('any');
  const [facilities, setFacilities] = useState<string[]>([]);
  const [results, setResults] = useState<RecResult[] | null>(null);
  const [usedSpeciality, setUsedSpeciality] = useState<string | null>(null);
  const [mappedFrom, setMappedFrom] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mappedCandidate = useMemo(() => specialityForProblem(problem), [problem]);
  const lastSpecRef = useRef<string | null>(null);

  const run = useCallback(async (spec: string) => {
    lastSpecRef.current = spec;
    setBusy(true); setError(null); setResults(null);
    const params = new URLSearchParams({
      speciality: spec, type: typePref, budget,
      facilities: facilities.join(','),
      lang,
    });
    // Only send a real origin; the API treats a missing origin as "unknown"
    // rather than substituting a city.
    if (hasLocation) {
      params.set('lat', String(location.lat));
      params.set('lng', String(location.lng));
    }
    try {
      const res = await fetch(`/api/recommendations?${params}`);
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? t('recFailedError')); return; }
      setResults(data.results ?? []);
      setUsedSpeciality(data.speciality);
      setMappedFrom(data.mappedFromProblem ? problem.trim() : null);
    } catch {
      setError(t('listLoadError'));
    } finally {
      setBusy(false);
    }
  }, [typePref, budget, facilities, hasLocation, location.lat, location.lng, problem, lang, t]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const spec = speciality || mappedCandidate || '';
    if (!spec) {
      setError(t('recMissingSpecError'));
      return;
    }
    run(spec);
  };

  // Auto-run when arriving with ?speciality=
  useEffect(() => {
    if (initialSpeciality && ALL_SPECIALITIES.includes(initialSpeciality)) run(initialSpeciality);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-run in current language if user switches language after getting results
  useEffect(() => {
    if (lastSpecRef.current && results !== null) {
      run(lastSpecRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  const toggleFacility = (f: string) =>
    setFacilities((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));

  const locationDisplay = hasLocation
    ? location.source === 'geolocation'
      ? t('yourLocation')
      : tPresetLabel(location.label, lang)
    : t('noLocationSet');

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
      <p className="text-xs font-bold uppercase tracking-widest text-brand-700">{t('recEyebrow')}</p>
      <h1 className="mt-1 text-3xl sm:text-4xl font-extrabold tracking-tight text-brand-950">{t('recTitle')}</h1>
      <p className="mt-1 text-slate-600 max-w-2xl">
        {t('recSubPre')}
        <strong>{t('recSubStrong')}</strong>
        {t('recSubPost')}
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-5 items-start">
        {/* ─── Input panel ─── */}
        <form onSubmit={onSubmit} className="lg:col-span-2 card p-5 sm:p-6 flex flex-col gap-5" aria-label={t('recFormAria')}>
          <div>
            <label htmlFor="problem" className="label">{t('recProblemLabel')} <span className="font-normal text-slate-400">{t('optionalParen')}</span></label>
            <input id="problem" className="input" placeholder={t('recProblemPlaceholder')} value={problem} onChange={(e) => setProblem(e.target.value)} autoComplete="off" />
            {mappedCandidate && <p className="mt-1.5 text-xs font-semibold text-brand-800 flex items-center gap-1.5"><Stethoscope size={13} />{t('recLooksLike')} <strong>{tSpeciality(mappedCandidate, lang)}</strong></p>}
          </div>

          <div>
            <label htmlFor="spec" className="label">{t('recOrSpeciality')} <span aria-hidden="true" className="text-red-700">*</span></label>
            <select id="spec" className="input appearance-none" value={speciality} onChange={(e) => setSpeciality(e.target.value)}>
              <option value="">{t('recSelectSpeciality')}</option>
              {ALL_SPECIALITIES.map((s) => <option key={s} value={s}>{tSpeciality(s, lang)}</option>)}
            </select>
            <p className="mt-1 text-[11px] text-slate-500">{t('recAutoMapHint')}</p>
          </div>

          <fieldset>
            <legend className="label">{t('recHospitalTypeLabel')}</legend>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t('recHospitalTypeLabel')}>
              {([['any', t('recNoPref')], ['government', t('govtBadge')], ['private', t('privateBadge')]] as const).map(([val, lab]) => (
                <button key={val} type="button" role="radio" aria-checked={typePref === val} onClick={() => setTypePref(val)}
                  className={`rounded-xl border-2 px-3 py-2.5 text-sm font-bold min-h-[48px] transition-colors flex items-center justify-center gap-1.5 ${
                    typePref === val ? 'border-brand-700 bg-brand-700 text-white' : 'border-slate-200 text-slate-600 hover:border-brand-400'
                  }`}>
                  {val === 'government' ? <Landmark size={15} /> : val === 'private' ? <Building2 size={15} /> : null}{lab}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="label">{t('recBudgetLabel')}</legend>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" role="radiogroup" aria-label={t('recBudgetLabel')}>
              {([['any', t('recBudgetAny')], ['low', t('recBudgetLow')], ['medium', t('recBudgetMed')], ['high', t('recBudgetHigh')]] as const).map(([val, lab]) => (
                <button key={val} type="button" role="radio" aria-checked={budget === val} onClick={() => setBudget(val)}
                  className={`rounded-xl border-2 px-2 py-2.5 text-sm font-bold min-h-[48px] transition-colors ${
                    budget === val ? 'border-brand-700 bg-brand-700 text-white' : 'border-slate-200 text-slate-600 hover:border-brand-400'
                  }`}>{lab}</button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="label">{t('recFacilitiesLabel')} <span className="font-normal text-slate-400">{t('optionalParen')}</span></legend>
            <div className="flex flex-wrap gap-2">
              {FACILITY_OPTIONS.map((f) => {
                const active = facilities.includes(f);
                return (
                  <button key={f} type="button" onClick={() => toggleFacility(f)} aria-pressed={active}
                    className={`rounded-full border px-3 py-2 text-xs font-semibold transition-colors ${
                      active ? 'border-brand-700 bg-brand-700 text-white' : 'border-slate-200 text-slate-600 hover:border-brand-400'
                    }`}>{tFacility(f, lang)}</button>
                );
              })}
            </div>
          </fieldset>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 border-t border-slate-100 pt-4">
            <button type="submit" disabled={busy} className="btn-primary flex-1">
              {busy ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
              {busy ? t('recFindingBtn') : t('recGetBtn')}
            </button>
            <LocationControls compact className="sm:max-w-xs" />
          </div>
          <p className="text-[11px] text-slate-500 -mt-2 flex items-center gap-1.5"><ShieldCheck size={12} />{t('distancesFromLabel')} {locationDisplay}</p>
        </form>

        {/* ─── Results panel ─── */}
        <div className="lg:col-span-3" aria-live="polite">
          {error && (
            <div role="alert" className="card border-red-200 bg-red-50 p-5 flex items-start gap-3">
              <AlertCircle className="text-red-600 shrink-0 mt-0.5" size={22} />
              <div><p className="font-bold text-red-900">{error}</p></div>
            </div>
          )}

          {!error && results === null && !busy && (
            <div className="card p-8 text-center">
              <Stethoscope className="mx-auto text-brand-200" size={44} strokeWidth={1.5} />
              <h2 className="mt-3 font-bold text-xl text-slate-800">{t('recEmptyTitle')}</h2>
              <p className="mt-1.5 text-sm text-slate-600 max-w-md mx-auto">{t('recEmptyDesc')}</p>
              <p className="mt-4 inline-flex items-start gap-1.5 text-[11px] text-slate-500 max-w-md"><Info size={13} className="mt-0.5 shrink-0" />{t('recEmptyDisclaimer')}</p>
            </div>
          )}

          {busy && [0, 1, 2].map((i) => <div key={i} className="card p-5 mb-4 h-40 animate-pulse" aria-hidden="true" />)}

          {results !== null && results.length === 0 && !busy && (
            <div className="card p-8 text-center">
              <AlertCircle className="mx-auto text-amber-500" size={36} />
              <h2 className="mt-2 font-bold text-lg text-slate-800">{t('recNoMatchTitle')}</h2>
              <p className="mt-1 text-sm text-slate-600">{t('recNoMatchDesc', { spec: usedSpeciality ? tSpeciality(usedSpeciality, lang) : '' })}</p>
              <Link href="/hospitals" className="btn-secondary mt-4">{t('browseAllHospitals')}</Link>
            </div>
          )}

          {results !== null && results.length > 0 && !busy && (
            <>
              <p className="text-sm text-slate-600">
                {t('recShowingPrefix')} <strong>{results.length}</strong>{' '}
                {results.length === 1 ? t('recBestMatchOne') : t('recBestMatchMany')}{' '}
                <strong className="text-brand-800">{usedSpeciality ? tSpeciality(usedSpeciality, lang) : ''}</strong>
                {mappedFrom && <> {t('recMappedFrom', { problem: mappedFrom })}</>}।
              </p>
              <ol className="mt-3 flex flex-col gap-4">
                {results.map((r, idx) => {
                  const h = r.hospital;
                  return (
                    <li key={h.id} className="card p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-700 text-white font-black">{idx + 1}</span>
                          <div className="min-w-0">
                            <h2 className="font-bold text-slate-900 leading-snug"><Link href={`/hospitals/${h.id}`} className="hover:text-brand-800 hover:underline">{h.name}</Link></h2>
                            <p className="text-xs text-slate-500 mt-1">
                              {h.type === 'government' ? t('recGovtDesc') : t('recPrivateDesc')} · {formatDrivingKm(r.distanceKm, lang) ?? distanceStrings(lang).distanceUnavailable} {t('away')} {h.emergency === 'verified' && `· ${t('recEmergencyVerified')}`}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 grid sm:grid-cols-2 gap-3 text-[13px]">
                        <div className="rounded-xl bg-green-50 border border-green-100 p-3">
                          <p className="text-[10px] font-extrabold uppercase tracking-wider text-green-800">{t('recWhyMatches')}</p>
                          <ul className="mt-1.5 space-y-1">
                            {r.reasons.slice(0, 4).map((reason) => (
                              <li key={reason} className="flex items-start gap-1.5 text-green-950"><CheckCircle2 size={13} className="mt-0.5 shrink-0" />{reason}</li>
                            ))}
                          </ul>
                        </div>
                        {r.cautions.length > 0 && (
                          <div className="rounded-xl bg-amber-50 border border-amber-100 p-3">
                            <p className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800">{t('recPleaseNote')}</p>
                            <ul className="mt-1.5 space-y-1">
                              {r.cautions.slice(0, 3).map((c) => (
                                <li key={c} className="flex items-start gap-1.5 text-amber-950"><AlertTriangle size={13} className="mt-0.5 shrink-0" />{c}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                        {h.phone
                          ? <a href={`tel:${h.phone}`} className="inline-flex items-center gap-2 bg-brand-700 text-white rounded-xl px-4 py-2.5 text-sm font-bold hover:bg-brand-800 min-h-[44px]"><PhoneCall size={16} />{h.phone}</a>
                          : <span className="inline-flex items-center text-xs text-slate-500 py-2.5">{t('notListedCall104')}</span>}
                        <Link href={`/hospitals/${h.id}`} className="inline-flex items-center gap-2 border-2 border-brand-700 text-brand-800 rounded-xl px-4 py-2.5 text-sm font-bold hover:bg-brand-50 min-h-[44px]">{t('viewDetails')} →</Link>
                      </div>
                    </li>
                  );
                })}
              </ol>
              <p className="mt-4 text-[11px] text-slate-500 flex items-start gap-1.5"><Info size={13} className="mt-0.5 shrink-0" />{t('recFooterDisclaimer')}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
