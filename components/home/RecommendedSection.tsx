'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sparkles, PhoneCall, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useUserLocation } from '@/lib/useLocation';
import { formatDrivingKm } from '@/lib/geo';

interface RecItem {
  hospital: { id: string; name: string; type: 'government' | 'private'; phone: string | null; emergency: string; shortName: string };
  /** Google Routes driving distance, or null when no origin has been shared. */
  distanceKm: number | null;
  etaMinutes?: number | null;
  reasons: string[];
  cautions: string[];
}

export default function RecommendedSection() {
  const { location, hasLocation } = useUserLocation();
  const [items, setItems] = useState<RecItem[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const query = hasLocation
      ? `/api/recommendations?speciality=General%20Medicine&type=any&budget=low&lat=${location.lat}&lng=${location.lng}`
      : '/api/recommendations?speciality=General%20Medicine&type=any&budget=low';
    fetch(query)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((data) => { if (!cancelled) setItems((data.results ?? []).slice(0, 3)); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [location.lat, location.lng, hasLocation]);

  return (
    <section aria-labelledby="rec-heading" className="bg-brand-50/60 border-y border-brand-100">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-700">Step 2 · Choose</p>
        <h2 id="rec-heading" className="section-title mt-1">Recommended for your needs</h2>
        <p className="section-sub text-sm">Sample recommendations for <strong>general medicine</strong> near you, balancing suitability, affordability and distance — not just the closest hospital. Your need may differ:</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {['Cardiology', 'Gynaecology & Obstetrics', 'Paediatrics', 'Orthopaedics', 'Oncology', 'Nephrology'].map((s) => (
            <Link key={s} href={`/recommendations?speciality=${encodeURIComponent(s)}`} className="chip hover:bg-brand-100 transition-colors">{s}</Link>
          ))}
        </div>

        {failed ? (
          <p role="alert" className="mt-6 text-sm text-red-700">Could not load recommendations. <Link href="/recommendations" className="underline font-semibold">Open the recommendation tool →</Link></p>
        ) : items === null ? (
          <div className="mt-6 grid md:grid-cols-3 gap-4" aria-busy="true">
            {[0, 1, 2].map((i) => <div key={i} className="card p-5 h-44 animate-pulse bg-white" />)}
          </div>
        ) : (
          <div className="mt-6 grid md:grid-cols-3 gap-4">
            {items.map(({ hospital, distanceKm, reasons, cautions }) => (
              <div key={hospital.id} className="card p-5 flex flex-col">
                <div className="flex items-center gap-2 text-brand-700"><Sparkles size={16} aria-hidden="true" /><span className="text-[11px] font-bold uppercase tracking-wider">{reasons.length} match reasons</span></div>
                <h3 className="mt-1.5 font-bold text-slate-900 leading-snug"><Link href={`/hospitals/${hospital.id}`} className="hover:text-brand-800 hover:underline">{hospital.shortName}</Link></h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {hospital.type === 'government' ? 'Government' : 'Private'}
                  {' · '}
                  {formatDrivingKm(distanceKm) ? `${formatDrivingKm(distanceKm)} driving distance` : 'share your location for driving distance'}
                </p>
                <ul className="mt-2.5 space-y-1 text-[13px] text-slate-700">
                  {reasons.slice(0, 3).map((r) => (
                    <li key={r} className="flex items-start gap-1.5"><CheckCircle2 size={13} className="mt-0.5 text-green-700 shrink-0" />{r}</li>
                  ))}
                  {cautions.slice(0, 1).map((c) => (
                    <li key={c} className="flex items-start gap-1.5 text-amber-800"><AlertTriangle size={13} className="mt-0.5 shrink-0" />{c}</li>
                  ))}
                </ul>
                <div className="mt-auto pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  {hospital.phone
                    ? <a href={`tel:${hospital.phone}`} className="inline-flex items-center gap-1.5 text-sm font-bold text-brand-800 hover:underline"><PhoneCall size={15} />Call</a>
                    : <span className="text-xs text-slate-400">Number not listed</span>}
                  <Link href={`/hospitals/${hospital.id}`} className="text-sm font-bold text-brand-800 hover:underline">Details →</Link>
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="mt-5 text-xs text-slate-500">Suggestions are generated from listed information — they are not a medical diagnosis or endorsement. <Link href="/recommendations" className="font-semibold text-brand-800 underline">Get recommendations for your exact need →</Link></p>
      </div>
    </section>
  );
}
