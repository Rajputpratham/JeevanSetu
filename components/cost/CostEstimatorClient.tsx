'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Calculator, Loader2, Printer, AlertTriangle, Info, IndianRupee, Building2, Landmark, ShieldCheck,
} from 'lucide-react';
import { TREATMENTS, getTreatmentById } from '@/data/treatments';
import { HOSPITALS } from '@/data/hospitals';
import { formatINR, formatRange } from '@/lib/format';
import { ROOM_LABEL, ROOM_LABEL_HI, RoomType, EstimateResult } from '@/lib/cost-estimate';
import { useLang } from '@/lib/i18n';
import { TREATMENT_SOURCE_HI, tTreatmentCategory, tTreatmentNote, tTreatmentTest } from '@/lib/i18n-data';

const CATEGORY_ORDER = ['Outpatient (OPD)', 'Diagnostic test', 'Inpatient / OPD', 'Maternity', 'Surgery / Procedure', 'Chronic care', 'Oncology'];

export default function CostEstimatorClient() {
  const { t, lang } = useLang();
  const [treatmentId, setTreatmentId] = useState('normal-delivery');
  const treatment = useMemo(() => getTreatmentById(treatmentId)!, [treatmentId]);

  const [includedTests, setIncludedTests] = useState<number[]>(treatment.tests.map((_, i) => i));
  const [stayDays, setStayDays] = useState(Math.max(treatment.typicalStayDays[0], 1));
  const [roomType, setRoomType] = useState<RoomType>('general');
  const [hospitalId, setHospitalId] = useState<string>('');

  const [result, setResult] = useState<EstimateResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Reset dependent controls when treatment changes
  useEffect(() => {
    const tr = getTreatmentById(treatmentId)!;
    setIncludedTests(tr.tests.map((_, i) => i));
    setStayDays(Math.max(tr.typicalStayDays[0], tr.roomPerDay ? 1 : 0));
  }, [treatmentId]);

  const compute = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true); setError(null);
    try {
      const res = await fetch('/api/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ treatmentId, includedTests, stayDays, roomType, lang }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? t('estimateFailedError')); return; }
      setResult(data);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setError(t('estimateNetworkError'));
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }, [treatmentId, includedTests, stayDays, roomType, lang, t]);

  // Recompute automatically (debounced) whenever inputs or language change
  useEffect(() => {
    const id = setTimeout(compute, 250);
    return () => { clearTimeout(id); abortRef.current?.abort(); };
  }, [compute]);

  const toggleTest = (i: number) =>
    setIncludedTests((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i].sort((a, b) => a - b)));

  const pickedHospital = hospitalId ? HOSPITALS.find((h) => h.id === hospitalId) ?? null : null;
  const highlight: 'govt' | 'private' | null = pickedHospital ? (pickedHospital.type === 'government' ? 'govt' : 'private') : null;

  const govtHospitals = HOSPITALS.filter((h) => h.type === 'government');
  const privateHospitals = HOSPITALS.filter((h) => h.type === 'private');

  const grouped = CATEGORY_ORDER.map((cat) => ({ cat, items: TREATMENTS.filter((tr) => tr.category === cat) })).filter((g) => g.items.length);

  const noRoom = treatment.roomPerDay === null;
  const treatmentNote = tTreatmentNote(treatment.id, treatment.note, lang);
  const resultTreatmentName = result
    ? (lang === 'hi' && result.treatment.hindiName ? result.treatment.hindiName : result.treatment.name)
    : '';
  const resultSourceNote = lang === 'hi' ? TREATMENT_SOURCE_HI : result?.treatment.sourceNote;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
      <p className="text-xs font-bold uppercase tracking-widest text-brand-700">{t('costEyebrow')}</p>
      <h1 className="mt-1 text-3xl sm:text-4xl font-extrabold tracking-tight text-brand-950 flex items-center gap-3"><IndianRupee className="text-brand-700" size={34} />{t('costTitle')}</h1>
      <p className="mt-1 text-slate-600 max-w-2xl">
        {t('costSubPre')}
        <strong>{t('costSubGovt')}</strong>
        {t('costSubVs')}
        <strong>{t('costSubPrivate')}</strong>
        {t('costSubPost')}
      </p>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5 items-start">
        {/* ─── Controls ─── */}
        <div className="min-w-0 lg:col-span-2 card p-5 sm:p-6 flex flex-col gap-5">
          <div>
            <label htmlFor="treatment" className="label">{t('step1Treatment')}</label>
            <select id="treatment" value={treatmentId} onChange={(e) => setTreatmentId(e.target.value)} className="input appearance-none">
              {grouped.map(({ cat, items }) => (
                <optgroup key={cat} label={tTreatmentCategory(cat, lang)}>
                  {items.map((tr) => (
                    <option key={tr.id} value={tr.id}>
                      {lang === 'hi'
                        ? (tr.hindiName ?? tr.name)
                        : `${tr.name}${tr.hindiName ? ` — ${tr.hindiName}` : ''}`}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {treatmentNote && <p className="mt-2 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 flex items-start gap-1.5"><Info size={13} className="mt-0.5 shrink-0" />{treatmentNote}</p>}
          </div>

          <div>
            <label htmlFor="pick-hospital" className="label">{t('step2Hospital')}<span className="font-normal text-slate-400">{t('optionalParen')}</span></label>
            <select id="pick-hospital" value={hospitalId} onChange={(e) => setHospitalId(e.target.value)} className="input appearance-none">
              <option value="">{t('notDecidedOption')}</option>
              <optgroup label={t('govtHospitalsGroup')}>
                {govtHospitals.map((h) => <option key={h.id} value={h.id}>{h.shortName}</option>)}
              </optgroup>
              <optgroup label={t('privateHospitalsGroup')}>
                {privateHospitals.map((h) => <option key={h.id} value={h.id}>{h.shortName}</option>)}
              </optgroup>
            </select>
            {pickedHospital && (
              <p className="mt-1.5 text-[11px] text-slate-600 flex items-center gap-1.5">
                {pickedHospital.type === 'government' ? <Landmark size={13} className="text-green-800" /> : <Building2 size={13} className="text-sky-800" />}
                {t('pickedHospitalHint', {
                  name: pickedHospital.shortName,
                  type: pickedHospital.type === 'government' ? t('govtShortLabel') : t('privateShortLabel'),
                })}
              </p>
            )}
          </div>

          <fieldset className="min-w-0">
            <legend className="label">{t('step3Tests')}<span className="font-normal text-slate-400">{t('uncheckHint')}</span></legend>
            <div className="flex flex-col gap-2">
              {treatment.tests.map((test, i) => (
                <label key={i} className="flex items-start gap-2.5 rounded-xl border border-slate-200 px-3 py-2.5 cursor-pointer hover:border-brand-400">
                  <input type="checkbox" className="mt-0.5 w-5 h-5 accent-brand-700" checked={includedTests.includes(i)} onChange={() => toggleTest(i)} />
                  <span className="text-sm"><span className="font-semibold text-slate-800">{tTreatmentTest(test.name, lang)}</span>
                    <span className="block text-[11px] text-slate-500">{t('govtShortLabel')} {formatRange(...test.govt)} · {t('privateShortLabel')} {formatRange(...test.private)}</span></span>
                </label>
              ))}
            </div>
          </fieldset>

          {noRoom ? (
            <p className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">{t('dayCareOpdNote')}</p>
          ) : (
            <fieldset className="grid sm:grid-cols-2 gap-3 min-w-0">
              <div>
                <label htmlFor="stay" className="label">{t('step4Nights')}</label>
                <div className="flex items-stretch rounded-xl border border-slate-300 overflow-hidden">
                  <button type="button" aria-label={t('oneNightLess')} onClick={() => setStayDays((d) => Math.max(0, d - 1))} className="px-4 text-xl font-bold bg-slate-50 hover:bg-slate-100">−</button>
                  <input id="stay" type="number" inputMode="numeric" min={0} max={90} value={stayDays}
                    onChange={(e) => setStayDays(Math.min(90, Math.max(0, Math.trunc(Number(e.target.value)) || 0)))}
                    className="w-full min-w-0 text-center text-lg font-bold py-3 outline-none" />
                  <button type="button" aria-label={t('oneNightMore')} onClick={() => setStayDays((d) => Math.min(90, d + 1))} className="px-4 text-xl font-bold bg-slate-50 hover:bg-slate-100">+</button>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">{t('typicalStayHint', { min: treatment.typicalStayDays[0], max: treatment.typicalStayDays[1] })}</p>
              </div>
              <div>
                <label htmlFor="room" className="label">{t('roomCategoryLabel')}</label>
                <select id="room" value={roomType} onChange={(e) => setRoomType(e.target.value as RoomType)} className="input appearance-none">
                  {(Object.keys(ROOM_LABEL) as RoomType[]).map((r) => (
                    <option key={r} value={r}>{lang === 'hi' ? ROOM_LABEL_HI[r] : ROOM_LABEL[r]}</option>
                  ))}
                </select>
              </div>
            </fieldset>
          )}

          <button type="button" onClick={compute} disabled={busy} className="btn-primary text-lg !py-4">
            {busy ? <Loader2 size={22} className="animate-spin" /> : <Calculator size={22} />} {t('estimateCostBtn')}
          </button>
        </div>

        {/* ─── Result ─── */}
        <div className="min-w-0 lg:col-span-3 flex flex-col gap-4" aria-live="polite" aria-busy={busy}>
          {error && (
            <div role="alert" className="card border-red-200 bg-red-50 p-5 flex items-start gap-3">
              <AlertTriangle className="text-red-600 shrink-0 mt-0.5" size={22} />
              <div><p className="font-bold text-red-900">{error}</p><button type="button" onClick={compute} className="btn-danger mt-3 !py-2.5 !text-sm">{t('retryBtn')}</button></div>
            </div>
          )}

          {result && !error && (
            <div className="card overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
                <div>
                  <h2 className="font-extrabold text-xl text-slate-900">{t('estimateHeadingPrefix', { name: resultTreatmentName })}</h2>
                  <p className="text-[11px] text-slate-500">{resultSourceNote}</p>
                </div>
                <button type="button" onClick={() => window.print()} className="btn-ghost !text-sm print-hidden"><Printer size={17} /> {t('printBtn')}</button>
              </div>

              {/* Totals */}
              <div className="grid sm:grid-cols-2">
                <div className={`p-5 text-center border-b sm:border-b-0 sm:border-r border-slate-100 ${highlight === 'govt' ? 'bg-green-50 ring-4 ring-inset ring-green-600/40' : ''}`}>
                  <p className="flex items-center justify-center gap-2 text-[11px] font-extrabold uppercase tracking-widest text-green-800"><Landmark size={14} />{t('govtHospitalLabel')} {highlight === 'govt' && t('yourPickSuffix')}</p>
                  <p className="mt-2 text-2xl sm:text-3xl font-black text-green-900 leading-tight">{formatINR(result.govtTotal[0])}<span className="block text-sm font-bold text-green-800">{t('rangeTo')}</span>{formatINR(result.govtTotal[1])}</p>
                </div>
                <div className={`p-5 text-center ${highlight === 'private' ? 'bg-sky-50 ring-4 ring-inset ring-sky-600/40' : ''}`}>
                  <p className="flex items-center justify-center gap-2 text-[11px] font-extrabold uppercase tracking-widest text-sky-800"><Building2 size={14} />{t('privateHospitalLabel')} {highlight === 'private' && t('yourPickSuffix')}</p>
                  <p className="mt-2 text-2xl sm:text-3xl font-black text-sky-900 leading-tight">{formatINR(result.privateTotal[0])}<span className="block text-sm font-bold text-sky-800">{t('rangeTo')}</span>{formatINR(result.privateTotal[1])}</p>
                </div>
              </div>

              {/* Unavailable components warning */}
              {result.unavailableComponents.length > 0 && (
                <div role="alert" className="mx-5 mt-4 flex items-start gap-2 rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                  <AlertTriangle size={18} className="mt-0.5 shrink-0" />
                  <p><strong>{t('unavailableDataPrefix')}</strong> {result.unavailableComponents.join(', ')}. {t('unavailableDataBody')}</p>
                </div>
              )}

              {/* Itemised table */}
              <div className="overflow-x-auto print:overflow-visible px-2 sm:px-4 py-4">
                <table className="w-full text-sm min-w-[520px] print:min-w-0">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b-2 border-slate-200">
                      <th scope="col" className="py-2 pr-3">{t('thComponent')}</th>
                      <th scope="col" className="py-2 pr-3">{t('thGovt')}</th>
                      <th scope="col" className="py-2">{t('thPrivate')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.lines.map((line) => (
                      <tr key={line.label} className="border-b border-slate-100 align-top">
                        <th scope="row" className="py-2 pr-3 font-medium text-slate-700 text-left">{line.label}</th>
                        {line.unavailable ? (
                          <td colSpan={2} className="py-2 text-amber-800 font-semibold">{t('notReliablyPublishedExcluded')}</td>
                        ) : (
                          <>
                            <td className="py-2 pr-3 text-green-900 font-semibold">{formatRange(line.govt[0], line.govt[1])}</td>
                            <td className="py-2 text-sky-900 font-semibold">{formatRange(line.private[0], line.private[1])}</td>
                          </>
                        )}
                      </tr>
                    ))}
                    <tr className="border-t-2 border-slate-300">
                      <th scope="row" className="py-2.5 pr-3 font-extrabold text-slate-900 text-left">{t('indicativeTotal')}</th>
                      <td className="py-2.5 pr-3 font-black text-green-900">{formatRange(result.govtTotal[0], result.govtTotal[1])}</td>
                      <td className="py-2.5 font-black text-sky-900">{formatRange(result.privateTotal[0], result.privateTotal[1])}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Disclaimer */}
              <div className="border-t border-slate-100 px-5 py-4 text-[11px] leading-relaxed text-slate-500">
                <p className="flex items-start gap-1.5"><ShieldCheck size={14} className="mt-0.5 shrink-0 text-brand-700" />{result.disclaimer}</p>
                <p className="mt-2"><strong>{t('freeSubsidisedPrefix')}</strong>{t('freeSubsidisedBody')} <a href="https://nha.gov.in/PM-JAY" className="underline">NHA · PM-JAY</a></p>
                <p className="mt-2">{t('unsureWhereToGo')}{' '}
                  <Link href="/compare" className="text-brand-800 font-semibold underline">{t('compareHospitalsLink')}</Link>
                  {' '}{t('orWord')}{' '}
                  <Link href="/recommendations" className="text-brand-800 font-semibold underline">{t('getRecommendationLink')}</Link>.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
