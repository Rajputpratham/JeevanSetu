import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  MapPin, Navigation, PhoneCall, BedDouble, Stethoscope, CheckCircle2, Building2, Landmark,
  Siren, Info, Mail, ShieldCheck, XCircle, BadgeCheck, HelpCircle,
} from 'lucide-react';
import { HOSPITALS, getHospitalById } from '@/data/hospitals';
import DetailActions from '@/components/detail/DetailActions';
import MapViewClient from '@/components/MapViewClient';
import VerificationChip from '@/components/VerificationChip';

export function generateStaticParams() {
  return HOSPITALS.map((h) => ({ id: h.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const h = getHospitalById(id);
  if (!h) return { title: 'Hospital not found' };
  return {
    title: `${h.shortName} — Address, OPD Timings, Facilities & Costs`,
    description: `${h.name}: ${h.address}. ${h.type === 'government' ? 'Government' : 'Private'} hospital. Specialities: ${h.specialities.slice(0, 6).join(', ')}. ${h.emergency === 'verified' ? 'Verified 24×7 emergency services.' : ''} Contact and directions on JeevanSetu.`,
  };
}

const COST_LABEL: Record<string, string> = {
  'very-low': 'Very low — government-subsidised care',
  low: 'Low — heavily subsidised / public-trust',
  moderate: 'Moderate — private, mid-range pricing',
  high: 'High — corporate private tariffs',
};

export default async function HospitalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const h = getHospitalById(id);
  if (!h) notFound();

  const isGovt = h.type === 'government';
  const cover = isGovt ? '/images/hospital-govt.jpg' : '/images/hospital-private.jpg';

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 lg:py-10">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="text-sm text-slate-500">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li><Link href="/" className="hover:text-brand-800 hover:underline">Home</Link></li>
          <li aria-hidden="true">/</li>
          <li><Link href="/hospitals" className="hover:text-brand-800 hover:underline">Find Hospitals</Link></li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="font-semibold text-brand-900">{h.shortName}</li>
        </ol>
      </nav>

      {/* Header */}
      <header className="mt-3 card p-5 sm:p-7">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className={`rounded-2xl p-3.5 shrink-0 ${isGovt ? 'bg-green-100 text-green-800' : 'bg-sky-100 text-sky-800'}`} aria-hidden="true">
              {isGovt ? <Landmark size={30} /> : <Building2 size={30} />}
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-brand-950 leading-tight">{h.name}</h1>
              {h.tagline && <p className="mt-1 text-slate-600">{h.tagline}</p>}
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                <span className={isGovt ? 'chip' : 'chip-grey'}>{isGovt ? 'Government' : 'Private'} hospital</span>
                {h.emergency === 'verified' && <span className="chip-red"><Siren size={12} strokeWidth={2.5} />Verified 24×7 Emergency</span>}
                {h.emergency === 'unverified' && <span className="chip-amber"><HelpCircle size={12} />Emergency — unverified</span>}
                {h.emergency === 'none' && <span className="chip-grey"><XCircle size={12} />No general emergency</span>}
                <span className="chip-grey"><BedDouble size={12} />~{h.beds ?? '–'} beds (approx.)</span>
              </div>
            </div>
          </div>
        </div>
        {h.ownershipNote && <p className="mt-3 text-sm text-slate-600 border-l-4 border-brand-200 pl-3">{h.ownershipNote}</p>}
      </header>

      <div className="mt-5 grid gap-5 lg:grid-cols-3 items-start">
        {/* ─── Main column ─── */}
        <div className="lg:col-span-2 flex flex-col gap-5">
          {/* Representative image */}
          <figure className="card overflow-hidden">
            <Image src={cover} alt={`Representative image of a ${isGovt ? 'government' : 'private'} Indian hospital building`} width={1100} height={560} className="w-full h-48 sm:h-56 object-cover" />
            <figcaption className="px-4 py-2 text-[11px] text-slate-500 border-t border-slate-100">Representative image — not an actual photograph of this hospital.</figcaption>
          </figure>

          {/* Address + map */}
          <section aria-labelledby="addr" className="card p-5 sm:p-6">
            <h2 id="addr" className="flex items-center gap-2 font-extrabold text-lg text-slate-900"><MapPin className="text-brand-700" size={20} />Address &amp; Directions</h2>
            <p className="mt-2 text-slate-700 leading-relaxed">{h.address}</p>
            <p className="mt-1.5 text-xs text-slate-500">Coordinates are approximate (± a few hundred metres); Google Maps may snap to the main gate.</p>
            <div className="mt-4">
              <MapViewClient hospitals={[h]} center={{ lat: h.lat, lng: h.lng }} zoom={14} userLocation={null} />
            </div>
            <a href={`https://www.google.com/maps/dir/?api=1&destination=${h.lat},${h.lng}`} target="_blank" rel="noopener noreferrer" className="btn-secondary mt-4 w-full sm:w-auto">
              <Navigation size={18} /> Open directions in Google Maps
            </a>
          </section>

          {/* Specialities */}
          <section aria-labelledby="spec" className="card p-5 sm:p-6">
            <h2 id="spec" className="flex items-center gap-2 font-extrabold text-lg text-slate-900"><Stethoscope className="text-brand-700" size={20} />Specialities &amp; Departments</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {h.specialities.map((s) => <span key={s} className="chip">{s}</span>)}
            </div>
            <p className="mt-3 text-xs text-slate-500 flex items-start gap-1.5"><Info size={13} className="mt-0.5 shrink-0" />Doctor availability changes daily and cannot be reliably listed here. For the current roster of consultants, call the hospital OPD desk before you travel. Departments listed above are those the hospital publicly reports.</p>
          </section>

          {/* Facilities */}
          <section aria-labelledby="fac" className="card p-5 sm:p-6">
            <h2 id="fac" className="flex items-center gap-2 font-extrabold text-lg text-slate-900"><CheckCircle2 className="text-brand-700" size={20} />Facilities</h2>
            <ul className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
              {h.facilities.map((f) => (
                <li key={f} className="flex items-center gap-2 rounded-xl bg-brand-50 border border-brand-100 px-3 py-2.5 font-medium text-brand-900">
                  <CheckCircle2 size={15} className="text-brand-700 shrink-0" />{f}
                </li>
              ))}
            </ul>
            {h.emergency === 'verified' && h.emergencyNote && (
              <p className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-900"><Siren size={17} className="mt-0.5 shrink-0" />{h.emergencyNote}</p>
            )}
          </section>

          {/* OPD timings + cost profile */}
          <div className="grid sm:grid-cols-2 gap-5">
            <section aria-labelledby="opd" className="card p-5">
              <h2 id="opd" className="font-extrabold text-lg text-slate-900 flex items-center justify-between gap-2">OPD Timings <VerificationChip status={h.opdStatus} /></h2>
              <p className="mt-2 text-sm text-slate-700 leading-relaxed">{h.opdTimings ?? 'OPD timings not listed. Please call the hospital for current timings.'}</p>
              <p className="mt-2 text-[11px] text-slate-500">Timings are approximate and change during holidays and strikes. Confirm by phone.</p>
            </section>
            <section aria-labelledby="cost" className="card p-5">
              <h2 id="cost" className="font-extrabold text-lg text-slate-900">Cost Profile</h2>
              <p className="mt-2 text-sm font-semibold text-slate-800">{COST_LABEL[h.costProfile]}</p>
              <p className="mt-2 text-[11px] text-slate-500">JeevanSetu does not publish invented per-hospital bill amounts — Indian hospitals rarely publish itemised tariffs. Use our <Link href="/cost-estimator" className="underline text-brand-800 font-semibold">Cost Estimator</Link> for indicative ranges, and ask this hospital for a written estimate.</p>
            </section>
          </div>

          {h.dataNote && (
            <p className="flex items-start gap-2 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3"><Info size={14} className="mt-0.5 shrink-0" />{h.dataNote}</p>
          )}
        </div>

        {/* ─── Sticky contact column ─── */}
        <aside className="lg:sticky lg:top-24 flex flex-col gap-4">
          <div className="card p-5 sm:p-6">
            <h2 className="font-extrabold text-lg text-slate-900 flex items-center gap-2"><PhoneCall className="text-brand-700" size={20} />Contact &amp; Visit</h2>
            <dl className="mt-3 text-sm space-y-2.5 text-slate-700">
              <div><dt className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Phone (publicly listed)</dt>
                <dd className="font-semibold">{h.phone ? <a href={`tel:${h.phone}`} className="text-brand-800 hover:underline">{h.phone}</a> : 'Not listed — call 104 for directory assistance'}</dd></div>
              <div><dt className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Emergency</dt>
                <dd>{h.emergency === 'verified' ? 'Verified 24×7 emergency on site' : h.emergency === 'unverified' ? 'Emergency listed, not verified' : 'Not a general emergency facility'}</dd></div>
            </dl>
            <div className="mt-4"><DetailActions hospital={h} /></div>
          </div>

          {/* Verification legend */}
          <div className="card p-5">
            <h2 className="font-extrabold text-sm uppercase tracking-wider text-slate-700">How to read our labels</h2>
            <ul className="mt-2.5 space-y-2 text-xs text-slate-600">
              <li className="flex items-center gap-2"><BadgeCheck size={16} className="text-green-700 shrink-0" /><span><strong>Verified</strong> — cross-checked against public/official listings</span></li>
              <li className="flex items-center gap-2"><HelpCircle size={16} className="text-amber-700 shrink-0" /><span><strong>Unverified</strong> — commonly listed, not double-checked. Call to confirm.</span></li>
              <li className="flex items-center gap-2"><XCircle size={16} className="text-slate-500 shrink-0" /><span><strong>Not listed</strong> — no reliable public data. We never invent it.</span></li>
            </ul>
            <a href={`mailto:hello@jeevansetu.in?subject=${encodeURIComponent(`Correction: ${h.shortName}`)}`} className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-brand-800 hover:underline"><Mail size={13} />Report incorrect information</a>
          </div>

          <Link href="/emergency" className="flex items-center justify-center gap-2 bg-red-700 hover:bg-red-800 text-white font-extrabold rounded-2xl px-4 py-4"><Siren size={20} />Emergency? Call 112 first</Link>
        </aside>
      </div>
    </div>
  );
}
