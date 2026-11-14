'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  PhoneCall, Navigation, Ambulance, Siren, CheckCircle2, AlertOctagon,
  HeartPulse, Flame, Baby, ListChecks, Loader2, Info,
} from 'lucide-react';
import { useUserLocation } from '@/lib/useLocation';
import { directionsUrl } from '@/lib/geo';
import { HELPLINES } from '@/data/helplines';
import { Hospital } from '@/data/types';

type EmergencyHospital = Hospital & { distanceKm: number };

export default function EmergencyClient() {
  const { location, requestGeolocation, status: geoStatus } = useUserLocation();
  const [hospitals, setHospitals] = useState<EmergencyHospital[] | null>(null);
  const [verifiedOnly, setVerifiedOnly] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setHospitals(null); setError(null);
    fetch(`/api/emergency?lat=${location.lat}&lng=${location.lng}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((d) => { if (!cancelled) setHospitals(d.hospitals ?? []); })
      .catch(() => { if (!cancelled) setError('Could not load hospital list. If this is an emergency, call 112 NOW — help can be reached even without browsing.'); });
    return () => { cancelled = true; };
  }, [location.lat, location.lng]);

  const shown = useMemo(
    () => (hospitals ?? []).filter((h) => (verifiedOnly ? h.emergency === 'verified' : true)),
    [hospitals, verifiedOnly],
  );

  return (
    <div>
      {/* ─── Emergency hero ─── */}
      <section className="bg-red-800 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 lg:py-14 grid gap-8 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-red-200 flex items-center gap-2"><Siren size={16} />Feature 6 · Emergency Assistance</p>
            <h1 className="mt-2 text-4xl sm:text-5xl font-black tracking-tight leading-[1.05]">In an emergency,<br />call 112 first.</h1>
            <p className="mt-3 text-red-100 text-lg leading-snug">Free from any phone anywhere in India. Ambulance, police and fire — one number. <strong className="text-white">Do not wait for this website.</strong></p>
            <a href="tel:112" className="mt-6 inline-flex w-full sm:w-auto items-center justify-center gap-4 bg-white text-red-800 rounded-2xl px-8 py-6 shadow-2xl hover:bg-red-50 transition-colors">
              <PhoneCall size={40} strokeWidth={2.5} />
              <span className="text-left"><span className="block text-5xl font-black leading-none">112</span>
                <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider">Tap to call now · works even without balance</span></span>
            </a>
            <button type="button" onClick={requestGeolocation} disabled={geoStatus === 'locating'} className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-red-100 underline underline-offset-4 hover:text-white">
              {geoStatus === 'locating' ? <Loader2 size={15} className="animate-spin" /> : null}
              Distances shown from: {location.source === 'geolocation' ? 'your current location' : location.label} — tap to update
            </button>
          </div>
          <div className="bg-red-900/60 border border-red-700 rounded-3xl p-6">
            <h2 className="font-extrabold text-xl flex items-center gap-2"><ListChecks size={22} />While waiting for help</h2>
            <ol className="mt-3 space-y-2.5 text-sm text-red-50 list-none">
              {[
                'Call 112. Say: your exact location, what happened, how many people are hurt, and your phone number. Stay calm.',
                'Keep the patient still, warm and conscious if possible. Do NOT give food or water to someone with severe injuries or vomiting.',
                'For heavy bleeding: press firmly with clean cloth. For burns: cool with running water 10+ minutes, no ice, no butter/oil.',
                'For chest pain: let the person sit upright and rest. Loosen tight clothes. Aspirin only if not allergic and not told otherwise.',
                'For fits: clear the area, protect the head, do NOT restrain or put anything in the mouth, note the time of the seizure.',
                'Send someone to guide the ambulance to the gate. Keep your phone line free after calling.',
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-2.5"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-red-800 text-xs font-black">{i + 1}</span>{step}</li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* ─── Helplines grid ─── */}
      <section aria-labelledby="helplines" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        <h2 id="helplines" className="section-title !text-2xl">Important helplines (all India)</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {HELPLINES.map((h) => (
            <a key={h.number} href={`tel:${h.number}`} className="card p-4 hover:shadow-lg hover:-translate-y-0.5 transition-all text-center group">
              <span className="block text-2xl font-black text-brand-800 group-hover:text-brand-600">{h.number}</span>
              <span className="mt-1 block text-xs font-bold text-slate-800 leading-snug">{h.label}</span>
              <span className="mt-1 block text-[10px] text-slate-500 leading-snug">{h.detail}</span>
            </a>
          ))}
        </div>
      </section>

      {/* ─── Common emergency cards ─── */}
      <section aria-labelledby="situations" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-10 grid gap-4 sm:grid-cols-3">
        {[
          { icon: HeartPulse, title: 'Heart attack / chest pain', body: 'Call 112. Sit upright, rest, loosen clothing. Unlock the door and send someone to meet the ambulance. Every minute matters.' },
          { icon: Flame, title: 'Burns & fire', body: 'Move away from fire. Cool the burn under running tap water for at least 10 minutes. No ice, no toothpaste, no oil. Cover loosely with clean cloth. Call 112.' },
          { icon: Baby, title: 'Child / pregnancy emergencies', body: 'Call 102 or 112 — pregnant women and infants get priority ambulances in most states. If delivery seems imminent, call and say so immediately.' },
        ].map(({ icon: Icon, title, body }) => (
          <div key={title} className="card p-5 border-l-4 !border-l-red-600">
            <Icon className="text-red-700" size={26} aria-hidden="true" />
            <h3 className="mt-2 font-extrabold text-slate-900">{title}</h3>
            <p className="mt-1 text-sm text-slate-600 leading-relaxed">{body}</p>
          </div>
        ))}
      </section>

      {/* ─── Nearby emergency hospitals ─── */}
      <section aria-labelledby="nearby-emergency" className="bg-slate-50 border-t border-slate-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="nearby-emergency" className="section-title !text-2xl">Hospitals near you with emergency services</h2>
              <p className="section-sub text-sm">Sorted by distance from your location. Distances are approximate — always call ahead if you can.</p>
            </div>
            <div className="flex rounded-xl border border-slate-200 overflow-hidden text-sm font-bold" role="group" aria-label="Filter emergency list">
              <button type="button" onClick={() => setVerifiedOnly(true)} aria-pressed={verifiedOnly} className={`px-4 py-2.5 ${verifiedOnly ? 'bg-red-700 text-white' : 'bg-white text-slate-600'}`}>Verified 24×7 only</button>
              <button type="button" onClick={() => setVerifiedOnly(false)} aria-pressed={!verifiedOnly} className={`px-4 py-2.5 ${!verifiedOnly ? 'bg-red-700 text-white' : 'bg-white text-slate-600'}`}>Include unverified</button>
            </div>
          </div>

          {error && <div role="alert" className="mt-5 card border-red-300 bg-red-50 p-5 flex items-start gap-3"><AlertOctagon className="text-red-700 shrink-0 mt-0.5" size={22} /><p className="font-semibold text-red-900">{error}</p></div>}

          <ul className="mt-5 grid gap-3 md:grid-cols-2">
            {hospitals === null
              ? [0, 1, 2, 3].map((i) => <li key={i} className="card p-5 h-36 animate-pulse" aria-hidden="true" />)
              : shown.length === 0
                ? <li className="card p-6 text-center text-slate-500 md:col-span-2">No hospitals match this filter near your location. <button type="button" onClick={() => setVerifiedOnly(false)} className="font-bold text-brand-800 underline">Show unverified listings</button></li>
                : shown.map((h) => (
                  <li key={h.id} className="card p-4 sm:p-5 flex flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link href={`/hospitals/${h.id}`} className="font-extrabold text-slate-900 leading-snug hover:text-brand-800 hover:underline">{h.name}</Link>
                        <p className="mt-1 text-xs text-slate-500">{h.address}</p>
                      </div>
                      <div className="text-right shrink-0"><p className="text-lg font-extrabold text-brand-800 leading-none">{h.distanceKm.toFixed(1)}</p><p className="text-[10px] uppercase text-slate-500">km</p></div>
                    </div>
                    <p className="mt-2 text-[11px]">
                      {h.emergency === 'verified'
                        ? <span className="inline-flex items-center gap-1.5 font-bold text-red-800"><CheckCircle2 size={13} />Verified 24×7 emergency</span>
                        : <span className="font-semibold text-amber-800">Emergency listed — unverified, call to confirm</span>}
                      {h.emergencyNote && <span className="block text-slate-500 mt-0.5">{h.emergencyNote}</span>}
                    </p>
                    <div className="mt-auto pt-3 flex flex-wrap gap-2">
                      {h.phone
                        ? <a href={`tel:${h.phone}`} className="inline-flex items-center gap-2 bg-red-700 text-white font-extrabold rounded-xl px-4 py-2.5 text-sm min-h-[44px] hover:bg-red-800"><PhoneCall size={16} />{h.phone}</a>
                        : <span className="inline-flex items-center text-xs text-slate-500 px-2 py-2.5">Number not listed — call 104</span>}
                      <a href={directionsUrl(h.lat, h.lng, h.shortName)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 border-2 border-brand-700 text-brand-800 font-bold rounded-xl px-4 py-2.5 text-sm min-h-[44px] hover:bg-brand-50"><Navigation size={16} />Directions</a>
                    </div>
                  </li>
                ))}
          </ul>
          <p className="mt-5 flex items-start gap-1.5 text-[11px] text-slate-500 max-w-3xl"><Info size={13} className="mt-0.5 shrink-0" />If your nearest listed emergency hospital is far, do not drive someone critical yourself unless no other option exists — call 112 and request an ambulance with trained staff. Every government district hospital has a 24×7 casualty, even if it is not yet in our list.</p>
        </div>
      </section>
    </div>
  );
}
