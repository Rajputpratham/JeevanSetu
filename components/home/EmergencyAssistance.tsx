'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PhoneCall, Navigation, Ambulance, Siren } from 'lucide-react';
import { useUserLocation } from '@/lib/useLocation';
import { directionsUrl } from '@/lib/geo';

interface EmergencyHospital {
  id: string; name: string; shortName: string; emergency: string; distanceKm: number; lat: number; lng: number; phone: string | null;
}

export default function EmergencyAssistance() {
  const { location } = useUserLocation();
  const [hospitals, setHospitals] = useState<EmergencyHospital[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/emergency?lat=${location.lat}&lng=${location.lng}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setHospitals((d.hospitals ?? []).filter((h: EmergencyHospital) => h.emergency === 'verified').slice(0, 3)); })
      .catch(() => { if (!cancelled) setHospitals([]); });
    return () => { cancelled = true; };
  }, [location.lat, location.lng]);

  return (
    <section aria-labelledby="emergency-heading" className="bg-red-800 text-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14 grid gap-8 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <p className="text-xs font-bold uppercase tracking-widest text-red-200 flex items-center gap-2"><Siren size={16} />Step 5 · In an emergency</p>
          <h2 id="emergency-heading" className="mt-1 text-3xl sm:text-4xl font-extrabold tracking-tight">Every second counts.</h2>
          <p className="mt-2 text-red-100">If someone is seriously ill or injured, <strong>call 112 first</strong> — before anything else. The operator will send help.</p>
          <a href="tel:112" className="mt-5 flex items-center justify-center gap-3 bg-white text-red-800 rounded-2xl px-6 py-5 shadow-lg hover:bg-red-50 transition-colors">
            <PhoneCall size={34} strokeWidth={2.5} />
            <span className="text-left"><span className="block text-3xl font-black leading-none">112</span>
              <span className="text-xs font-bold uppercase tracking-wide">National Emergency Number · Free · 24×7</span></span>
          </a>
          <p className="mt-3 text-xs text-red-100/90 flex items-start gap-1.5"><Ambulance size={14} className="mt-0.5 shrink-0" />Ambulance: 108 (most states) · 102 (pregnant women &amp; children) · Directions to any hospital work offline via Google Maps.</p>
        </div>
        <div className="lg:col-span-3">
          <h3 className="font-bold text-lg text-white">Nearest hospitals with verified 24×7 emergency</h3>
          <p className="text-xs text-red-100/80">Distances approximate · Always call ahead if possible</p>
          <div className="mt-4 grid gap-3">
            {hospitals === null
              ? [0, 1, 2].map((i) => <div key={i} className="h-20 rounded-2xl bg-red-700/60 animate-pulse" />)
              : hospitals.length === 0
                ? <p className="text-sm text-red-100">Could not load hospitals — call 112 immediately if someone needs urgent care.</p>
                : hospitals.map((h) => (
                  <div key={h.id} className="bg-red-900/60 border border-red-700 rounded-2xl px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <Link href={`/hospitals/${h.id}`} className="font-bold leading-snug hover:underline">{h.name}</Link>
                      <p className="text-xs text-red-100/90 mt-0.5">{h.distanceKm.toFixed(1)} km away</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {h.phone
                        ? <a href={`tel:${h.phone}`} aria-label={`Call ${h.shortName}`} className="inline-flex items-center gap-1.5 bg-white text-red-800 font-extrabold rounded-xl px-3.5 py-2.5 text-sm min-h-[44px] hover:bg-red-50"><PhoneCall size={16} />Call</a>
                        : <span className="text-xs text-red-100/80">Number not listed</span>}
                      <a href={directionsUrl(h.lat, h.lng, h.shortName)} target="_blank" rel="noopener noreferrer" aria-label={`Directions to ${h.shortName}`} className="inline-flex items-center gap-1.5 border-2 border-white text-white font-bold rounded-xl px-3.5 py-2.5 text-sm min-h-[44px] hover:bg-white/10"><Navigation size={16} />Go</a>
                    </div>
                  </div>
                ))}
          </div>
          <Link href="/emergency" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-white underline underline-offset-4 hover:text-amber-200">Full emergency guide: what to say, what to carry →</Link>
        </div>
      </div>
    </section>
  );
}
