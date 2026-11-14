'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { TREATMENTS } from '@/data/treatments';
import { estimateTreatment } from '@/lib/cost-estimate';
import { formatINR } from '@/lib/format';
import { Calculator, Info } from 'lucide-react';

export default function CostTeaser() {
  const [treatmentId, setTreatmentId] = useState(TREATMENTS[6].id); // normal delivery
  const treatment = TREATMENTS.find((t) => t.id === treatmentId)!;
  const estimate = useMemo(
    () => estimateTreatment(treatment, {
      treatmentId: treatment.id,
      includedTests: treatment.tests.map((_, i) => i),
      stayDays: treatment.typicalStayDays[0],
      roomType: 'general',
    }),
    [treatment],
  );

  return (
    <section aria-labelledby="cost-teaser" className="bg-white border-y border-brand-100">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14 grid gap-8 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-brand-700">Step 4 · Estimate</p>
          <h2 id="cost-teaser" className="section-title mt-1 flex items-center gap-3"><Calculator className="text-brand-700" size={30} />What might it cost?</h2>
          <p className="section-sub">Itemised estimate — consultation, tests, procedure, room and medicines — comparing government and private hospitals. Prices are indicative, always ask for a written estimate.</p>
          <ul className="mt-4 text-sm text-slate-600 space-y-1.5 list-disc list-inside">
            <li>Government rates often 5–10× lower than private</li>
            <li>Many services are free for eligible patients (JSY, PM-JAY, NPCB)</li>
            <li>Missing pricing data is shown as “not available”, never invented</li>
          </ul>
          <Link href="/cost-estimator" className="btn-primary mt-6">Open full cost estimator →</Link>
        </div>
        <div className="card p-5 sm:p-6">
          <label htmlFor="teaser-treatment" className="label">Choose a treatment</label>
          <select id="teaser-treatment" value={treatmentId} onChange={(e) => setTreatmentId(e.target.value)} className="input appearance-none">
            {TREATMENTS.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border-2 border-green-700/30 bg-green-50 p-4 text-center">
              <p className="text-[11px] font-bold uppercase tracking-wider text-green-800">Government</p>
              <p className="mt-1 text-xl sm:text-2xl font-extrabold text-green-900 leading-tight">{formatINR(estimate.govtTotal[0])}<br /><span className="text-sm font-bold text-green-800">to</span><br />{formatINR(estimate.govtTotal[1])}</p>
            </div>
            <div className="rounded-2xl border-2 border-sky-700/30 bg-sky-50 p-4 text-center">
              <p className="text-[11px] font-bold uppercase tracking-wider text-sky-800">Private</p>
              <p className="mt-1 text-xl sm:text-2xl font-extrabold text-sky-900 leading-tight">{formatINR(estimate.privateTotal[0])}<br /><span className="text-sm font-bold text-sky-800">to</span><br />{formatINR(estimate.privateTotal[1])}</p>
            </div>
          </div>
          <p className="mt-3 flex items-start gap-1.5 text-[11px] text-slate-500"><Info size={13} className="mt-0.5 shrink-0" />Indicative ranges from public CGHS / PM-JAY / tariff references. Actual bills vary — see the full estimator for itemised controls and disclaimers.</p>
        </div>
      </div>
    </section>
  );
}
