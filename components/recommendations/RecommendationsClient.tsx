'use client';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Sparkles, Loader2, LocateFixed, CheckCircle2, AlertTriangle, PhoneCall,
  Stethoscope, Info, AlertCircle, Landmark, Building2, ShieldCheck,
} from 'lucide-react';
import { useUserLocation } from '@/lib/useLocation';
import { ALL_SPECIALITIES } from '@/data/hospitals';
import { specialityForProblem } from '@/lib/recommend';
import { formatDistance } from '@/lib/geo';

interface RecResult {
  hospital: { id: string; name: string; shortName: string; type: 'government' | 'private'; phone: string | null; emergency: string; facilities: string[]; costProfile: string };
  distanceKm: number;
  score: number;
  reasons: string[];
  cautions: string[];
}

const FACILITY_OPTIONS = ['Emergency 24×7', 'ICU', 'Dialysis', 'Maternity & Delivery', 'Blood Bank', 'CT Scan', 'MRI', 'Ambulance', 'Cashless / Insurance Desk'];

export default function RecommendationsClient({ initialSpeciality }: { initialSpeciality?: string }) {
  const { location, requestGeolocation, status: geoStatus } = useUserLocation();

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

  const run = useCallback(async (spec: string) => {
    setBusy(true); setError(null); setResults(null);
    const params = new URLSearchParams({
      speciality: spec, type: typePref, budget,
      facilities: facilities.join(','),
      lat: String(location.lat), lng: String(location.lng),
    });
    try {
      const res = await fetch(`/api/recommendations?${params}`);
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Could not generate recommendations.'); return; }
      setResults(data.results ?? []);
      setUsedSpeciality(data.speciality);
      setMappedFrom(data.mappedFromProblem ? problem.trim() : null);
    } catch {
      setError('Network error — please check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }, [typePref, budget, facilities, location.lat, location.lng, problem]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const spec = speciality || mappedCandidate || '';
    if (!spec) {
      setError('Please describe your problem or pick a speciality from the list.');
      return;
    }
    run(spec);
  };

  // Auto-run when arriving with ?speciality=
  useEffect(() => {
    if (initialSpeciality && ALL_SPECIALITIES.includes(initialSpeciality)) run(initialSpeciality);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleFacility = (f: string) =>
    setFacilities((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
      <p className="text-xs font-bold uppercase tracking-widest text-brand-700">Feature 2 · Smart Recommendations</p>
      <h1 className="mt-1 text-3xl sm:text-4xl font-extrabold tracking-tight text-brand-950">Which hospital is right for you?</h1>
      <p className="mt-1 text-slate-600 max-w-2xl">Tell us the problem, your budget and what matters to you. JeevanSetu ranks hospitals on <strong>medical suitability, affordability and accessibility</strong> — not just distance — and explains every suggestion.</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-5 items-start">
        {/* ─── Input panel ─── */}
        <form onSubmit={onSubmit} className="lg:col-span-2 card p-5 sm:p-6 flex flex-col gap-5" aria-label="Recommendation form">
          <div>
            <label htmlFor="problem" className="label">What is the problem? <span className="font-normal text-slate-400">(optional)</span></label>
            <input id="problem" className="input" placeholder="e.g. chest pain, pregnancy, child fever, knee pain…" value={problem} onChange={(e) => setProblem(e.target.value)} autoComplete="off" />
            {mappedCandidate && <p className="mt-1.5 text-xs font-semibold text-brand-800 flex items-center gap-1.5"><Stethoscope size={13} />Looks like <strong>{mappedCandidate}</strong></p>}
          </div>

          <div>
            <label htmlFor="spec" className="label">Or choose a speciality <span aria-hidden="true" className="text-red-700">*</span></label>
            <select id="spec" className="input appearance-none" value={speciality} onChange={(e) => setSpeciality(e.target.value)}>
              <option value="">— Select speciality —</option>
              {ALL_SPECIALITIES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <p className="mt-1 text-[11px] text-slate-500">If you typed a problem above, we map it automatically.</p>
          </div>

          <fieldset>
            <legend className="label">Hospital type</legend>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Hospital type">
              {([['any', 'No preference'], ['government', 'Government'], ['private', 'Private']] as const).map(([val, lab]) => (
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
            <legend className="label">Budget for this treatment episode</legend>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" role="radiogroup" aria-label="Budget">
              {([['any', 'Any'], ['low', 'Under ₹50k'], ['medium', '₹50k–2L'], ['high', 'Over ₹2L']] as const).map(([val, lab]) => (
                <button key={val} type="button" role="radio" aria-checked={budget === val} onClick={() => setBudget(val)}
                  className={`rounded-xl border-2 px-2 py-2.5 text-sm font-bold min-h-[48px] transition-colors ${
                    budget === val ? 'border-brand-700 bg-brand-700 text-white' : 'border-slate-200 text-slate-600 hover:border-brand-400'
                  }`}>{lab}</button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="label">Facilities you need <span className="font-normal text-slate-400">(optional)</span></legend>
            <div className="flex flex-wrap gap-2">
              {FACILITY_OPTIONS.map((f) => {
                const active = facilities.includes(f);
                return (
                  <button key={f} type="button" onClick={() => toggleFacility(f)} aria-pressed={active}
                    className={`rounded-full border px-3 py-2 text-xs font-semibold transition-colors ${
                      active ? 'border-brand-700 bg-brand-700 text-white' : 'border-slate-200 text-slate-600 hover:border-brand-400'
                    }`}>{f}</button>
                );
              })}
            </div>
          </fieldset>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 border-t border-slate-100 pt-4">
            <button type="submit" disabled={busy} className="btn-primary flex-1">
              {busy ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
              {busy ? 'Finding matches…' : 'Get Recommendations'}
            </button>
            <button type="button" onClick={requestGeolocation} disabled={geoStatus === 'locating'} className="btn-ghost text-sm" title="Refresh distance from your location">
              {geoStatus === 'locating' ? <Loader2 size={17} className="animate-spin" /> : <LocateFixed size={17} />}
              {location.source === 'geolocation' ? 'Location on' : 'Use my location'}
            </button>
          </div>
          <p className="text-[11px] text-slate-500 -mt-2 flex items-center gap-1.5"><ShieldCheck size={12} />Distances from: {location.label}</p>
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
              <h2 className="mt-3 font-bold text-xl text-slate-800">Your recommendations will appear here</h2>
              <p className="mt-1.5 text-sm text-slate-600 max-w-md mx-auto">Answer on the left — for example “chest pain” with a budget under ₹50k — and we will rank the most suitable hospitals near you with clear reasons.</p>
              <p className="mt-4 inline-flex items-start gap-1.5 text-[11px] text-slate-500 max-w-md"><Info size={13} className="mt-0.5 shrink-0" />Recommendations are decision support, not medical advice, diagnosis or endorsement. Always confirm services by phone before travelling.</p>
            </div>
          )}

          {busy && [0, 1, 2].map((i) => <div key={i} className="card p-5 mb-4 h-40 animate-pulse" aria-hidden="true" />)}

          {results !== null && results.length === 0 && !busy && (
            <div className="card p-8 text-center">
              <AlertCircle className="mx-auto text-amber-500" size={36} />
              <h2 className="mt-2 font-bold text-lg text-slate-800">No listed hospital currently matches</h2>
              <p className="mt-1 text-sm text-slate-600">No hospital in our dataset has the speciality “{usedSpeciality}”. Try a nearby city, or see a general-medicine hospital first for a referral.</p>
              <Link href="/hospitals" className="btn-secondary mt-4">Browse all hospitals →</Link>
            </div>
          )}

          {results !== null && results.length > 0 && !busy && (
            <>
              <p className="text-sm text-slate-600">
                Showing <strong>{results.length}</strong> best-match hospital{results.length === 1 ? '' : 's'} for <strong className="text-brand-800">{usedSpeciality}</strong>
                {mappedFrom && <> (mapped from “{mappedFrom}”)</>}.
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
                            <p className="text-xs text-slate-500 mt-1">{h.type === 'government' ? 'Government — very low cost' : 'Private — moderate/high cost'} · {formatDistance(r.distanceKm)} away {h.emergency === 'verified' && '· Emergency 24×7 verified'}</p>
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 grid sm:grid-cols-2 gap-3 text-[13px]">
                        <div className="rounded-xl bg-green-50 border border-green-100 p-3">
                          <p className="text-[10px] font-extrabold uppercase tracking-wider text-green-800">Why this matches</p>
                          <ul className="mt-1.5 space-y-1">
                            {r.reasons.slice(0, 4).map((reason) => (
                              <li key={reason} className="flex items-start gap-1.5 text-green-950"><CheckCircle2 size={13} className="mt-0.5 shrink-0" />{reason}</li>
                            ))}
                          </ul>
                        </div>
                        {r.cautions.length > 0 && (
                          <div className="rounded-xl bg-amber-50 border border-amber-100 p-3">
                            <p className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800">Please note</p>
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
                          : <span className="inline-flex items-center text-xs text-slate-500 py-2.5">Phone not listed — call 104</span>}
                        <Link href={`/hospitals/${h.id}`} className="inline-flex items-center gap-2 border-2 border-brand-700 text-brand-800 rounded-xl px-4 py-2.5 text-sm font-bold hover:bg-brand-50 min-h-[44px]">View details →</Link>
                      </div>
                    </li>
                  );
                })}
              </ol>
              <p className="mt-4 text-[11px] text-slate-500 flex items-start gap-1.5"><Info size={13} className="mt-0.5 shrink-0" />Ranking weighs speciality availability (required), distance, budget fit, requested facilities and verified emergency care. It is not a medical diagnosis or endorsement of any hospital. A cheaper hospital is not always clinically appropriate — ask your doctor where needed.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
