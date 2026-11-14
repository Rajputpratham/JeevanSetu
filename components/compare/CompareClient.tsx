'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Search, X, Plus, Trash2, Printer, LocateFixed, Navigation, PhoneCall,
  Check, Minus, Info, GitCompareArrows, Trophy,
} from 'lucide-react';
import { useCompare, MAX_COMPARE } from '@/lib/compare';
import { useUserLocation } from '@/lib/useLocation';
import { HOSPITALS } from '@/data/hospitals';
import { TREATMENTS } from '@/data/treatments';
import { haversineKm, formatDistance, directionsUrl } from '@/lib/geo';
import { estimateTreatment } from '@/lib/cost-estimate';
import { formatRange } from '@/lib/format';
import { Hospital } from '@/data/types';

const KEY_FACILITIES = ['Emergency 24×7', 'ICU', 'Dialysis', 'Maternity & Delivery', 'Blood Bank', 'CT Scan', 'MRI', 'Ambulance', 'Diagnostic Lab', 'Operation Theatre'];

export default function CompareClient() {
  const { ids, add, remove, clear, full } = useCompare();
  const { location, requestGeolocation } = useUserLocation();
  const [query, setQuery] = useState('');
  const [treatmentId, setTreatmentId] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const selected = useMemo(() => ids.map((id) => HOSPITALS.find((h) => h.id === id)).filter((h): h is Hospital => !!h), [ids]);
  const treatment = treatmentId ? TREATMENTS.find((t) => t.id === treatmentId) ?? null : null;

  const candidates = useMemo(() => {
    const queryLower = query.trim().toLowerCase();
    if (!queryLower) return [];
    return HOSPITALS
      .filter((h) => !ids.includes(h.id))
      .filter((h) => [h.name, h.shortName, h.city, h.state, ...h.specialities, ...h.facilities].join(' ').toLowerCase().includes(queryLower))
      .slice(0, 8);
  }, [query, ids]);

  useEffect(() => { if (!full) setNotice(null); }, [full]);

  const tryAdd = (id: string) => {
    const ok = add(id);
    if (!ok) setNotice(`You can compare at most ${MAX_COMPARE} hospitals. Remove one first.`);
    else { setQuery(''); setNotice(null); }
  };

  const distances = selected.map((h) => haversineKm(location.lat, location.lng, h.lat, h.lng));

  // "Best" badges — computed only over selected hospitals
  const best = useMemo(() => {
    if (selected.length < 2) return { nearest: null as string | null, mostSpec: null as string | null, mostFac: null as string | null, cheapest: null as string | null };
    const nearest = selected[distances.indexOf(Math.min(...distances))]?.id ?? null;
    const mostSpec = selected.reduce((a, b) => (b.specialities.length > a.specialities.length ? b : a)).id;
    const mostFac = selected.reduce((a, b) => (b.facilities.length > a.facilities.length ? b : a)).id;
    let cheapest: string | null = null;
    if (treatment) {
      const est = selected.map((h) => {
        const e = estimateTreatment(treatment, { treatmentId: treatment.id, includedTests: treatment.tests.map((_, i) => i), stayDays: Math.max(treatment.roomPerDay ? treatment.typicalStayDays[0] : 0, 0), roomType: 'general' });
        const t = h.type === 'government' ? e.govtTotal : e.privateTotal;
        return { id: h.id, mid: (t[0] + t[1]) / 2 };
      });
      cheapest = est.reduce((a, b) => (b.mid < a.mid ? b : a)).id;
    }
    return { nearest, mostSpec, mostFac, cheapest };
  }, [selected, distances, treatment]);

  const estFor = (h: Hospital) => {
    if (!treatment) return null;
    const e = estimateTreatment(treatment, { treatmentId: treatment.id, includedTests: treatment.tests.map((_, i) => i), stayDays: treatment.roomPerDay ? Math.max(treatment.typicalStayDays[0], 1) : 0, roomType: 'general' });
    return h.type === 'government' ? e.govtTotal : e.privateTotal;
  };

  const colClass = selected.length === 3 ? 'minmax(200px,1fr)' : 'minmax(220px,1fr)';

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 print-hidden">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-brand-700">Feature 4 · Compare</p>
          <h1 className="mt-1 text-3xl sm:text-4xl font-extrabold tracking-tight text-brand-950">Compare Hospitals Side by Side</h1>
          <p className="mt-1 text-slate-600 max-w-2xl">Add up to {MAX_COMPARE} hospitals and compare the things a family actually weighs: distance, specialities, facilities, emergency care, costs, contact.</p>
        </div>
        <div className="flex gap-2">
          {selected.length >= 2 && <button type="button" onClick={() => window.print()} className="btn-secondary !py-2.5 !text-sm print-hidden"><Printer size={17} />Print / Save PDF</button>}
          {selected.length > 0 && <button type="button" onClick={clear} className="btn-ghost !text-sm text-red-700 hover:bg-red-50"><Trash2 size={17} />Clear all</button>}
        </div>
      </div>

      {/* Add hospital box */}
      <div className="print-hidden card mt-4 p-4 sm:p-5">
        <label htmlFor="compare-add" className="label">Add a hospital to compare {selected.length > 0 && <span className="font-normal text-slate-400">({selected.length}/{MAX_COMPARE} selected)</span>}</label>
        <div className="relative max-w-2xl">
          <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input id="compare-add" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, city, speciality or facility…" className="input !pl-12" autoComplete="off" aria-expanded={candidates.length > 0} aria-controls="compare-suggestions" />
          {candidates.length > 0 && (
            <ul id="compare-suggestions" role="listbox" className="absolute z-20 mt-1.5 w-full rounded-xl border border-slate-200 bg-white shadow-xl divide-y divide-slate-100 overflow-hidden">
              {candidates.map((h) => (
                <li key={h.id} role="option" aria-selected="false">
                  <button type="button" onClick={() => tryAdd(h.id)} className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-brand-50">
                    <span><span className="block font-semibold text-sm text-slate-800">{h.name}</span>
                      <span className="block text-[11px] text-slate-500">{h.city} · {h.type === 'government' ? 'Government' : 'Private'}</span></span>
                    <Plus size={18} className="text-brand-700 shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {notice && <p role="alert" className="mt-2 text-sm text-amber-800 font-medium">{notice}</p>}
        {query.trim().length >= 2 && candidates.length === 0 && (
          <p role="status" className="mt-2 text-sm text-slate-500">No hospital matches “{query.trim()}”. Try a city name like “Delhi” or “Lucknow”, or a speciality like “cardiology”.</p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span>Suggestions:</span>
          {['aiims-new-delhi', 'safdarjung-hospital', 'sir-ganga-ram-hospital', 'max-saket'].filter((id) => !ids.includes(id)).slice(0, 3).map((id) => {
            const h = HOSPITALS.find((x) => x.id === id)!;
            return <button key={id} type="button" onClick={() => tryAdd(id)} className="inline-flex items-center gap-1 rounded-full border border-brand-200 text-brand-800 font-semibold px-3 py-1.5 hover:bg-brand-50"><Plus size={13} />{h.shortName}</button>;
          })}
          <button type="button" onClick={requestGeolocation} className="inline-flex items-center gap-1.5 text-slate-500 hover:text-brand-800 font-semibold ml-auto"><LocateFixed size={14} />Distances from: {location.source === 'geolocation' ? 'your location' : location.label}</button>
        </div>
        {/* Optional cost row */}
        <div className="mt-3 max-w-md">
          <label htmlFor="cmp-treatment" className="label">Estimate cost for (optional)</label>
          <select id="cmp-treatment" value={treatmentId} onChange={(e) => setTreatmentId(e.target.value)} className="input appearance-none !py-2.5 !text-sm">
            <option value="">— no cost comparison —</option>
            {TREATMENTS.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      </div>

      {/* Empty state */}
      {selected.length === 0 && (
        <div className="card mt-6 p-10 text-center">
          <GitCompareArrows className="mx-auto text-brand-200" size={52} strokeWidth={1.5} />
          <h2 className="mt-3 font-extrabold text-2xl text-slate-800">Nothing to compare yet</h2>
          <p className="mt-1 text-slate-600 max-w-md mx-auto">Search above to add two or three hospitals — or tap “Compare” on any hospital card anywhere on JeevanSetu.</p>
          <Link href="/hospitals" className="btn-primary mt-5">Find hospitals to compare →</Link>
        </div>
      )}

      {/* Comparison table */}
      {selected.length > 0 && (
        <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-card">
          <div className="min-w-[720px] grid" style={{ gridTemplateColumns: `150px repeat(${selected.length}, ${colClass})` }}>
            {/* Header row */}
            <div className="bg-brand-950 text-white px-4 py-4 text-xs font-bold uppercase tracking-wider flex items-end">Side by side</div>
            {selected.map((h) => (
              <div key={h.id} className="bg-brand-950 text-white px-4 py-4">
                <p className="font-extrabold leading-snug">{h.name}</p>
                <p className="text-[11px] text-brand-200 mt-1">{h.city}, {h.state}</p>
                <button type="button" onClick={() => remove(h.id)} className="print-hidden mt-2 inline-flex items-center gap-1.5 text-[11px] font-bold text-red-300 hover:text-white border border-red-400/40 hover:border-white rounded-lg px-2.5 py-1.5">
                  <X size={13} /> Remove
                </button>
                <div className="print-hidden mt-2 flex gap-2">
                  {h.phone && <a href={`tel:${h.phone}`} aria-label={`Call ${h.shortName}`} className="text-brand-100 hover:text-white"><PhoneCall size={17} /></a>}
                  <a href={directionsUrl(h.lat, h.lng, h.shortName)} target="_blank" rel="noopener noreferrer" aria-label={`Directions to ${h.shortName}`} className="text-brand-100 hover:text-white"><Navigation size={17} /></a>
                </div>
              </div>
            ))}

            {/* Distance */}
            <Row label="Distance from you">
              {selected.map((h, i) => (
                <Cell key={h.id}><p className="text-lg font-extrabold text-brand-900">{formatDistance(distances[i])}</p>
                  {best.nearest === h.id && <Badge text="Nearest" />}</Cell>
              ))}
            </Row>

            {/* Type */}
            <Row label="Type" zebra>
              {selected.map((h) => (
                <Cell key={h.id}><span className={h.type === 'government' ? 'chip' : 'chip-grey'}>{h.type === 'government' ? 'Government' : 'Private'}</span>
                  <p className="mt-1.5 text-[11px] text-slate-500 capitalize">{h.costProfile.replace('-', ' ')} cost profile</p></Cell>
              ))}
            </Row>

            {/* Emergency */}
            <Row label="Emergency 24×7">
              {selected.map((h) => (
                <Cell key={h.id}>
                  {h.emergency === 'verified'
                    ? <span className="chip-red"><Check size={12} strokeWidth={3} />Verified 24×7</span>
                    : h.emergency === 'unverified'
                      ? <span className="chip-amber">Unverified</span>
                      : <span className="chip-grey">Not available</span>}
                  {h.emergencyNote && <p className="mt-1.5 text-[10px] text-slate-500">{h.emergencyNote}</p>}
                </Cell>
              ))}
            </Row>

            {/* OPD */}
            <Row label="OPD timings" zebra>
              {selected.map((h) => (
                <Cell key={h.id}><p className="text-[12px] text-slate-700 leading-snug">{h.opdTimings ?? 'Not listed — call to confirm.'}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-wide font-bold text-slate-400">{h.opdStatus}</p></Cell>
              ))}
            </Row>

            {/* Beds */}
            <Row label="Beds (approx.)">
              {selected.map((h) => <Cell key={h.id}>{h.beds ? <p className="font-bold">~{h.beds.toLocaleString('en-IN')}</p> : <span className="text-slate-400">Not listed</span>}</Cell>)}
            </Row>

            {/* Specialities */}
            <Row label="Specialities" zebra>
              {selected.map((h) => (
                <Cell key={h.id}>
                  <p className="font-extrabold text-brand-900">{h.specialities.length} departments {best.mostSpec === h.id && best.nearest !== null && selected.length > 1 && <Badge text="Most" />}</p>
                  <div className="mt-1 flex flex-wrap gap-1">{h.specialities.slice(0, 6).map((s) => <span key={s} className="text-[10px] rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">{s}</span>)}{h.specialities.length > 6 && <span className="text-[10px] text-slate-400">+{h.specialities.length - 6}</span>}</div>
                </Cell>
              ))}
            </Row>

            {/* Key facilities */}
            <Row label="Key facilities">
              {selected.map((h) => (
                <Cell key={h.id}>
                  <ul className="text-[11px] space-y-1">
                    {KEY_FACILITIES.map((f) => {
                      const has = h.facilities.includes(f);
                      return (
                        <li key={f} className="flex items-center gap-1.5">
                          {has ? <Check size={12} strokeWidth={3} className="text-green-700 shrink-0" /> : <Minus size={12} strokeWidth={3} className="text-slate-300 shrink-0" />}
                          <span className={has ? 'text-slate-800 font-medium' : 'text-slate-400'}>{f}</span>
                        </li>
                      );
                    })}
                  </ul>
                  <p className="mt-1.5 text-[10px] text-slate-500">{h.facilities.length} facilities listed in total {best.mostFac === h.id && selected.length > 1 && <Badge text="Most" />}</p>
                </Cell>
              ))}
            </Row>

            {/* Cost estimate row — only when treatment selected */}
            {treatment && (
              <Row label={`Est. cost — ${treatment.name}`} zebra>
                {selected.map((h) => {
                  const est = estFor(h)!;
                  return (
                    <Cell key={h.id}>
                      <p className="font-extrabold text-slate-900 leading-snug">{formatRange(est[0], est[1])}</p>
                      <p className="text-[10px] text-slate-500">{h.type === 'government' ? 'Government' : 'Private'} indicative range</p>
                      {best.cheapest === h.id && <Badge text="Lowest est. cost" />}
                    </Cell>
                  );
                })}
              </Row>
            )}

            {/* Contact */}
            <Row label="Contact" zebra={!treatment}>
              {selected.map((h) => (
                <Cell key={h.id}>
                  {h.phone
                    ? <a href={`tel:${h.phone}`} className="inline-flex items-center gap-1.5 text-sm font-bold text-brand-800 hover:underline"><PhoneCall size={14} />{h.phone}</a>
                    : <span className="text-xs text-slate-500">Not listed — call 104</span>}
                  <div className="mt-1.5 flex flex-col gap-1">
                    <a href={directionsUrl(h.lat, h.lng, h.shortName)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-800 hover:underline"><Navigation size={12} />Get directions</a>
                    <Link href={`/hospitals/${h.id}`} className="text-xs font-bold text-brand-800 hover:underline">Full details →</Link>
                  </div>
                </Cell>
              ))}
            </Row>

            {/* Decision strip */}
            <div className="grid col-span-full bg-amber-50 border-t border-amber-200 px-4 py-3 text-[11px] text-amber-950 flex items-start gap-2">
              <Info size={15} className="mt-0.5 shrink-0" />
              <p>“<strong>Lowest cost</strong>” compares indicative ranges, not clinical quality — a corporate hospital may charge more but offer faster access, and a government hospital may be far cheaper but busier. Cost ranges are from public CGHS/PM-JAY/tariff references, not quotes. Confirm by phone before travelling. <Link href="/disclaimer" className="underline font-bold">Read our data &amp; disclaimer →</Link></p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, children, zebra = false }: { label: string; children: React.ReactNode; zebra?: boolean }) {
  return (
    <>
      <div className={`px-4 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 self-stretch flex items-center border-t border-slate-100 ${zebra ? 'bg-slate-50/70' : ''}`}>{label}</div>
      {children}
    </>
  );
}
function Cell({ children, zebra = false }: { children: React.ReactNode; zebra?: boolean }) {
  return <div className={`px-4 py-3 border-t border-slate-100 ${zebra ? 'bg-slate-50/40' : ''}`}>{children}</div>;
}
function Badge({ text }: { text: string }) {
  return <span className="print-hidden mt-1.5 inline-flex items-center gap-1 rounded-full bg-amber-100 border border-amber-300 text-amber-900 text-[10px] font-extrabold uppercase tracking-wide px-2 py-0.5"><Trophy size={11} />{text}</span>;
}
