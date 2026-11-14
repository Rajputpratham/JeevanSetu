import type { Metadata } from 'next';
import { ShieldAlert } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Disclaimer & Data Sources — JeevanSetu',
  description: 'What JeevanSetu data means and does not mean: verification statuses, cost range sourcing, medical disclaimer and how to report errors.',
};

export default function DisclaimerPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
      <p className="text-xs font-bold uppercase tracking-widest text-brand-700">Legal</p>
      <h1 className="mt-2 text-3xl sm:text-4xl font-extrabold tracking-tight text-brand-950 flex items-center gap-3"><ShieldAlert size={34} className="text-amber-600" />Disclaimer &amp; Data Sources</h1>
      <p className="mt-2 text-sm text-slate-500">Please read this before relying on any number on this page.</p>

      <section className="mt-7">
        <h2 className="font-extrabold text-xl text-slate-900">Not medical advice</h2>
        <p className="mt-1.5 text-slate-700 leading-relaxed">JeevanSetu is an <strong>information and navigation service</strong>. Nothing on this site — search results, recommendations, cost estimates or emergency listings — is medical advice, a diagnosis, or a guarantee that a hospital will treat you. Always consult a qualified doctor. In a life-threatening emergency, <a href="tel:112" className="font-bold text-red-700">call 112</a> immediately and do not delay care to use this website.</p>
      </section>

      <section className="mt-7">
        <h2 className="font-extrabold text-xl text-slate-900">Verification statuses we use</h2>
        <ul className="mt-2 list-disc list-inside space-y-1.5 text-slate-700">
          <li><strong>Verified</strong> — cross-checked against public/official sources at the time of listing (e.g., a hospital’s own site or government directory).</li>
          <li><strong>Unverified</strong> — commonly listed in public sources but not double-checked by us. Treat as a starting point; <strong>call the hospital before you travel</strong>.</li>
          <li><strong>Not listed</strong> — we could not find reliable public data. We deliberately show nothing rather than invent it.</li>
        </ul>
        <p className="mt-2 text-sm text-slate-600">Bed counts, OPD timings and coordinates are approximate. Coordinates may be off by a few hundred metres. Hospital phone numbers change — always confirm the current number via the hospital or 104 before relying on it.</p>
      </section>

      <section className="mt-7">
        <h2 className="font-extrabold text-xl text-slate-900">Where our numbers come from</h2>
        <p className="mt-1.5 text-slate-700">Cost ranges are compiled from public references, principally: CGHS (Central Government Health Scheme) rate lists; PM-JAY (Ayushman Bharat) package ceilings; state government health-scheme package rates (e.g., state Arogya/BPL schemes); and published private-hospital tariff sheets and consumer-reported bills. They are indicative only — actual charges vary by city, hospital, room category, clinician, implants/consumables, length of stay and complications.</p>
        <p className="mt-2 text-slate-700">JeevanSetu does <strong>not</strong> publish fabricated per-hospital bill amounts: Indian hospitals rarely publish itemised tariffs publicly, so hospital-level prices would be made up. Instead we publish typical government vs private ranges for standard episodes of care, and we say clearly when even that is unavailable (e.g., chemotherapy drug regimens, whose cost varies by an order of magnitude).</p>
      </section>

      <section className="mt-7">
        <h2 className="font-extrabold text-xl text-slate-900">Free &amp; subsidised care schemes mentioned</h2>
        <ul className="mt-2 list-disc list-inside space-y-1.5 text-slate-700">
          <li>Janani Suraksha Yojana (JSY) — cash assistance + free delivery for eligible pregnant women in government facilities.</li>
          <li>Pradhan Mantri National Dialysis Programme — free dialysis at participating district hospitals.</li>
          <li>National Programme for Control of Blindness — free cataract surgery at many government centres.</li>
          <li>PM-JAY / Ayushman Bharat — health cover up to ₹5 lakh per family per year at empanelled hospitals (eligibility depends on SECC/category).</li>
          <li>CGHS — subsidised care for central government beneficiaries.</li>
        </ul>
        <p className="mt-2 text-sm text-slate-600">Scheme eligibility is determined by the hospital and scheme authorities — not by JeevanSetu. Always ask the hospital help desk whether you qualify.</p>
      </section>

      <section className="mt-7">
        <h2 className="font-extrabold text-xl text-slate-900">Errors and corrections</h2>
        <p className="mt-1.5 text-slate-700">Found something wrong? Email <a href="mailto:hello@jeevansetu.in" className="text-brand-800 font-semibold underline">hello@jeevansetu.in</a> with the hospital name, what is incorrect and (ideally) a public source for the correction. We review and update listings promptly.</p>
      </section>

      <p className="mt-8 text-xs text-slate-400">JeevanSetu is an independent public-interest project and is not affiliated with any hospital, government body or insurer listed on this site.</p>
    </div>
  );
}
